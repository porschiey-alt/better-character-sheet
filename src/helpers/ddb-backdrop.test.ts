import { describe, it, expect } from "vitest";
import { getDDBBackdropUrl, pickBackdropUrl } from "./ddb-backdrop.ts";

describe("getDDBBackdropUrl", () => {
  it("returns the stored backdrop URL", () => {
    const actor = {
      flags: {
        "better-character-sheet": {
          backdropUrl: "https://example.com/backdrop.jpg",
        },
      },
    };
    expect(getDDBBackdropUrl(actor)).toBe("https://example.com/backdrop.jpg");
  });

  it("returns null when no flag is set", () => {
    expect(getDDBBackdropUrl({ flags: {} })).toBeNull();
  });

  it("returns null when flags is undefined", () => {
    expect(getDDBBackdropUrl({})).toBeNull();
  });

  it("returns null when backdropUrl is null", () => {
    const actor = {
      flags: { "better-character-sheet": { backdropUrl: null } },
    };
    expect(getDDBBackdropUrl(actor)).toBeNull();
  });

  it("returns null when backdropUrl is undefined", () => {
    const actor = {
      flags: { "better-character-sheet": {} },
    };
    expect(getDDBBackdropUrl(actor)).toBeNull();
  });
});

describe("pickBackdropUrl", () => {
  it("prefers largeBackdropAvatarUrl", () => {
    const decorations = {
      largeBackdropAvatarUrl: "https://large.jpg",
      backdropAvatarUrl: "https://regular.jpg",
      defaultBackdrop: {
        largeBackdropAvatarUrl: "https://default-large.jpg",
      },
    };
    expect(pickBackdropUrl(decorations)).toBe("https://large.jpg");
  });

  it("falls back to backdropAvatarUrl", () => {
    const decorations = {
      largeBackdropAvatarUrl: null,
      backdropAvatarUrl: "https://regular.jpg",
      defaultBackdrop: {
        largeBackdropAvatarUrl: "https://default-large.jpg",
      },
    };
    expect(pickBackdropUrl(decorations)).toBe("https://regular.jpg");
  });

  it("falls back to defaultBackdrop.largeBackdropAvatarUrl", () => {
    const decorations = {
      defaultBackdrop: {
        largeBackdropAvatarUrl: "https://default-large.jpg",
        backdropAvatarUrl: "https://default-regular.jpg",
      },
    };
    expect(pickBackdropUrl(decorations)).toBe("https://default-large.jpg");
  });

  it("falls back to defaultBackdrop.backdropAvatarUrl", () => {
    const decorations = {
      defaultBackdrop: {
        backdropAvatarUrl: "https://default-regular.jpg",
      },
    };
    expect(pickBackdropUrl(decorations)).toBe("https://default-regular.jpg");
  });

  it("returns null when no URLs are available", () => {
    expect(pickBackdropUrl({})).toBeNull();
  });

  it("returns null for null input", () => {
    expect(pickBackdropUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(pickBackdropUrl(undefined)).toBeNull();
  });
});
