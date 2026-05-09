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

// ── barrel re-export smoke tests ────────────────────────────────────
// Detailed tests live in per-category test files. These verify the
// barrel module correctly re-exports every public function.

describe("data-transforms barrel re-exports", () => {
  it("re-exports buildAbilities", () => {
    expect(typeof buildAbilities).toBe("function");
  });

  it("re-exports buildSaves", () => {
    expect(typeof buildSaves).toBe("function");
  });

  it("re-exports buildSkills", () => {
    expect(typeof buildSkills).toBe("function");
  });

  it("re-exports resolveFormula", () => {
    expect(typeof resolveFormula).toBe("function");
  });

  it("re-exports isSpellAvailable", () => {
    expect(typeof isSpellAvailable).toBe("function");
  });

  it("re-exports buildSpellSlots", () => {
    expect(typeof buildSpellSlots).toBe("function");
  });

  it("re-exports buildInventoryGroups", () => {
    expect(typeof buildInventoryGroups).toBe("function");
  });

  it("re-exports buildConditionTypes", () => {
    expect(typeof buildConditionTypes).toBe("function");
  });

  it("re-exports buildCurrency", () => {
    expect(typeof buildCurrency).toBe("function");
  });

  it("re-exports buildEncumbrance", () => {
    expect(typeof buildEncumbrance).toBe("function");
  });
});
