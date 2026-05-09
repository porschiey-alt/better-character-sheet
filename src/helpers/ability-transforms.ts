/**
 * Pure data-transformation helpers for ability scores, saves, and skills.
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

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

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
