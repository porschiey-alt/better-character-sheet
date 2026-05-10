/**
 * Pure data-transformation helpers for condition/status effects.
 */

export interface ConditionTypeVM {
  id: string;
  label: string;
  icon: string;
  active: boolean;
}

/**
 * Build condition type view models from status effects and actor effects.
 */
export function buildConditionTypes(
  actorEffects: any[],
  statusEffects: any[],
): ConditionTypeVM[] {
  return (statusEffects || [])
    .filter((s: any) => s.id && s.id !== "dead" && s.id !== "exhaustion")
    .map((s: any) => {
      const isActive = (actorEffects || []).some(
        (e: any) => e.statuses?.has(s.id) || (e.type === "condition" && e.system?.id === s.id)
      );
      return {
        id: s.id,
        label: s.name || s.label || s.id,
        icon: s.img || s.icon || "",
        active: isActive,
      };
    });
}
