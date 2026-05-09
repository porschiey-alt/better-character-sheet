import { describe, it, expect } from "vitest";
import {
  buildInventoryGroups,
  buildCurrency,
  buildEncumbrance,
} from "../helpers/inventory-transforms.ts";

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
