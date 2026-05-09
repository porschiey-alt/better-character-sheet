/**
 * Pure data-transformation helpers for action features and feature groups.
 */

export interface ActionFeatureUsesVM {
  value: number;
  max: number;
  spent: number;
  per: string;
  remaining: number;
}

export interface ActionFeatureVM {
  id: string;
  activityId?: string;
  name: string;
  img: string;
  description: string;
  truncatedDescription: string;
  hasLongDescription: boolean;
  activationType: string;
  activationLabel: string;
  uses: ActionFeatureUsesVM | null;
  pips: { filled: boolean }[];
  useNumericDisplay?: boolean;
  isParent?: boolean;
  isChild?: boolean;
}

export interface FeatureItemSubActionVM {
  id: string;
  name: string;
  activationLabel: string;
  truncatedDescription: string;
  itemId: string;
}

export interface FeatureItemVM {
  id: string;
  name: string;
  img: string;
  source: string;
  description: string;
  truncatedDescription: string;
  hasLongDescription: boolean;
  uses: ActionFeatureUsesVM | null;
  pips: { filled: boolean }[];
  useNumericDisplay: boolean;
  subActions: FeatureItemSubActionVM[];
}

export interface FeatureGroupVM {
  type: string;
  label: string;
  items: FeatureItemVM[];
}

// ── Shared helpers for uses/pips/description truncation ─────────────

function buildUsesVM(system: any): ActionFeatureUsesVM | null {
  if (!system.uses?.max) return null;
  return {
    value: system.uses.value ?? 0,
    max: system.uses.max,
    spent: Number(system.uses.spent) || 0,
    per: system.uses.recovery?.[0]?.type || "",
    remaining: system.uses.max - (Number(system.uses.spent) || 0),
  };
}

function truncateHtml(html: string, maxLen: number): { fullDesc: string; textOnly: string; truncated: string; hasLongDescription: boolean } {
  const fullDesc = html || "";
  const textOnly = fullDesc.replace(/<[^>]*>/g, "").trim();
  const truncated = textOnly.length > maxLen
    ? textOnly.substring(0, maxLen) + "…"
    : textOnly;
  return { fullDesc, textOnly, truncated, hasLongDescription: textOnly.length > maxLen };
}

/**
 * Build action features (feats with activation or uses, with descriptions + pips).
 */
export function buildActionFeatures(featItems: any[]): ActionFeatureVM[] {
  const actionFeatures: ActionFeatureVM[] = [];
  const typeMap: Record<string, string> = {
    action: "action", bonus: "bonus", reaction: "reaction",
    minute: "other", hour: "other", special: "other",
  };
  const labelMap: Record<string, string> = {};

  for (const i of featItems) {
    if (!(i.system.uses?.max || i.system.activation?.type || i.system.activities?.size > 0)) {
      continue;
    }

    const uses = buildUsesVM(i.system);
    const useNumericDisplay = uses ? uses.max > 7 : false;
    const pips: { filled: boolean }[] = [];
    if (uses && !useNumericDisplay) {
      for (let p = 0; p < uses.max; p++) {
        pips.push({ filled: p >= uses.spent });
      }
    }

    const { fullDesc, textOnly, truncated } = truncateHtml(i.system.description?.value, 80);

    // Build per-item label map entries for minute/hour activation
    labelMap["minute"] = `${i.system.activation?.value || ""} Minutes`;
    labelMap["hour"] = `${i.system.activation?.value || ""} Hours`;

    // Expand: create an entry per activity that has an activation type
    const activities = i.system.activities;
    const activitiesWithType: any[] = [];
    if (activities && activities.size > 0) {
      for (const act of activities.values()) {
        const at = act.activation?.type;
        if (at && typeMap[at] && typeMap[at] !== "other") {
          activitiesWithType.push(act);
        }
      }
    }

    if (activitiesWithType.length > 1) {
      // Parent entry with uses/pips
      const parentActType = activitiesWithType[0].activation?.type || "action";
      actionFeatures.push({
        id: i.id,
        name: i.name,
        img: i.img,
        description: fullDesc,
        truncatedDescription: truncated,
        hasLongDescription: textOnly.length > 80,
        activationType: typeMap[parentActType] || "action",
        activationLabel: "",
        uses,
        pips,
        useNumericDisplay,
        isParent: true,
      });
      // Child activity entries without uses
      for (const act of activitiesWithType) {
        const at = act.activation?.type || "other";
        let actDesc = act.description?.value || "";
        if (!actDesc) {
          const parts: string[] = [];
          if (act.activation?.type) {
            const atLabel: Record<string, string> = { action: "Action", bonus: "Bonus Action", reaction: "Reaction" };
            parts.push(atLabel[act.activation.type] || act.activation.type);
          }
          if (act.damage?.parts?.length) {
            const dmg = act.damage.parts[0];
            if (dmg.formula) parts.push(`Damage: ${dmg.formula}`);
          }
          if (act.range?.value) parts.push(`Range: ${act.range.value} ${act.range.units || "ft."}`);
          actDesc = parts.join(" · ");
        }
        const actText = truncateHtml(actDesc, 80);
        actionFeatures.push({
          id: i.id,
          activityId: act.id || act._id,
          name: act.name || i.name,
          img: i.img,
          description: actDesc || fullDesc,
          truncatedDescription: actText.truncated,
          hasLongDescription: actText.hasLongDescription,
          activationType: typeMap[at] || "other",
          activationLabel: "",
          uses: null,
          pips: [],
          isChild: true,
        });
      }
    } else {
      // Single activity or no activities — one entry for the whole item
      let actType = i.system.activation?.type || "";
      if (!actType && activitiesWithType.length === 1) {
        actType = activitiesWithType[0].activation?.type || "";
      }
      actType = actType || "other";
      const activationType = typeMap[actType] || "other";

      if (activationType !== "other" || uses) {
        actionFeatures.push({
          id: i.id,
          name: i.name,
          img: i.img,
          description: fullDesc,
          truncatedDescription: truncated,
          hasLongDescription: textOnly.length > 80,
          activationType,
          activationLabel: labelMap[actType] || "",
          uses,
          pips,
          useNumericDisplay,
        });
      }
    }
  }
  return actionFeatures;
}

/**
 * Build a single feature item view model (shared by feature groups).
 */
export function buildFeatureItem(i: any): FeatureItemVM {
  const uses = buildUsesVM(i.system);
  const useNumericDisplay = uses ? uses.max > 7 : false;
  const pips: { filled: boolean }[] = [];
  if (uses && !useNumericDisplay) {
    for (let p = 0; p < uses.max; p++) {
      pips.push({ filled: p >= uses.spent });
    }
  }
  const { fullDesc, textOnly, truncated } = truncateHtml(i.system.description?.value, 80);

  const activationLabels: Record<string, string> = {
    action: "Action", bonus: "Bonus Action", reaction: "Reaction",
  };
  const subActions: FeatureItemSubActionVM[] = [];
  if (i.system.activities?.size > 0) {
    for (const act of i.system.activities.values()) {
      const actType = act.activation?.type || act.type;
      if (activationLabels[actType]) {
        const actDesc = act.description?.value || "";
        const actText = truncateHtml(actDesc, 60);
        subActions.push({
          id: act.id || act._id,
          name: act.name || i.name,
          activationLabel: activationLabels[actType],
          truncatedDescription: actText.truncated,
          itemId: i.id,
        });
      }
    }
  }

  return {
    id: i.id,
    name: i.name,
    img: i.img,
    source: i.system.requirements || "",
    description: fullDesc,
    truncatedDescription: truncated,
    hasLongDescription: textOnly.length > 80,
    uses,
    pips,
    useNumericDisplay,
    subActions,
  };
}

/**
 * Build feature groups from feat items, grouped by type value.
 */
export function buildFeatureGroups(featItems: any[]): FeatureGroupVM[] {
  return [
    {
      type: "class",
      label: "Class Features",
      items: featItems
        .filter((i: any) => i.system.type?.value === "class")
        .map(buildFeatureItem),
    },
    {
      type: "feat",
      label: "Feats",
      items: featItems
        .filter((i: any) => !i.system.type?.value || i.system.type?.value === "feat")
        .map(buildFeatureItem),
    },
    {
      type: "race",
      label: "Species Traits",
      items: featItems
        .filter((i: any) => i.system.type?.value === "race")
        .map(buildFeatureItem),
    },
  ];
}
