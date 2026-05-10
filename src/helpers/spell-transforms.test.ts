import { describe, it, expect } from "vitest";
import {
  isSpellAvailable,
  buildSpellSlots,
  buildSpellcastingInfo,
  buildSpellsByActivation,
  buildSpellsByLevel,
  LEVEL_LABELS,
} from "../helpers/spell-transforms.ts";

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
    const result = buildSpellsByLevel(spells, LEVEL_LABELS, []);
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
    const result = buildSpellsByLevel(spells, LEVEL_LABELS, []);
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
    const result = buildSpellsByLevel(spells, LEVEL_LABELS, []);
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
    const result = buildSpellsByLevel(spells, LEVEL_LABELS, []);
    expect(result[0].spells[0].components).toBe("V/S/M");
  });

  it("detects concentration and ritual flags", () => {
    const spells = [
      { id: "1", name: "Detect Magic", img: "", system: { level: 1, activation: { type: "action" }, range: {}, properties: new Set(["concentration", "ritual"]) } },
    ];
    const result = buildSpellsByLevel(spells, LEVEL_LABELS, []);
    expect(result[0].spells[0].concentration).toBe(true);
    expect(result[0].spells[0].ritual).toBe(true);
  });

  it("sorts levels numerically", () => {
    const spells = [
      { id: "1", name: "Wish", img: "", system: { level: 9, activation: { type: "action" }, range: {}, properties: new Set() } },
      { id: "2", name: "Fire Bolt", img: "", system: { level: 0, activation: { type: "action" }, range: {}, properties: new Set() } },
    ];
    const result = buildSpellsByLevel(spells, LEVEL_LABELS, []);
    expect(result[0].level).toBe(0);
    expect(result[1].level).toBe(9);
  });

  it("handles empty spell list", () => {
    expect(buildSpellsByLevel([], LEVEL_LABELS, [])).toEqual([]);
  });

  it("shows attack bonus for spells with attack activities", () => {
    const spells = [
      {
        id: "1", name: "Fire Bolt", img: "", system: {
          level: 0, activation: { type: "action" }, range: { value: 120, units: "ft." },
          properties: new Set(["vocal", "somatic"]),
          activities: new Map([["a1", { type: "attack" }]]),
        },
      },
    ];
    const scInfo = [{ label: "Wizard", ability: "int", dc: 15, attack: 7 }];
    const result = buildSpellsByLevel(spells, LEVEL_LABELS, scInfo);
    expect(result[0].spells[0].hitDc).toBe("+7");
  });

  it("shows save DC for spells with save activities", () => {
    const spells = [
      {
        id: "1", name: "Fireball", img: "", system: {
          level: 3, activation: { type: "action" }, range: { value: 150, units: "ft." },
          properties: new Set(["vocal", "somatic", "material"]),
          activities: new Map([["a1", { type: "save" }]]),
        },
      },
    ];
    const scInfo = [{ label: "Wizard", ability: "int", dc: 15, attack: 7 }];
    const result = buildSpellsByLevel(spells, LEVEL_LABELS, scInfo);
    expect(result[0].spells[0].hitDc).toBe("DC 15");
  });

  it("attack takes precedence over save when both present", () => {
    const spells = [
      {
        id: "1", name: "Chromatic Orb", img: "", system: {
          level: 1, activation: { type: "action" }, range: { value: 90, units: "ft." },
          properties: new Set(["vocal", "somatic", "material"]),
          activities: new Map([
            ["a1", { type: "save" }],
            ["a2", { type: "attack" }],
          ]),
        },
      },
    ];
    const scInfo = [{ label: "Sorcerer", ability: "cha", dc: 14, attack: 6 }];
    const result = buildSpellsByLevel(spells, LEVEL_LABELS, scInfo);
    expect(result[0].spells[0].hitDc).toBe("+6");
  });

  it("shows dash for spells with no activities", () => {
    const spells = [
      {
        id: "1", name: "Shield", img: "", system: {
          level: 1, activation: { type: "reaction" }, range: { units: "self" },
          properties: new Set(["vocal", "somatic"]),
        },
      },
    ];
    const scInfo = [{ label: "Wizard", ability: "int", dc: 15, attack: 7 }];
    const result = buildSpellsByLevel(spells, LEVEL_LABELS, scInfo);
    expect(result[0].spells[0].hitDc).toBe("—");
  });
});
