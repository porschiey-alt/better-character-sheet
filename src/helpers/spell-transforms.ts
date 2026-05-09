/**
 * Pure data-transformation helpers for spells and spell slots.
 */

export interface SpellSlotVM {
  level: number;
  label: string;
  value: number;
  max: number;
  pips: { used: boolean }[];
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
