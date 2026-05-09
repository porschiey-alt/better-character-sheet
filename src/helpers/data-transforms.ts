/**
 * Barrel re-export for all data-transformation helpers.
 *
 * Each category lives in its own module:
 * - ability-transforms.ts  — abilities, saves, skills
 * - spell-transforms.ts    — spells, spell slots, spellcasting info
 * - attack-transforms.ts   — attacks, formula resolution
 * - feature-transforms.ts  — action features, feature groups
 * - inventory-transforms.ts — inventory, currency, encumbrance
 * - condition-transforms.ts — conditions/status effects
 */

export { buildAbilities, buildSaves, buildSkills } from "./ability-transforms.ts";
export type { AbilityVM, SaveVM, SkillVM } from "./ability-transforms.ts";

export {
  LEVEL_LABELS,
  isSpellAvailable,
  buildSpellSlots,
  buildSpellcastingInfo,
  buildSpellsByActivation,
  buildSpellsByLevel,
} from "./spell-transforms.ts";
export type {
  SpellSlotVM,
  SpellcastingInfoVM,
  SpellByActivationVM,
  SpellByActivationGroupsVM,
  SpellByLevelEntryVM,
  SpellByLevelVM,
} from "./spell-transforms.ts";

export { resolveFormula, buildAttacks } from "./attack-transforms.ts";
export type { AttackVM, ResolvedWeaponData } from "./attack-transforms.ts";

export { buildActionFeatures, buildFeatureItem, buildFeatureGroups } from "./feature-transforms.ts";
export type {
  ActionFeatureUsesVM,
  ActionFeatureVM,
  FeatureItemSubActionVM,
  FeatureItemVM,
  FeatureGroupVM,
} from "./feature-transforms.ts";

export { buildInventoryGroups, buildCurrency, buildEncumbrance } from "./inventory-transforms.ts";
export type { InventoryItemVM, InventoryGroupVM } from "./inventory-transforms.ts";

export { buildConditionTypes } from "./condition-transforms.ts";
export type { ConditionTypeVM } from "./condition-transforms.ts";
