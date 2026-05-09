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
  buildSpellcastingInfo,
  buildSpellsByActivation,
  buildSpellsByLevel,
  buildAttacks,
  buildActionFeatures,
  buildFeatureItem,
  buildFeatureGroups,
  LEVEL_LABELS,
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

  it("includes tool-type items in a Tools group", () => {
    const items = [
      { id: "1", name: "Thieves' Tools", img: "", type: "tool", system: { type: {}, price: { value: 25, denomination: "gp" }, quantity: 1, weight: { value: 1 }, equipped: true, attunement: "" } },
      { id: "2", name: "Herbalism Kit", img: "", type: "tool", system: { type: {}, price: { value: 5, denomination: "gp" }, quantity: 1, weight: { value: 3 }, equipped: false, attunement: "" } },
    ];
    const groups = buildInventoryGroups(items);
    const toolGroup = groups.find((g) => g.type === "tool")!;
    expect(toolGroup.label).toBe("Tools");
    expect(toolGroup.items).toHaveLength(2);
    expect(toolGroup.items[0].name).toBe("Thieves' Tools");
    expect(toolGroup.items[1].name).toBe("Herbalism Kit");
  });

  it("returns empty groups for missing types", () => {
    const groups = buildInventoryGroups([]);
    expect(groups).toHaveLength(6);
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

// ── buildSpellcastingInfo ───────────────────────────────────────────

describe("buildSpellcastingInfo", () => {
  const systemAbilities: Record<string, any> = {
    str: { mod: 0 }, dex: { mod: 2 }, con: { mod: 1 },
    int: { mod: 4 }, wis: { mod: 3 }, cha: { mod: 1 },
  };

  it("builds spellcasting stats from class items", () => {
    const classItems = [
      { name: "Wizard", system: { identifier: "wizard", spellcasting: { ability: "int" }, levels: 5 } },
    ];
    const result = buildSpellcastingInfo(classItems, systemAbilities, 3);
    expect(result.spellcasting).toHaveLength(1);
    expect(result.spellcasting[0]).toEqual({
      label: "Wizard",
      ability: "int",
      dc: 8 + 3 + 4, // 15
      attack: 3 + 4,  // 7
    });
  });

  it("detects prepared casters and sets showManageSpells", () => {
    const classItems = [
      { name: "Cleric", system: { identifier: "Cleric", spellcasting: { ability: "wis" }, levels: 3 } },
    ];
    const result = buildSpellcastingInfo(classItems, systemAbilities, 2);
    expect(result.showManageSpells).toBe(true);
    expect(result.isWizard).toBe(false);
  });

  it("detects wizard specifically", () => {
    const classItems = [
      { name: "Wizard", system: { identifier: "Wizard", spellcasting: { ability: "int" }, levels: 5 } },
    ];
    const result = buildSpellcastingInfo(classItems, systemAbilities, 3);
    expect(result.isWizard).toBe(true);
  });

  it("uses preparation.max when available", () => {
    const classItems = [
      { name: "Wizard", system: { identifier: "Wizard", spellcasting: { ability: "int", preparation: { max: 12 } }, levels: 8 } },
    ];
    const result = buildSpellcastingInfo(classItems, systemAbilities, 3);
    expect(result.maxPreparedSpells).toBe(12);
  });

  it("calculates maxPreparedSpells from abilityMod + classLevel when max is 0", () => {
    const classItems = [
      { name: "Wizard", system: { identifier: "Wizard", spellcasting: { ability: "int", preparation: { max: 0 } }, levels: 5 } },
    ];
    const result = buildSpellcastingInfo(classItems, systemAbilities, 3);
    expect(result.maxPreparedSpells).toBe(4 + 5); // int mod + level
  });

  it("returns 0 maxPreparedSpells for non-prepared casters", () => {
    const classItems = [
      { name: "Sorcerer", system: { identifier: "sorcerer", spellcasting: { ability: "cha" }, levels: 5 } },
    ];
    const result = buildSpellcastingInfo(classItems, systemAbilities, 3);
    expect(result.showManageSpells).toBe(false);
    expect(result.maxPreparedSpells).toBe(0);
  });

  it("handles classes without spellcasting", () => {
    const classItems = [
      { name: "Fighter", system: { identifier: "fighter", levels: 5 } },
    ];
    const result = buildSpellcastingInfo(classItems, systemAbilities, 2);
    expect(result.spellcasting).toHaveLength(0);
    expect(result.showManageSpells).toBe(false);
  });

  it("handles empty class items", () => {
    const result = buildSpellcastingInfo([], systemAbilities, 2);
    expect(result.spellcasting).toEqual([]);
    expect(result.showManageSpells).toBe(false);
    expect(result.maxPreparedSpells).toBe(0);
  });
});

// ── buildSpellsByActivation ─────────────────────────────────────────

describe("buildSpellsByActivation", () => {
  it("categorizes bonus action spells", () => {
    const spells = [
      { name: "Healing Word", system: { activation: { type: "bonus" }, level: 1 } },
    ];
    const result = buildSpellsByActivation(spells, LEVEL_LABELS);
    expect(result.bonus).toHaveLength(1);
    expect(result.bonus[0]).toEqual({ name: "Healing Word", level: 1, levelLabel: "1st Level" });
  });

  it("categorizes reaction spells", () => {
    const spells = [
      { name: "Shield", system: { activation: { type: "reaction" }, level: 1 } },
    ];
    const result = buildSpellsByActivation(spells, LEVEL_LABELS);
    expect(result.reaction).toHaveLength(1);
  });

  it("puts non-action/non-bonus/non-reaction into other", () => {
    const spells = [
      { name: "Find Familiar", system: { activation: { type: "hour" }, level: 1 } },
    ];
    const result = buildSpellsByActivation(spells, LEVEL_LABELS);
    expect(result.other).toHaveLength(1);
  });

  it("does not categorize action spells into any group", () => {
    const spells = [
      { name: "Fireball", system: { activation: { type: "action" }, level: 3 } },
    ];
    const result = buildSpellsByActivation(spells, LEVEL_LABELS);
    expect(result.bonus).toHaveLength(0);
    expect(result.reaction).toHaveLength(0);
    expect(result.other).toHaveLength(0);
  });

  it("adds ritual spells to the ritual group", () => {
    const props = new Set(["ritual"]);
    const spells = [
      { name: "Detect Magic", system: { activation: { type: "action" }, level: 1, properties: props } },
    ];
    const result = buildSpellsByActivation(spells, LEVEL_LABELS);
    expect(result.ritual).toHaveLength(1);
  });

  it("labels cantrips correctly", () => {
    const spells = [
      { name: "Fire Bolt", system: { activation: { type: "bonus" }, level: 0 } },
    ];
    const result = buildSpellsByActivation(spells, LEVEL_LABELS);
    expect(result.bonus[0].levelLabel).toBe("Cantrip");
  });

  it("handles empty spell list", () => {
    const result = buildSpellsByActivation([], LEVEL_LABELS);
    expect(result.bonus).toEqual([]);
    expect(result.reaction).toEqual([]);
    expect(result.other).toEqual([]);
    expect(result.ritual).toEqual([]);
  });
});

// ── buildSpellsByLevel ──────────────────────────────────────────────

describe("buildSpellsByLevel", () => {
  it("groups spells by level and sorts alphabetically", () => {
    const spells = [
      { id: "2", name: "Shield", img: "s.png", system: { level: 1, activation: { type: "reaction" }, range: {}, properties: new Set() } },
      { id: "1", name: "Magic Missile", img: "m.png", system: { level: 1, activation: { type: "action" }, range: { value: 120, units: "ft." }, properties: new Set(["vocal", "somatic"]) } },
    ];
    const result = buildSpellsByLevel(spells, LEVEL_LABELS);
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe(1);
    expect(result[0].label).toBe("1st Level");
    expect(result[0].spells[0].name).toBe("Magic Missile");
    expect(result[0].spells[1].name).toBe("Shield");
  });

  it("builds cast time abbreviations correctly", () => {
    const spells = [
      { id: "1", name: "Fireball", img: "", system: { level: 3, activation: { type: "action" }, range: {}, properties: new Set() } },
      { id: "2", name: "Healing Word", img: "", system: { level: 1, activation: { type: "bonus" }, range: {}, properties: new Set() } },
      { id: "3", name: "Shield", img: "", system: { level: 1, activation: { type: "reaction" }, range: {}, properties: new Set() } },
    ];
    const result = buildSpellsByLevel(spells, LEVEL_LABELS);
    const level1 = result.find((g) => g.level === 1)!;
    const level3 = result.find((g) => g.level === 3)!;
    expect(level1.spells.find((s) => s.name === "Healing Word")!.castTime).toBe("BA");
    expect(level1.spells.find((s) => s.name === "Shield")!.castTime).toBe("R");
    expect(level3.spells[0].castTime).toBe("A");
  });

  it("resolves range correctly", () => {
    const spells = [
      { id: "1", name: "Fireball", img: "", system: { level: 3, activation: { type: "action" }, range: { value: 150, units: "ft." }, properties: new Set() } },
      { id: "2", name: "Cure Wounds", img: "", system: { level: 1, activation: { type: "action" }, range: { units: "touch" }, properties: new Set() } },
      { id: "3", name: "Shield", img: "", system: { level: 1, activation: { type: "reaction" }, range: { units: "self" }, properties: new Set() } },
    ];
    const result = buildSpellsByLevel(spells, LEVEL_LABELS);
    const level3 = result.find((g) => g.level === 3)!;
    expect(level3.spells[0].range).toBe("150 ft.");
    const level1 = result.find((g) => g.level === 1)!;
    expect(level1.spells.find((s) => s.name === "Cure Wounds")!.range).toBe("Touch");
    expect(level1.spells.find((s) => s.name === "Shield")!.range).toBe("Self");
  });

  it("builds component strings from properties Set", () => {
    const spells = [
      { id: "1", name: "Fireball", img: "", system: { level: 3, activation: { type: "action" }, range: {}, properties: new Set(["vocal", "somatic", "material"]) } },
    ];
    const result = buildSpellsByLevel(spells, LEVEL_LABELS);
    expect(result[0].spells[0].components).toBe("V/S/M");
  });

  it("detects concentration and ritual flags", () => {
    const spells = [
      { id: "1", name: "Detect Magic", img: "", system: { level: 1, activation: { type: "action" }, range: {}, properties: new Set(["concentration", "ritual"]) } },
    ];
    const result = buildSpellsByLevel(spells, LEVEL_LABELS);
    expect(result[0].spells[0].concentration).toBe(true);
    expect(result[0].spells[0].ritual).toBe(true);
  });

  it("sorts levels numerically", () => {
    const spells = [
      { id: "1", name: "Wish", img: "", system: { level: 9, activation: { type: "action" }, range: {}, properties: new Set() } },
      { id: "2", name: "Fire Bolt", img: "", system: { level: 0, activation: { type: "action" }, range: {}, properties: new Set() } },
    ];
    const result = buildSpellsByLevel(spells, LEVEL_LABELS);
    expect(result[0].level).toBe(0);
    expect(result[1].level).toBe(9);
  });

  it("handles empty spell list", () => {
    expect(buildSpellsByLevel([], LEVEL_LABELS)).toEqual([]);
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

// ── buildActionFeatures ─────────────────────────────────────────────

describe("buildActionFeatures", () => {
  it("builds a single action feature with uses and pips", () => {
    const feats = [{
      id: "f1", name: "Second Wind", img: "sw.png", type: "feat",
      system: {
        activation: { type: "bonus" },
        uses: { value: 1, max: 1, spent: 0, recovery: [{ type: "sr" }] },
        description: { value: "<p>Heal yourself</p>" },
        activities: new Map(),
      },
    }];
    const result = buildActionFeatures(feats);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Second Wind");
    expect(result[0].activationType).toBe("bonus");
    expect(result[0].uses).toEqual({ value: 1, max: 1, spent: 0, per: "sr", remaining: 1 });
    expect(result[0].pips).toEqual([{ filled: true }]);
  });

  it("uses numeric display when max > 7", () => {
    const feats = [{
      id: "f1", name: "Ki Points", img: "", type: "feat",
      system: {
        activation: { type: "action" },
        uses: { value: 10, max: 10, spent: 2, recovery: [{ type: "lr" }] },
        description: { value: "" },
        activities: new Map(),
      },
    }];
    const result = buildActionFeatures(feats);
    expect(result[0].useNumericDisplay).toBe(true);
    expect(result[0].pips).toEqual([]);
  });

  it("skips feats without activation, uses, or activities", () => {
    const feats = [{
      id: "f1", name: "Passive Feat", img: "", type: "feat",
      system: { description: { value: "" }, activities: new Map() },
    }];
    const result = buildActionFeatures(feats);
    expect(result).toHaveLength(0);
  });

  it("expands multi-activity features into parent+children", () => {
    const activities = new Map();
    activities.set("a1", { id: "a1", name: "Slash", activation: { type: "action" }, description: { value: "A slash" } });
    activities.set("a2", { id: "a2", name: "Stab", activation: { type: "bonus" }, description: { value: "A stab" } });
    const feats = [{
      id: "f1", name: "Combat Maneuver", img: "cm.png", type: "feat",
      system: {
        activation: { type: "action" },
        uses: { value: 3, max: 3, spent: 1, recovery: [{ type: "sr" }] },
        description: { value: "<p>Use combat maneuvers</p>" },
        activities,
      },
    }];
    const result = buildActionFeatures(feats);
    expect(result).toHaveLength(3); // 1 parent + 2 children
    expect(result[0].isParent).toBe(true);
    expect(result[0].uses).not.toBeNull();
    expect(result[1].isChild).toBe(true);
    expect(result[1].name).toBe("Slash");
    expect(result[1].uses).toBeNull();
    expect(result[2].isChild).toBe(true);
    expect(result[2].name).toBe("Stab");
  });

  it("includes feat with uses but 'other' activation type", () => {
    const feats = [{
      id: "f1", name: "Lucky", img: "", type: "feat",
      system: {
        activation: { type: "special" },
        uses: { value: 3, max: 3, spent: 0, recovery: [{ type: "lr" }] },
        description: { value: "" },
        activities: new Map(),
      },
    }];
    const result = buildActionFeatures(feats);
    expect(result).toHaveLength(1);
    expect(result[0].activationType).toBe("other");
  });

  it("excludes feat with 'other' activation and no uses", () => {
    const feats = [{
      id: "f1", name: "Passive", img: "", type: "feat",
      system: {
        activation: { type: "minute" },
        description: { value: "" },
        activities: new Map(),
      },
    }];
    const result = buildActionFeatures(feats);
    expect(result).toHaveLength(0);
  });

  it("truncates long descriptions", () => {
    const longDesc = "<p>" + "A".repeat(100) + "</p>";
    const feats = [{
      id: "f1", name: "Verbose", img: "", type: "feat",
      system: {
        activation: { type: "action" },
        description: { value: longDesc },
        activities: new Map(),
      },
    }];
    const result = buildActionFeatures(feats);
    expect(result[0].hasLongDescription).toBe(true);
    expect(result[0].truncatedDescription.length).toBeLessThanOrEqual(81); // 80 + "…"
  });

  it("synthesizes child descriptions from activity data when no description", () => {
    const activities = new Map();
    activities.set("a1", { id: "a1", name: "Strike", activation: { type: "action" }, damage: { parts: [{ formula: "2d6" }] }, range: { value: 5, units: "ft." } });
    activities.set("a2", { id: "a2", name: "Parry", activation: { type: "reaction" } });
    const feats = [{
      id: "f1", name: "Battle Master", img: "", type: "feat",
      system: {
        activation: { type: "action" },
        uses: { value: 4, max: 4, spent: 0, recovery: [] },
        description: { value: "" },
        activities,
      },
    }];
    const result = buildActionFeatures(feats);
    const strike = result.find((r) => r.name === "Strike")!;
    expect(strike.truncatedDescription).toContain("Damage: 2d6");
    expect(strike.truncatedDescription).toContain("Range: 5 ft.");
  });
});

// ── buildFeatureItem ────────────────────────────────────────────────

describe("buildFeatureItem", () => {
  it("builds a feature item with uses and pips", () => {
    const item = {
      id: "f1", name: "Action Surge", img: "as.png",
      system: {
        uses: { value: 1, max: 1, spent: 0, recovery: [{ type: "sr" }] },
        description: { value: "<p>Extra action</p>" },
        requirements: "Fighter 2",
        activities: new Map(),
      },
    };
    const result = buildFeatureItem(item);
    expect(result.name).toBe("Action Surge");
    expect(result.source).toBe("Fighter 2");
    expect(result.uses).toEqual({ value: 1, max: 1, spent: 0, per: "sr", remaining: 1 });
    expect(result.pips).toEqual([{ filled: true }]);
    expect(result.useNumericDisplay).toBe(false);
  });

  it("returns null uses for items without limited uses", () => {
    const item = {
      id: "f1", name: "Passive", img: "",
      system: { description: { value: "" }, requirements: "", activities: new Map() },
    };
    const result = buildFeatureItem(item);
    expect(result.uses).toBeNull();
    expect(result.pips).toEqual([]);
  });

  it("extracts sub-actions from activities with activation types", () => {
    const activities = new Map();
    activities.set("a1", { id: "a1", name: "Smite", activation: { type: "action" }, description: { value: "Divine smite" } });
    activities.set("a2", { id: "a2", name: "Lay on Hands", activation: { type: "bonus" }, description: { value: "" } });
    const item = {
      id: "f1", name: "Paladin Features", img: "",
      system: { description: { value: "" }, requirements: "", activities },
    };
    const result = buildFeatureItem(item);
    expect(result.subActions).toHaveLength(2);
    expect(result.subActions[0].name).toBe("Smite");
    expect(result.subActions[0].activationLabel).toBe("Action");
    expect(result.subActions[1].activationLabel).toBe("Bonus Action");
  });

  it("truncates feature description at 80 chars", () => {
    const item = {
      id: "f1", name: "Verbose", img: "",
      system: { description: { value: "<p>" + "B".repeat(100) + "</p>" }, requirements: "", activities: new Map() },
    };
    const result = buildFeatureItem(item);
    expect(result.hasLongDescription).toBe(true);
    expect(result.truncatedDescription.endsWith("…")).toBe(true);
  });

  it("truncates sub-action descriptions at 60 chars", () => {
    const activities = new Map();
    activities.set("a1", { id: "a1", name: "Long Act", activation: { type: "action" }, description: { value: "C".repeat(80) } });
    const item = {
      id: "f1", name: "Test", img: "",
      system: { description: { value: "" }, requirements: "", activities },
    };
    const result = buildFeatureItem(item);
    expect(result.subActions[0].truncatedDescription.length).toBeLessThanOrEqual(61);
  });
});

// ── buildFeatureGroups ──────────────────────────────────────────────

describe("buildFeatureGroups", () => {
  it("groups feat items by type value", () => {
    const feats = [
      { id: "1", name: "Action Surge", img: "", system: { type: { value: "class" }, description: { value: "" }, requirements: "", activities: new Map() } },
      { id: "2", name: "Great Weapon Master", img: "", system: { type: { value: "feat" }, description: { value: "" }, requirements: "", activities: new Map() } },
      { id: "3", name: "Darkvision", img: "", system: { type: { value: "race" }, description: { value: "" }, requirements: "", activities: new Map() } },
    ];
    const groups = buildFeatureGroups(feats);
    expect(groups).toHaveLength(3);
    expect(groups[0].type).toBe("class");
    expect(groups[0].label).toBe("Class Features");
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].name).toBe("Action Surge");
    expect(groups[1].type).toBe("feat");
    expect(groups[1].items).toHaveLength(1);
    expect(groups[2].type).toBe("race");
    expect(groups[2].label).toBe("Species Traits");
    expect(groups[2].items).toHaveLength(1);
  });

  it("puts items with no type value into the feat group", () => {
    const feats = [
      { id: "1", name: "Untyped", img: "", system: { type: {}, description: { value: "" }, requirements: "", activities: new Map() } },
    ];
    const groups = buildFeatureGroups(feats);
    const featGroup = groups.find((g) => g.type === "feat")!;
    expect(featGroup.items).toHaveLength(1);
    expect(featGroup.items[0].name).toBe("Untyped");
  });

  it("returns empty groups when no feats", () => {
    const groups = buildFeatureGroups([]);
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.items.length === 0)).toBe(true);
  });
});
