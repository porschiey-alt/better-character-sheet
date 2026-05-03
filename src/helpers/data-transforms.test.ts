import { describe, it, expect } from "vitest";
import {
  buildAbilities,
  buildSaves,
  buildSkills,
  resolveFormula,
  isSpellAvailable,
  buildSpellSlots,
  buildInventoryGroups,
  buildConditionTypes,
  buildCurrency,
  buildEncumbrance,
} from "../helpers/data-transforms.ts";

// ── buildAbilities ──────────────────────────────────────────────────

describe("buildAbilities", () => {
  const systemAbilities: Record<string, any> = {
    str: { value: 18, mod: 4 },
    dex: { value: 14, mod: 2 },
    con: { value: 12, mod: 1 },
    int: { value: 10, mod: 0 },
    wis: { value: 8, mod: -1 },
    cha: { value: 16, mod: 3 },
  };
  const labels: Record<string, string> = {
    str: "Strength",
    dex: "Dexterity",
    con: "Constitution",
    int: "Intelligence",
    wis: "Wisdom",
    cha: "Charisma",
  };

  it("returns all 6 abilities in order", () => {
    const result = buildAbilities(systemAbilities, labels);
    expect(result).toHaveLength(6);
    expect(result.map((a) => a.key)).toEqual(["str", "dex", "con", "int", "wis", "cha"]);
  });

  it("maps values and mods correctly", () => {
    const result = buildAbilities(systemAbilities, labels);
    expect(result[0]).toEqual({
      key: "str",
      abbr: "STR",
      label: "Strength",
      value: 18,
      mod: 4,
    });
  });

  it("uppercases abbreviation", () => {
    const result = buildAbilities(systemAbilities, labels);
    expect(result[1].abbr).toBe("DEX");
  });

  it("falls back to key when label is missing", () => {
    const result = buildAbilities(systemAbilities, {});
    expect(result[0].label).toBe("str");
  });
});

// ── buildSaves ──────────────────────────────────────────────────────

describe("buildSaves", () => {
  it("uses save.value when available", () => {
    const abilities = {
      str: { mod: 4, save: { value: 7 }, proficient: 1 },
      dex: { mod: 2, proficient: 0 },
      con: { mod: 1, proficient: 0 },
      int: { mod: 0, proficient: 0 },
      wis: { mod: -1, proficient: 0 },
      cha: { mod: 3, proficient: 0 },
    };
    const saves = buildSaves(abilities);
    expect(saves[0].mod).toBe(7);
    expect(saves[0].proficient).toBe(1);
  });

  it("falls back to ability mod when save is undefined", () => {
    const abilities = {
      str: { mod: 4 },
      dex: { mod: 2 },
      con: { mod: 1 },
      int: { mod: 0 },
      wis: { mod: -1 },
      cha: { mod: 3 },
    };
    const saves = buildSaves(abilities);
    expect(saves[0].mod).toBe(4);
    expect(saves[0].proficient).toBe(0);
  });
});

// ── buildSkills ─────────────────────────────────────────────────────

describe("buildSkills", () => {
  it("sorts skills alphabetically by label", () => {
    const systemSkills = {
      ath: { ability: "str", total: 6, value: 1 },
      acr: { ability: "dex", total: 4, value: 1 },
      arc: { ability: "int", total: 2, value: 0 },
    };
    const labels = { ath: "Athletics", acr: "Acrobatics", arc: "Arcana" };
    const skills = buildSkills(systemSkills, labels);
    expect(skills.map((s) => s.label)).toEqual(["Acrobatics", "Arcana", "Athletics"]);
  });

  it("truncates ability abbreviation to 3 chars", () => {
    const skills = buildSkills(
      { per: { ability: "wisdom", total: 3, value: 0 } },
      { per: "Perception" },
    );
    expect(skills[0].abbreviation).toBe("WIS");
  });

  it("defaults total and value to 0", () => {
    const skills = buildSkills(
      { inv: { ability: "int" } },
      { inv: "Investigation" },
    );
    expect(skills[0].total).toBe(0);
    expect(skills[0].value).toBe(0);
  });
});

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

// ── isSpellAvailable ────────────────────────────────────────────────

describe("isSpellAvailable", () => {
  it("cantrips are always available", () => {
    expect(isSpellAvailable({ system: { level: 0, method: "prepared", prepared: false } })).toBe(true);
  });

  it("'always' method is available", () => {
    expect(isSpellAvailable({ system: { level: 1, method: "always" } })).toBe(true);
  });

  it("'innate' method is available", () => {
    expect(isSpellAvailable({ system: { level: 2, method: "innate" } })).toBe(true);
  });

  it("'atwill' method is available", () => {
    expect(isSpellAvailable({ system: { level: 1, method: "atwill" } })).toBe(true);
  });

  it("'pact' method is available", () => {
    expect(isSpellAvailable({ system: { level: 3, method: "pact" } })).toBe(true);
  });

  it("prepared spell that IS prepared is available", () => {
    expect(isSpellAvailable({ system: { level: 1, method: "prepared", prepared: true } })).toBe(true);
  });

  it("prepared spell that is NOT prepared is unavailable", () => {
    expect(isSpellAvailable({ system: { level: 1, method: "prepared", prepared: false } })).toBe(false);
  });

  it("unknown method with prepared true is available", () => {
    expect(isSpellAvailable({ system: { level: 1, method: "something-else", prepared: true } })).toBe(true);
  });

  it("unknown method with prepared false is unavailable", () => {
    expect(isSpellAvailable({ system: { level: 1, method: "something-else", prepared: false } })).toBe(false);
  });

  it("unknown method with no prepared flag is available", () => {
    expect(isSpellAvailable({ system: { level: 1, method: "something-else" } })).toBe(true);
  });

  it("no method with prepared true is available", () => {
    expect(isSpellAvailable({ system: { level: 1, prepared: true } })).toBe(true);
  });

  it("no method with prepared false is unavailable", () => {
    expect(isSpellAvailable({ system: { level: 1, prepared: false } })).toBe(false);
  });

  it("no method with no prepared flag is available", () => {
    expect(isSpellAvailable({ system: { level: 1 } })).toBe(true);
  });

  it("prepared truthy value (1) is treated as available", () => {
    expect(isSpellAvailable({ system: { level: 1, method: "prepared", prepared: 1 } })).toBe(true);
  });

  it("prepared falsy value (0) is treated as unavailable", () => {
    expect(isSpellAvailable({ system: { level: 1, method: "prepared", prepared: 0 } })).toBe(false);
  });

  it("unprepared ritual spell is still available", () => {
    const props = new Set(["ritual"]);
    expect(isSpellAvailable({ system: { level: 1, method: "prepared", prepared: false, properties: props } })).toBe(true);
  });

  it("unprepared non-ritual spell is unavailable", () => {
    const props = new Set(["vocal", "somatic"]);
    expect(isSpellAvailable({ system: { level: 1, method: "prepared", prepared: false, properties: props } })).toBe(false);
  });
});

// ── buildSpellSlots ─────────────────────────────────────────────────

describe("buildSpellSlots", () => {
  it("builds slots for levels with data", () => {
    const spells = {
      spell1: { value: 3, max: 4 },
      spell2: { value: 1, max: 3 },
    };
    const slots = buildSpellSlots(spells);
    expect(slots).toHaveLength(2);
    expect(slots[0].level).toBe(1);
    expect(slots[0].label).toBe("1st Level");
    expect(slots[0].value).toBe(3);
    expect(slots[0].max).toBe(4);
  });

  it("creates correct pip arrays — unused pips are marked used", () => {
    const spells = { spell1: { value: 2, max: 4 } };
    const slots = buildSpellSlots(spells);
    // value=2 means 2 remaining. pips with index >= value are "used"
    expect(slots[0].pips).toEqual([
      { used: false }, // pip 0 < 2
      { used: false }, // pip 1 < 2
      { used: true },  // pip 2 >= 2
      { used: true },  // pip 3 >= 2
    ]);
  });

  it("skips levels without slot data", () => {
    const spells = { spell3: { value: 2, max: 2 } };
    const slots = buildSpellSlots(spells);
    expect(slots).toHaveLength(1);
    expect(slots[0].level).toBe(3);
    expect(slots[0].label).toBe("3rd Level");
  });

  it("handles empty spell data", () => {
    expect(buildSpellSlots({})).toEqual([]);
  });

  it("handles all slots at 0 value", () => {
    const spells = { spell1: { value: 0, max: 3 } };
    const slots = buildSpellSlots(spells);
    expect(slots[0].pips.every((p) => p.used)).toBe(true);
  });
});

// ── buildInventoryGroups ────────────────────────────────────────────

describe("buildInventoryGroups", () => {
  it("groups items by type", () => {
    const items = [
      { id: "1", name: "Longsword", img: "", type: "weapon", system: { type: {}, price: {}, quantity: 1, weight: { value: 3 }, equipped: true, attunement: "" } },
      { id: "2", name: "Shield", img: "", type: "equipment", system: { type: {}, price: {}, quantity: 1, weight: { value: 6 }, equipped: true, attunement: "" } },
    ];
    const groups = buildInventoryGroups(items);
    const weaponGroup = groups.find((g) => g.type === "weapon")!;
    const equipGroup = groups.find((g) => g.type === "equipment")!;
    expect(weaponGroup.items).toHaveLength(1);
    expect(weaponGroup.items[0].name).toBe("Longsword");
    expect(equipGroup.items).toHaveLength(1);
    expect(equipGroup.items[0].name).toBe("Shield");
  });

  it("filters out natural weapons", () => {
    const items = [
      { id: "1", name: "Unarmed Strike", img: "", type: "weapon", system: { type: { value: "natural" }, price: {}, quantity: 1, weight: { value: 0 }, equipped: true, attunement: "" } },
      { id: "2", name: "Longsword", img: "", type: "weapon", system: { type: { value: "martial" }, price: {}, quantity: 1, weight: { value: 3 }, equipped: true, attunement: "" } },
    ];
    const groups = buildInventoryGroups(items);
    const weaponGroup = groups.find((g) => g.type === "weapon")!;
    expect(weaponGroup.items).toHaveLength(1);
    expect(weaponGroup.items[0].name).toBe("Longsword");
  });

  it("includes price formatting", () => {
    const items = [
      { id: "1", name: "Potion", img: "", type: "consumable", system: { type: {}, price: { value: 50, denomination: "gp" }, quantity: 3, weight: { value: 0.5 }, equipped: false, attunement: "" } },
    ];
    const groups = buildInventoryGroups(items);
    const consumables = groups.find((g) => g.type === "consumable")!;
    expect(consumables.items[0].cost).toBe("50 gp");
    expect(consumables.items[0].quantity).toBe(3);
  });

  it("includes armor AC in notes", () => {
    const items = [
      { id: "1", name: "Chain Mail", img: "", type: "equipment", system: { type: {}, price: {}, quantity: 1, weight: { value: 55 }, equipped: true, attunement: "", armor: { value: 16 } } },
    ];
    const groups = buildInventoryGroups(items);
    const equip = groups.find((g) => g.type === "equipment")!;
    expect(equip.items[0].notes).toBe("AC 16");
  });

  it("includes uses/charges in notes", () => {
    const items = [
      { id: "1", name: "Wand", img: "", type: "loot", system: { type: {}, price: {}, quantity: 1, weight: { value: 1 }, equipped: false, attunement: "", uses: { value: 5, max: 7 } } },
    ];
    const groups = buildInventoryGroups(items);
    const loot = groups.find((g) => g.type === "loot")!;
    expect(loot.items[0].notes).toBe("5/7 charges");
  });

  it("returns empty groups for missing types", () => {
    const groups = buildInventoryGroups([]);
    expect(groups).toHaveLength(5);
    expect(groups.every((g) => g.items.length === 0)).toBe(true);
  });
});

// ── buildConditionTypes ─────────────────────────────────────────────

describe("buildConditionTypes", () => {
  const statusEffects = [
    { id: "blinded", name: "Blinded", img: "icons/blinded.svg" },
    { id: "poisoned", label: "Poisoned", icon: "icons/poisoned.svg" },
    { id: "dead", name: "Dead", img: "icons/dead.svg" },
    { id: "prone", name: "Prone", img: "icons/prone.svg" },
  ];

  it("excludes the 'dead' condition", () => {
    const result = buildConditionTypes([], statusEffects);
    expect(result.find((c) => c.id === "dead")).toBeUndefined();
  });

  it("maps active conditions correctly", () => {
    const effects = [
      { statuses: new Set(["blinded"]), type: "condition" },
    ];
    const result = buildConditionTypes(effects, statusEffects);
    const blinded = result.find((c) => c.id === "blinded")!;
    expect(blinded.active).toBe(true);
    const poisoned = result.find((c) => c.id === "poisoned")!;
    expect(poisoned.active).toBe(false);
  });

  it("prefers name over label over id", () => {
    const result = buildConditionTypes([], statusEffects);
    const blinded = result.find((c) => c.id === "blinded")!;
    expect(blinded.label).toBe("Blinded");
    const poisoned = result.find((c) => c.id === "poisoned")!;
    expect(poisoned.label).toBe("Poisoned");
  });

  it("prefers img over icon", () => {
    const result = buildConditionTypes([], statusEffects);
    expect(result.find((c) => c.id === "blinded")!.icon).toBe("icons/blinded.svg");
    expect(result.find((c) => c.id === "poisoned")!.icon).toBe("icons/poisoned.svg");
  });

  it("handles empty inputs", () => {
    expect(buildConditionTypes([], [])).toEqual([]);
  });

  it("detects active via system.id match", () => {
    const effects = [
      { type: "condition", system: { id: "prone" }, statuses: new Set() },
    ];
    const result = buildConditionTypes(effects, statusEffects);
    expect(result.find((c) => c.id === "prone")!.active).toBe(true);
  });
});

// ── buildCurrency ───────────────────────────────────────────────────

describe("buildCurrency", () => {
  it("extracts all denominations", () => {
    const currency = buildCurrency({ pp: 5, gp: 100, ep: 0, sp: 25, cp: 50 });
    expect(currency).toEqual({ pp: 5, gp: 100, ep: 0, sp: 25, cp: 50 });
  });

  it("defaults missing denominations to 0", () => {
    const currency = buildCurrency({});
    expect(currency).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
  });

  it("handles null input", () => {
    const currency = buildCurrency(null);
    expect(currency).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
  });
});

// ── buildEncumbrance ────────────────────────────────────────────────

describe("buildEncumbrance", () => {
  it("extracts encumbrance values", () => {
    const enc = buildEncumbrance({ value: 45, max: 150, pct: 30 });
    expect(enc).toEqual({ value: 45, max: 150, pct: 30 });
  });

  it("defaults to standard values", () => {
    const enc = buildEncumbrance(null);
    expect(enc).toEqual({ value: 0, max: 150, pct: 0 });
  });
});
