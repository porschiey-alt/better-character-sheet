import { describe, it, expect } from "vitest";
import { buildConditionTypes } from "../helpers/condition-transforms.ts";

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
