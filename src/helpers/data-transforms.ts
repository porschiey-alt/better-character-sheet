/**
 * Pure data-transformation helpers extracted from BetterCharacterSheet._prepareContext().
 * These functions take raw dnd5e system/actor data and produce view-model objects,
 * with no dependency on FoundryVTT globals.
 */

export interface AbilityVM {
  key: string;
  abbr: string;
  label: string;
  value: number;
  mod: number;
}

export interface SaveVM {
  key: string;
  abbr: string;
  mod: number;
  proficient: number;
}

export interface SkillVM {
  key: string;
  label: string;
  ability: string;
  abbreviation: string;
  total: number;
  value: number;
}

export interface AttackVM {
  id: string;
  name: string;
  img: string;
  source: string;
  activationType: string;
  range: string;
  toHit: string;
  damage: string;
  notes: string;
}

export interface SpellSlotVM {
  level: number;
  label: string;
  value: number;
  max: number;
  pips: { used: boolean }[];
}

export interface InventoryItemVM {
  id: string;
  name: string;
  img: string;
  quantity: number;
  weight: number;
  equipped: boolean;
  attuned: boolean;
  cost: string;
  subtype: string;
  notes: string;
}

export interface InventoryGroupVM {
  type: string;
  label: string;
  items: InventoryItemVM[];
}

export interface ConditionTypeVM {
  id: string;
  label: string;
  icon: string;
  active: boolean;
}

// ── New VM interfaces for extracted builders ────────────────────────

export interface SpellcastingInfoVM {
  spellcasting: { label: string; ability: string; dc: number; attack: number }[];
  showManageSpells: boolean;
  isWizard: boolean;
  maxPreparedSpells: number;
}

export interface SpellByActivationVM {
  name: string;
  level: number;
  levelLabel: string;
}

export interface SpellByActivationGroupsVM {
  bonus: SpellByActivationVM[];
  reaction: SpellByActivationVM[];
  other: SpellByActivationVM[];
  ritual: SpellByActivationVM[];
}

export interface SpellByLevelEntryVM {
  id: string;
  name: string;
  img: string;
  level: number;
  castTime: string;
  range: string;
  hitDc: string;
  effect: string;
  components: string;
  source: string;
  prepared: boolean;
  concentration: boolean;
  ritual: boolean;
}

export interface SpellByLevelVM {
  level: number;
  label: string;
  spells: SpellByLevelEntryVM[];
}

export interface ActionFeatureUsesVM {
  value: number;
  max: number;
  spent: number;
  per: string;
  remaining: number;
}

export interface ActionFeatureVM {
  id: string;
  activityId?: string;
  name: string;
  img: string;
  description: string;
  truncatedDescription: string;
  hasLongDescription: boolean;
  activationType: string;
  activationLabel: string;
  uses: ActionFeatureUsesVM | null;
  pips: { filled: boolean }[];
  useNumericDisplay?: boolean;
  isParent?: boolean;
  isChild?: boolean;
}

export interface FeatureItemSubActionVM {
  id: string;
  name: string;
  activationLabel: string;
  truncatedDescription: string;
  itemId: string;
}

export interface FeatureItemVM {
  id: string;
  name: string;
  img: string;
  source: string;
  description: string;
  truncatedDescription: string;
  hasLongDescription: boolean;
  uses: ActionFeatureUsesVM | null;
  pips: { filled: boolean }[];
  useNumericDisplay: boolean;
  subActions: FeatureItemSubActionVM[];
}

export interface FeatureGroupVM {
  type: string;
  label: string;
  items: FeatureItemVM[];
}

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

export const LEVEL_LABELS = [
  "Cantrips", "1st Level", "2nd Level", "3rd Level", "4th Level",
  "5th Level", "6th Level", "7th Level", "8th Level", "9th Level",
];

/**
 * Build ability score view models from the system abilities data.
 */
export function buildAbilities(
  systemAbilities: Record<string, any>,
  abilityLabels: Record<string, string>,
): AbilityVM[] {
  return ABILITY_KEYS.map((key) => {
    const ab = systemAbilities[key];
    return {
      key,
      abbr: key.toUpperCase(),
      label: abilityLabels[key] ?? key,
      value: ab.value,
      mod: ab.mod,
    };
  });
}

/**
 * Build saving throw view models.
 */
export function buildSaves(
  systemAbilities: Record<string, any>,
): SaveVM[] {
  return ABILITY_KEYS.map((key) => {
    const ab = systemAbilities[key];
    return {
      key,
      abbr: key.toUpperCase(),
      mod: ab.save?.value ?? ab.mod,
      proficient: ab.proficient ?? 0,
    };
  });
}

/**
 * Build skill view models, sorted alphabetically by label.
 */
export function buildSkills(
  systemSkills: Record<string, any>,
  skillLabels: Record<string, string>,
): SkillVM[] {
  return Object.entries(systemSkills)
    .map(([key, sk]: [string, any]) => ({
      key,
      label: skillLabels[key] ?? key,
      ability: sk.ability,
      abbreviation: (sk.ability || "").toUpperCase().slice(0, 3),
      total: sk.total ?? 0,
      value: sk.value ?? 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Resolve @references in a damage formula string using roll data.
 * E.g. "1d6 + @abilities.str.mod" with rollData {abilities:{str:{mod:3}}} → "1d6 + 3"
 */
export function resolveFormula(formula: string, rollData: Record<string, any>): string {
  return formula.replace(/@([a-zA-Z0-9_.]+)/g, (_: string, path: string) => {
    const parts = path.split(".");
    let val: any = rollData;
    for (const p of parts) {
      val = val?.[p];
      if (val === undefined) break;
    }
    return val !== undefined ? String(val) : "0";
  });
}

/**
 * Determine if a spell should be shown as available (prepared/always/innate/etc).
 * Uses both legacy fields (method/prepared) and v5.3.2 fields (preparation.mode/prepared).
 * Ritual spells that are learned (have a prepared property) always show even if not prepped.
 */
export function isSpellAvailable(spell: any): boolean {
  const lvl = spell.system.level ?? 0;
  if (lvl === 0) return true;

  // Check v5.3.2 preparation.mode first
  const prepMode = spell.system.preparation?.mode;
  if (prepMode === "always" || prepMode === "innate" || prepMode === "atwill" || prepMode === "pact") return true;

  // Legacy method field
  const method = spell.system.method;
  if (method === "always" || method === "innate" || method === "atwill" || method === "pact") return true;

  // Check if prepared via either field
  const isPrepared = !!(spell.system.preparation?.prepared) || !!(spell.system.prepared);
  if (isPrepared) return true;

  // Ritual spells that are learned (on the sheet) but not prepped still show
  const props = spell.system.properties;
  if (props?.has?.("ritual")) return true;

  // If it has a preparation mode or prepared field, it's user-managed — hide if not prepped
  if (prepMode === "prepared" || spell.system.prepared !== undefined || spell.system.preparation?.prepared !== undefined) {
    return false;
  }
  return true;
}

/**
 * Build spell slot view models with pip arrays.
 */
export function buildSpellSlots(systemSpells: Record<string, any>): SpellSlotVM[] {
  const slots: SpellSlotVM[] = [];
  for (let i = 1; i <= 9; i++) {
    const slot = systemSpells?.[`spell${i}`];
    if (slot) {
      const pips = [];
      for (let p = 0; p < (slot.max || 0); p++) {
        pips.push({ used: p >= (slot.value || 0) });
      }
      slots.push({
        level: i,
        label: LEVEL_LABELS[i] || `Level ${i}`,
        value: slot.value ?? 0,
        max: slot.max ?? 0,
        pips,
      });
    }
  }
  return slots;
}

/**
 * Build inventory groups from actor items.
 * Filters out natural weapons (e.g. Unarmed Strike).
 */
export function buildInventoryGroups(items: any[]): InventoryGroupVM[] {
  const invTypes = ["weapon", "equipment", "consumable", "tool", "container", "loot"];
  const invLabels: Record<string, string> = {
    weapon: "Weapons",
    equipment: "Equipment",
    consumable: "Consumables",
    tool: "Tools",
    container: "Containers",
    loot: "Loot",
  };

  return invTypes.map((type) => ({
    type,
    label: invLabels[type] || type,
    items: items
      .filter((i: any) => i.type === type && i.system.type?.value !== "natural")
      .map((i: any) => {
        const price = i.system.price;
        const cost = price?.value ? `${price.value} ${price.denomination || "gp"}` : "";
        const subtype = i.system.type?.label || i.system.armor?.type || "";
        let notes = "";
        if (i.system.armor?.value) notes = `AC ${i.system.armor.value}`;
        else if (i.system.damage?.base?.formula) notes = i.system.damage.base.formula;
        if (i.system.uses?.max)
          notes += notes
            ? `, ${i.system.uses.value}/${i.system.uses.max} charges`
            : `${i.system.uses.value}/${i.system.uses.max} charges`;

        return {
          id: i.id,
          name: i.name,
          img: i.img,
          quantity: i.system.quantity ?? 1,
          weight: i.system.weight?.value ?? 0,
          equipped: !!i.system.equipped,
          attuned: i.system.attunement === "attuned",
          cost,
          subtype,
          notes,
        };
      }),
  }));
}

/**
 * Build condition type view models from status effects and actor effects.
 */
export function buildConditionTypes(
  actorEffects: any[],
  statusEffects: any[],
): ConditionTypeVM[] {
  return (statusEffects || [])
    .filter((s: any) => s.id && s.id !== "dead" && s.id !== "exhaustion")
    .map((s: any) => {
      const isActive = (actorEffects || []).some(
        (e: any) => e.statuses?.has(s.id) || (e.type === "condition" && e.system?.id === s.id)
      );
      return {
        id: s.id,
        label: s.name || s.label || s.id,
        icon: s.img || s.icon || "",
        active: isActive,
      };
    });
}

/**
 * Build currency view model from system data.
 */
export function buildCurrency(systemCurrency: any): Record<string, number> {
  return {
    pp: systemCurrency?.pp ?? 0,
    gp: systemCurrency?.gp ?? 0,
    ep: systemCurrency?.ep ?? 0,
    sp: systemCurrency?.sp ?? 0,
    cp: systemCurrency?.cp ?? 0,
  };
}

/**
 * Build encumbrance view model from system data.
 */
export function buildEncumbrance(systemEncumbrance: any): { value: number; max: number; pct: number } {
  return {
    value: systemEncumbrance?.value ?? 0,
    max: systemEncumbrance?.max ?? 150,
    pct: systemEncumbrance?.pct ?? 0,
  };
}

// ── Newly extracted builders ────────────────────────────────────────

/**
 * Build spellcasting info from class items.
 * Returns spellcasting stats, prepared-caster detection, and max prepared spells.
 */
export function buildSpellcastingInfo(
  classItems: any[],
  systemAbilities: Record<string, any>,
  prof: number,
): SpellcastingInfoVM {
  const spellcasting = classItems
    .filter((c: any) => c.system?.spellcasting?.ability)
    .map((c: any) => {
      const sc = c.system.spellcasting;
      const abilityMod = systemAbilities[sc.ability]?.mod ?? 0;
      return {
        label: c.name,
        ability: sc.ability,
        dc: 8 + prof + abilityMod,
        attack: prof + abilityMod,
      };
    });

  const preparedCasterIds = new Set(["wizard", "cleric", "druid", "paladin"]);
  const spellcastingClass = classItems.find((c: any) => {
    const id = c.system?.identifier?.toLowerCase();
    return id && preparedCasterIds.has(id) && c.system?.spellcasting?.ability;
  });
  const showManageSpells = !!spellcastingClass;
  const isWizard = spellcastingClass?.system?.identifier?.toLowerCase() === "wizard";

  let maxPreparedSpells = 0;
  if (spellcastingClass) {
    maxPreparedSpells = spellcastingClass.system.spellcasting?.preparation?.max ?? 0;
    if (!maxPreparedSpells) {
      const scAbility = spellcastingClass.system.spellcasting.ability;
      const abilityMod = systemAbilities?.[scAbility]?.mod ?? 0;
      const classLevel = spellcastingClass.system.levels ?? 1;
      maxPreparedSpells = Math.max(1, abilityMod + classLevel);
    }
  }

  return { spellcasting, showManageSpells, isWizard, maxPreparedSpells };
}

/**
 * Categorize available spells by activation type for the action tab.
 */
export function buildSpellsByActivation(
  spellItems: any[],
  levelLabels: string[],
): SpellByActivationGroupsVM {
  const groups: SpellByActivationGroupsVM = {
    bonus: [], reaction: [], other: [], ritual: [],
  };
  for (const spell of spellItems) {
    const actType = spell.system.activation?.type || "action";
    const lvl = spell.system.level ?? 0;
    const label = lvl === 0 ? "Cantrip" : levelLabels[lvl] || `${lvl}th`;
    const entry: SpellByActivationVM = { name: spell.name, level: lvl, levelLabel: label };

    if (actType === "bonus") groups.bonus.push(entry);
    else if (actType === "reaction") groups.reaction.push(entry);
    else if (actType !== "action") groups.other.push(entry);

    const props = spell.system.properties;
    if (props?.has?.("ritual")) {
      groups.ritual.push(entry);
    }
  }
  return groups;
}

/**
 * Group available spells by level with DnDBeyond-style fields.
 */
export function buildSpellsByLevel(
  spellItems: any[],
  levelLabels: string[],
): SpellByLevelVM[] {
  const spellLevels: Record<number, SpellByLevelEntryVM[]> = {};
  for (const spell of spellItems) {
    const lvl = spell.system.level ?? 0;
    if (!spellLevels[lvl]) spellLevels[lvl] = [];

    const actType = spell.system.activation?.type || "";
    const actVal = spell.system.activation?.value ?? "";
    const timeMap: Record<string, string> = {
      action: "A", bonus: "BA", reaction: "R", minute: "m", hour: "h",
    };
    const castTime = actVal
      ? `${actVal}${timeMap[actType] || actType}`
      : timeMap[actType] || actType || "—";

    const rng = spell.system.range;
    let range = "—";
    if (rng?.value) range = `${rng.value} ${rng.units || "ft."}`;
    else if (rng?.units === "touch") range = "Touch";
    else if (rng?.units === "self") range = "Self";

    const props = spell.system.properties;
    const comps: string[] = [];
    if (props?.has?.("vocal")) comps.push("V");
    if (props?.has?.("somatic")) comps.push("S");
    if (props?.has?.("material")) comps.push("M");
    const components = comps.join("/") || "—";

    const source = spell.system.sourceItem?.name || "";
    const dmg = spell.system.damage?.base;
    const effect = dmg?.formula || (spell.system.healing ? "Healing" : "—");

    spellLevels[lvl].push({
      id: spell.id,
      name: spell.name,
      img: spell.img,
      level: lvl,
      castTime,
      range,
      hitDc: "—",
      effect,
      components,
      source,
      prepared:
        spell.system.method === "prepared"
          ? spell.system.prepared
          : true,
      concentration: props?.has?.("concentration"),
      ritual: props?.has?.("ritual"),
    });
  }
  return Object.entries(spellLevels)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([lvl, spells]) => ({
      level: Number(lvl),
      label: levelLabels[Number(lvl)] || `Level ${lvl}`,
      spells: spells.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/**
 * Pre-resolved weapon data for buildAttacks. Caller must resolve formulas
 * via getRollData() before passing weapons in, keeping the builder pure.
 */
export interface ResolvedWeaponData {
  id: string;
  name: string;
  img: string;
  rangeValue?: number;
  rangeUnits?: string;
  attackFlat?: number | null;
  damageFormula: string;
}

/**
 * Build the attack list from pre-resolved weapon data and attack spells.
 * Weapon formulas must be pre-resolved by the caller (no Foundry deps here).
 */
export function buildAttacks(
  weapons: ResolvedWeaponData[],
  spellItems: any[],
  spellcastingInfo: SpellcastingInfoVM["spellcasting"],
  levelLabels: string[],
  classLabel: string,
): AttackVM[] {
  const attacks: AttackVM[] = [];

  // Weapons
  for (const w of weapons) {
    attacks.push({
      id: w.id,
      name: w.name,
      img: w.img,
      source: "Melee Attack",
      activationType: "attack",
      range: w.rangeValue
        ? `${w.rangeValue} ${w.rangeUnits || "ft."}`
        : "5 ft.",
      toHit: w.attackFlat != null
        ? `+${w.attackFlat}`
        : "—",
      damage: w.damageFormula,
      notes: "",
    });
  }

  // Attack spells
  for (const i of spellItems) {
    const acts = i.system.activities;
    if (!acts) continue;

    let hasAttack = false;
    let hasSaveDamage = false;
    let damageFormula = "";
    let attackType = "";

    for (const act of acts.values()) {
      if (act.type === "attack") {
        hasAttack = true;
        attackType = act.attack?.type?.value || "ranged";
        damageFormula = act.damage?.parts?.[0]?.formula || damageFormula;
      }
      if (act.type === "save" && act.damage?.parts?.[0]?.formula) {
        hasSaveDamage = true;
        damageFormula = damageFormula || act.damage.parts[0].formula;
      }
    }

    if (!hasAttack && !hasSaveDamage) continue;

    const rng = i.system.range;
    let range = "—";
    if (rng?.value) range = `${rng.value} ${rng.units || "ft."}`;
    else if (rng?.units === "touch") range = "Touch";
    else if (rng?.units === "self") range = "Self";

    const comps: string[] = [];
    const props = i.system.properties;
    if (props?.has?.("vocal")) comps.push("V");
    if (props?.has?.("somatic")) comps.push("S");
    if (props?.has?.("material")) comps.push("M");

    const scInfo = spellcastingInfo[0];
    const hitStr = hasAttack
      ? `+${scInfo?.attack ?? 0}`
      : hasSaveDamage ? `DC ${scInfo?.dc ?? 10}` : "—";

    const lvlLabel = i.system.level === 0 ? "Cantrip" : (levelLabels[i.system.level] || "");
    const className = classLabel.split(" ")[0] || "Spell";

    attacks.push({
      id: i.id,
      name: i.name,
      img: i.img,
      source: `${lvlLabel} • ${className}`,
      activationType: "attack",
      range,
      toHit: hitStr,
      damage: damageFormula || "—",
      notes: comps.length ? comps.join("/") : "",
    });
  }

  return attacks;
}

// ── Shared helpers for uses/pips/description truncation ─────────────

function buildUsesVM(system: any): ActionFeatureUsesVM | null {
  if (!system.uses?.max) return null;
  return {
    value: system.uses.value ?? 0,
    max: system.uses.max,
    spent: Number(system.uses.spent) || 0,
    per: system.uses.recovery?.[0]?.type || "",
    remaining: system.uses.max - (Number(system.uses.spent) || 0),
  };
}

function truncateHtml(html: string, maxLen: number): { fullDesc: string; textOnly: string; truncated: string; hasLongDescription: boolean } {
  const fullDesc = html || "";
  const textOnly = fullDesc.replace(/<[^>]*>/g, "").trim();
  const truncated = textOnly.length > maxLen
    ? textOnly.substring(0, maxLen) + "…"
    : textOnly;
  return { fullDesc, textOnly, truncated, hasLongDescription: textOnly.length > maxLen };
}

/**
 * Build action features (feats with activation or uses, with descriptions + pips).
 */
export function buildActionFeatures(featItems: any[]): ActionFeatureVM[] {
  const actionFeatures: ActionFeatureVM[] = [];
  const typeMap: Record<string, string> = {
    action: "action", bonus: "bonus", reaction: "reaction",
    minute: "other", hour: "other", special: "other",
  };
  const labelMap: Record<string, string> = {};

  for (const i of featItems) {
    if (!(i.system.uses?.max || i.system.activation?.type || i.system.activities?.size > 0)) {
      continue;
    }

    const uses = buildUsesVM(i.system);
    const useNumericDisplay = uses ? uses.max > 7 : false;
    const pips: { filled: boolean }[] = [];
    if (uses && !useNumericDisplay) {
      for (let p = 0; p < uses.max; p++) {
        pips.push({ filled: p >= uses.spent });
      }
    }

    const { fullDesc, textOnly, truncated } = truncateHtml(i.system.description?.value, 80);

    // Build per-item label map entries for minute/hour activation
    labelMap["minute"] = `${i.system.activation?.value || ""} Minutes`;
    labelMap["hour"] = `${i.system.activation?.value || ""} Hours`;

    // Expand: create an entry per activity that has an activation type
    const activities = i.system.activities;
    const activitiesWithType: any[] = [];
    if (activities && activities.size > 0) {
      for (const act of activities.values()) {
        const at = act.activation?.type;
        if (at && typeMap[at] && typeMap[at] !== "other") {
          activitiesWithType.push(act);
        }
      }
    }

    if (activitiesWithType.length > 1) {
      // Parent entry with uses/pips
      const parentActType = activitiesWithType[0].activation?.type || "action";
      actionFeatures.push({
        id: i.id,
        name: i.name,
        img: i.img,
        description: fullDesc,
        truncatedDescription: truncated,
        hasLongDescription: textOnly.length > 80,
        activationType: typeMap[parentActType] || "action",
        activationLabel: "",
        uses,
        pips,
        useNumericDisplay,
        isParent: true,
      });
      // Child activity entries without uses
      for (const act of activitiesWithType) {
        const at = act.activation?.type || "other";
        let actDesc = act.description?.value || "";
        if (!actDesc) {
          const parts: string[] = [];
          if (act.activation?.type) {
            const atLabel: Record<string, string> = { action: "Action", bonus: "Bonus Action", reaction: "Reaction" };
            parts.push(atLabel[act.activation.type] || act.activation.type);
          }
          if (act.damage?.parts?.length) {
            const dmg = act.damage.parts[0];
            if (dmg.formula) parts.push(`Damage: ${dmg.formula}`);
          }
          if (act.range?.value) parts.push(`Range: ${act.range.value} ${act.range.units || "ft."}`);
          actDesc = parts.join(" · ");
        }
        const actText = truncateHtml(actDesc, 80);
        actionFeatures.push({
          id: i.id,
          activityId: act.id || act._id,
          name: act.name || i.name,
          img: i.img,
          description: actDesc || fullDesc,
          truncatedDescription: actText.truncated,
          hasLongDescription: actText.hasLongDescription,
          activationType: typeMap[at] || "other",
          activationLabel: "",
          uses: null,
          pips: [],
          isChild: true,
        });
      }
    } else {
      // Single activity or no activities — one entry for the whole item
      let actType = i.system.activation?.type || "";
      if (!actType && activitiesWithType.length === 1) {
        actType = activitiesWithType[0].activation?.type || "";
      }
      actType = actType || "other";
      const activationType = typeMap[actType] || "other";

      if (activationType !== "other" || uses) {
        actionFeatures.push({
          id: i.id,
          name: i.name,
          img: i.img,
          description: fullDesc,
          truncatedDescription: truncated,
          hasLongDescription: textOnly.length > 80,
          activationType,
          activationLabel: labelMap[actType] || "",
          uses,
          pips,
          useNumericDisplay,
        });
      }
    }
  }
  return actionFeatures;
}

/**
 * Build a single feature item view model (shared by feature groups).
 */
export function buildFeatureItem(i: any): FeatureItemVM {
  const uses = buildUsesVM(i.system);
  const useNumericDisplay = uses ? uses.max > 7 : false;
  const pips: { filled: boolean }[] = [];
  if (uses && !useNumericDisplay) {
    for (let p = 0; p < uses.max; p++) {
      pips.push({ filled: p >= uses.spent });
    }
  }
  const { fullDesc, textOnly, truncated } = truncateHtml(i.system.description?.value, 80);

  const activationLabels: Record<string, string> = {
    action: "Action", bonus: "Bonus Action", reaction: "Reaction",
  };
  const subActions: FeatureItemSubActionVM[] = [];
  if (i.system.activities?.size > 0) {
    for (const act of i.system.activities.values()) {
      const actType = act.activation?.type || act.type;
      if (activationLabels[actType]) {
        const actDesc = act.description?.value || "";
        const actText = truncateHtml(actDesc, 60);
        subActions.push({
          id: act.id || act._id,
          name: act.name || i.name,
          activationLabel: activationLabels[actType],
          truncatedDescription: actText.truncated,
          itemId: i.id,
        });
      }
    }
  }

  return {
    id: i.id,
    name: i.name,
    img: i.img,
    source: i.system.requirements || "",
    description: fullDesc,
    truncatedDescription: truncated,
    hasLongDescription: textOnly.length > 80,
    uses,
    pips,
    useNumericDisplay,
    subActions,
  };
}

/**
 * Build feature groups from feat items, grouped by type value.
 */
export function buildFeatureGroups(featItems: any[]): FeatureGroupVM[] {
  return [
    {
      type: "class",
      label: "Class Features",
      items: featItems
        .filter((i: any) => i.system.type?.value === "class")
        .map(buildFeatureItem),
    },
    {
      type: "feat",
      label: "Feats",
      items: featItems
        .filter((i: any) => !i.system.type?.value || i.system.type?.value === "feat")
        .map(buildFeatureItem),
    },
    {
      type: "race",
      label: "Species Traits",
      items: featItems
        .filter((i: any) => i.system.type?.value === "race")
        .map(buildFeatureItem),
    },
  ];
}
