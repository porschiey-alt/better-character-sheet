/**
 * Pure data-transformation helpers for inventory, currency, and encumbrance.
 */

export interface InventoryItemVM {
  id: string;
  name: string;
  img: string;
  quantity: number;
  weight: number;
  equipped: boolean;
  attuned: boolean;
  cost: string;
  subtype: string;
  notes: string;
}

export interface InventoryGroupVM {
  type: string;
  label: string;
  items: InventoryItemVM[];
}

/**
 * Build inventory groups from actor items.
 * Filters out natural weapons (e.g. Unarmed Strike).
 */
export function buildInventoryGroups(items: any[]): InventoryGroupVM[] {
  const invTypes = ["weapon", "equipment", "consumable", "tool", "container", "loot"];
  const invLabels: Record<string, string> = {
    weapon: "Weapons",
    equipment: "Equipment",
    consumable: "Consumables",
    tool: "Tools",
    container: "Containers",
    loot: "Loot",
  };

  return invTypes.map((type) => ({
    type,
    label: invLabels[type] || type,
    items: items
      .filter((i: any) => i.type === type && i.system.type?.value !== "natural")
      .map((i: any) => {
        const price = i.system.price;
        const cost = price?.value ? `${price.value} ${price.denomination || "gp"}` : "";
        const subtype = i.system.type?.label || i.system.armor?.type || "";
        let notes = "";
        if (i.system.armor?.value) notes = `AC ${i.system.armor.value}`;
        else if (i.system.damage?.base?.formula) notes = i.system.damage.base.formula;
        if (i.system.uses?.max)
          notes += notes
            ? `, ${i.system.uses.value}/${i.system.uses.max} charges`
            : `${i.system.uses.value}/${i.system.uses.max} charges`;

        return {
          id: i.id,
          name: i.name,
          img: i.img,
          quantity: i.system.quantity ?? 1,
          weight: i.system.weight?.value ?? 0,
          equipped: !!i.system.equipped,
          attuned: i.system.attunement === "attuned",
          cost,
          subtype,
          notes,
        };
      }),
  }));
}

/**
 * Build currency view model from system data.
 */
export function buildCurrency(systemCurrency: any): Record<string, number> {
  return {
    pp: systemCurrency?.pp ?? 0,
    gp: systemCurrency?.gp ?? 0,
    ep: systemCurrency?.ep ?? 0,
    sp: systemCurrency?.sp ?? 0,
    cp: systemCurrency?.cp ?? 0,
  };
}

/**
 * Build encumbrance view model from system data.
 */
export function buildEncumbrance(systemEncumbrance: any): { value: number; max: number; pct: number } {
  return {
    value: systemEncumbrance?.value ?? 0,
    max: systemEncumbrance?.max ?? 150,
    pct: systemEncumbrance?.pct ?? 0,
  };
}
