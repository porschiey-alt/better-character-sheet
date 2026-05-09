/**
 * Pure data-transformation helpers for attacks and formula resolution.
 */

import type { SpellcastingInfoVM } from "./spell-transforms.ts";

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
    let attackType: "melee" | "ranged" = "ranged";

    for (const act of acts.values()) {
      if (act.type === "attack") {
        hasAttack = true;
        attackType = act.attack?.type?.value === "melee" ? "melee" : "ranged";
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
      source: hasAttack
        ? `${attackType === "melee" ? "Melee" : "Ranged"} • ${lvlLabel} • ${className}`
        : `${lvlLabel} • ${className}`,
      activationType: "attack",
      range,
      toHit: hitStr,
      damage: damageFormula || "—",
      notes: comps.length ? comps.join("/") : "",
    });
  }

  return attacks;
}
