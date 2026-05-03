/**
 * Fetches the DnD Beyond backdrop (background) image URL for a character.
 *
 * Strategy:
 *  1. Read from our own cached flag (flags.better-character-sheet.backdropUrl)
 *  2. On ddb-importer character import/update, hook into
 *     "ddb-importer.characterProcessDataComplete" to capture the backdrop URL
 *     from the raw DDB data and persist it in our flag — no external fetch needed.
 */

const MODULE_ID = "better-character-sheet";

/**
 * Return the stored DnD Beyond backdrop URL for the given actor, or null.
 */
export function getDDBBackdropUrl(actor: any): string | null {
  return actor.flags?.[MODULE_ID]?.backdropUrl ?? null;
}

/**
 * Extract the best backdrop URL from a DDB decorations object.
 */
export function pickBackdropUrl(decorations: any): string | null {
  if (!decorations) return null;
  return (
    decorations.largeBackdropAvatarUrl ??
    decorations.backdropAvatarUrl ??
    decorations.defaultBackdrop?.largeBackdropAvatarUrl ??
    decorations.defaultBackdrop?.backdropAvatarUrl ??
    null
  );
}

/**
 * Register a hook that listens for ddb-importer's character import/update
 * and persists the backdrop URL into our own actor flag.
 * Call this once at module init.
 */
export function registerDDBBackdropHook(): void {
  Hooks.on(
    "ddb-importer.characterProcessDataComplete",
    async ({ actor, ddbCharacter }: { actor: any; ddbCharacter: any }) => {
      try {
        const decorations =
          ddbCharacter?.source?.ddb?.character?.decorations ??
          ddbCharacter?.source?.ddb?.decorations;
        const url = pickBackdropUrl(decorations);

        // Only update if the value actually changed
        const current = actor.flags?.[MODULE_ID]?.backdropUrl ?? null;
        if (url !== current) {
          await actor.update({
            [`flags.${MODULE_ID}.backdropUrl`]: url,
          });
          console.log(
            `better-character-sheet | ${url ? "Saved" : "Cleared"} DDB backdrop for ${actor.name}`
          );
        }
      } catch (err) {
        console.warn(
          "better-character-sheet | Failed to extract DDB backdrop from import data",
          err
        );
      }
    }
  );
}
