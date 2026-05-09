import { describe, it, expect } from "vitest";
import { resolveFormula } from "../helpers/attack-transforms.ts";

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
