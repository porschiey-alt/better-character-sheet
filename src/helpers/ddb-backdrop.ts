/**
 * Fetches the DnD Beyond backdrop (background) image for a character
 * by reading the DDB character ID from ddb-importer's actor flags
 * and calling the public DDB character API.
 */

const DDB_CHARACTER_API =
  "https://character-service.dndbeyond.com/character/v5/character";

/** Module-level cache so we only fetch once per character per session. */
const backdropCache = new Map<string, string | null>();

/**
 * Attempt to retrieve the DnD Beyond backdrop image URL for the given actor.
 * Returns `null` if the actor was not imported via ddb-importer or the fetch fails.
 */
export async function fetchDDBBackdrop(
  actor: any
): Promise<string | null> {
  const ddbFlags = actor.flags?.ddbimporter?.dndbeyond;
  if (!ddbFlags) return null;

  const characterId =
    ddbFlags.characterId ??
    extractIdFromUrl(ddbFlags.roUrl) ??
    extractIdFromUrl(ddbFlags.url);
  if (!characterId) return null;

  const cacheKey = String(characterId);
  if (backdropCache.has(cacheKey)) return backdropCache.get(cacheKey) ?? null;

  try {
    const res = await fetch(`${DDB_CHARACTER_API}/${cacheKey}`);
    if (!res.ok) {
      backdropCache.set(cacheKey, null);
      return null;
    }

    const json = await res.json();
    const dec = json?.data?.decorations;
    const url =
      dec?.largeBackdropAvatarUrl ??
      dec?.backdropAvatarUrl ??
      dec?.defaultBackdrop?.largeBackdropAvatarUrl ??
      dec?.defaultBackdrop?.backdropAvatarUrl ??
      null;

    backdropCache.set(cacheKey, url);
    return url;
  } catch (err) {
    console.warn("better-character-sheet | Failed to fetch DDB backdrop", err);
    backdropCache.set(cacheKey, null);
    return null;
  }
}

function extractIdFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const match = url.match(/characters\/(\d+)/);
  return match ? match[1] : null;
}
