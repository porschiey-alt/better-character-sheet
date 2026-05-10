/**
 * Pure data-transformation helpers for spells, spell slots, and spellcasting info.
 */

export interface SpellSlotVM {
  level: number;
  label: string;
  value: number;
  max: number;
  pips: { used: boolean }[];
}

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

export const LEVEL_LABELS = [
  "Cantrips", "1st Level", "2nd Level", "3rd Level", "4th Level",
  "5th Level", "6th Level", "7th Level", "8th Level", "9th Level",
];

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
  spellcastingInfo: SpellcastingInfoVM["spellcasting"] = [],
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

    // Determine Hit/DC from spell activities (attack takes precedence over save)
    let hitDc = "—";
    const acts = spell.system.activities;
    if (acts) {
      let hasAttack = false;
      let hasSave = false;
      for (const act of acts.values()) {
        if (act.type === "attack") hasAttack = true;
        if (act.type === "save") hasSave = true;
      }
      const scInfo = spellcastingInfo[0];
      if (hasAttack) hitDc = `+${scInfo?.attack ?? 0}`;
      else if (hasSave) hitDc = `DC ${scInfo?.dc ?? 10}`;
    }

    spellLevels[lvl].push({
      id: spell.id,
      name: spell.name,
      img: spell.img,
      level: lvl,
      castTime,
      range,
      hitDc,
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
