import { describe, it, expect } from "vitest";
import { resolveFormula, buildAttacks } from "../helpers/attack-transforms.ts";
import { LEVEL_LABELS } from "../helpers/spell-transforms.ts";

// ── resolveFormula ──────────────────────────────────────────────────

describe("resolveFormula", () => {
  it("resolves a simple @mod reference", () => {
    expect(resolveFormula("1d8 + @mod", { mod: 4 })).toBe("1d8 + 4");
  });

  it("resolves nested path references", () => {
    const rollData = { abilities: { str: { mod: 3 } } };
    expect(resolveFormula("1 + @abilities.str.mod", rollData)).toBe("1 + 3");
  });

  it("replaces unknown references with 0", () => {
    expect(resolveFormula("@missing", {})).toBe("0");
  });

  it("handles multiple references in one formula", () => {
    const rollData = { mod: 4, prof: 2 };
    expect(resolveFormula("@mod + @prof", rollData)).toBe("4 + 2");
  });

  it("leaves formulas with no references unchanged", () => {
    expect(resolveFormula("2d6 + 5", {})).toBe("2d6 + 5");
  });

  it("resolves deeply nested paths", () => {
    const rollData = { a: { b: { c: { d: 42 } } } };
    expect(resolveFormula("@a.b.c.d", rollData)).toBe("42");
  });

  it("handles zero values without replacing with fallback", () => {
    expect(resolveFormula("@mod", { mod: 0 })).toBe("0");
  });

  it("handles negative values", () => {
    expect(resolveFormula("1d6 + @mod", { mod: -2 })).toBe("1d6 + -2");
  });
});

// ── buildAttacks ────────────────────────────────────────────────────

describe("buildAttacks", () => {
  it("builds weapon attacks from resolved weapon data", () => {
    const weapons = [
      { id: "w1", name: "Longsword", img: "ls.png", rangeValue: 5, rangeUnits: "ft.", attackFlat: 7, damageFormula: "1d8 + 4" },
    ];
    const result = buildAttacks(weapons, [], [], LEVEL_LABELS, "Fighter 5");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "w1", name: "Longsword", img: "ls.png",
      source: "Melee Attack", activationType: "attack",
      range: "5 ft.", toHit: "+7", damage: "1d8 + 4", notes: "",
    });
  });

  it("defaults weapon range to 5 ft. when no range value", () => {
    const weapons = [
      { id: "w1", name: "Dagger", img: "", damageFormula: "1d4" },
    ];
    const result = buildAttacks(weapons, [], [], LEVEL_LABELS, "Rogue 3");
    expect(result[0].range).toBe("5 ft.");
  });

  it("shows — for toHit when attackFlat is null", () => {
    const weapons = [
      { id: "w1", name: "Dagger", img: "", attackFlat: null, damageFormula: "1d4" },
    ];
    const result = buildAttacks(weapons, [], [], LEVEL_LABELS, "Rogue 3");
    expect(result[0].toHit).toBe("—");
  });

  it("builds spell attacks from attack activities", () => {
    const activities = new Map();
    activities.set("a1", { type: "attack", attack: { type: { value: "ranged" } }, damage: { parts: [{ formula: "1d10" }] } });
    const spells = [
      { id: "s1", name: "Fire Bolt", img: "fb.png", system: { level: 0, activities, range: { value: 120, units: "ft." }, properties: new Set(["vocal", "somatic"]) } },
    ];
    const scInfo = [{ label: "Wizard", ability: "int", dc: 15, attack: 7 }];
    const result = buildAttacks([], spells, scInfo, LEVEL_LABELS, "Wizard 5");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Fire Bolt");
    expect(result[0].toHit).toBe("+7");
    expect(result[0].damage).toBe("1d10");
    expect(result[0].source).toBe("Cantrip • Wizard");
    expect(result[0].notes).toBe("V/S");
  });

  it("builds save+damage spell attacks", () => {
    const activities = new Map();
    activities.set("a1", { type: "save", damage: { parts: [{ formula: "8d6" }] } });
    const spells = [
      { id: "s1", name: "Fireball", img: "", system: { level: 3, activities, range: { value: 150, units: "ft." }, properties: new Set() } },
    ];
    const scInfo = [{ label: "Wizard", ability: "int", dc: 15, attack: 7 }];
    const result = buildAttacks([], spells, scInfo, LEVEL_LABELS, "Wizard 5");
    expect(result).toHaveLength(1);
    expect(result[0].toHit).toBe("DC 15");
    expect(result[0].damage).toBe("8d6");
  });

  it("skips spells without attack or save+damage activities", () => {
    const activities = new Map();
    activities.set("a1", { type: "utility" });
    const spells = [
      { id: "s1", name: "Mage Hand", img: "", system: { level: 0, activities, range: {}, properties: new Set() } },
    ];
    const result = buildAttacks([], spells, [], LEVEL_LABELS, "Wizard 5");
    expect(result).toHaveLength(0);
  });

  it("skips spells with no activities", () => {
    const spells = [
      { id: "s1", name: "Light", img: "", system: { level: 0, range: {}, properties: new Set() } },
    ];
    const result = buildAttacks([], spells, [], LEVEL_LABELS, "Wizard 5");
    expect(result).toHaveLength(0);
  });

  it("handles touch and self range for spell attacks", () => {
    const activities = new Map();
    activities.set("a1", { type: "attack", damage: { parts: [{ formula: "1d8" }] } });
    const spells = [
      { id: "s1", name: "Shocking Grasp", img: "", system: { level: 0, activities, range: { units: "touch" }, properties: new Set() } },
      { id: "s2", name: "Self Spell", img: "", system: { level: 0, activities: new Map([["a1", { type: "attack", damage: { parts: [{ formula: "1d6" }] } }]]), range: { units: "self" }, properties: new Set() } },
    ];
    const result = buildAttacks([], spells, [{ label: "W", ability: "int", dc: 15, attack: 7 }], LEVEL_LABELS, "Wizard 5");
    expect(result[0].range).toBe("Touch");
    expect(result[1].range).toBe("Self");
  });
});
