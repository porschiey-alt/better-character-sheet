/**
 * Pure data-transformation helpers for attacks and formula resolution.
 */

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
