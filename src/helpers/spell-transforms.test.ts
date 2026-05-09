import { describe, it, expect } from "vitest";
import {
  isSpellAvailable,
  buildSpellSlots,
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
