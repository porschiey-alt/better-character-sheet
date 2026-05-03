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

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

const LEVEL_LABELS = [
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
 * If a `prepared` property exists (even for unrecognized methods), we respect it.
 * Ritual spells that are learned (have a prepared property) always show even if not prepped.
 */
export function isSpellAvailable(spell: any): boolean {
  const lvl = spell.system.level ?? 0;
  if (lvl === 0) return true;
  const mode = spell.system.method;
  if (mode === "always" || mode === "innate" || mode === "atwill" || mode === "pact") return true;
  // For "prepared" mode or any mode that has a prepared property, respect the flag
  if (mode === "prepared" || spell.system.prepared !== undefined) {
    if (!!spell.system.prepared) return true;
    // Ritual spells that are learned (on the sheet) but not prepped still show
    const props = spell.system.properties;
    if (props?.has?.("ritual")) return true;
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
  const invTypes = ["weapon", "equipment", "consumable", "container", "loot"];
  const invLabels: Record<string, string> = {
    weapon: "Weapons",
    equipment: "Equipment",
    consumable: "Consumables",
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
    .filter((s: any) => s.id && s.id !== "dead")
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
