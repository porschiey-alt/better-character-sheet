import { describe, it, expect } from "vitest";
import {
  buildActionFeatures,
  buildFeatureItem,
  buildFeatureGroups,
} from "../helpers/feature-transforms.ts";

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
