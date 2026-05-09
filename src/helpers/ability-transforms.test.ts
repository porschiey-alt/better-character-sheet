import { describe, it, expect } from "vitest";
import { buildAbilities, buildSaves, buildSkills } from "../helpers/ability-transforms.ts";

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
