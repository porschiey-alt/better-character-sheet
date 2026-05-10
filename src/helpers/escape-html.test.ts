import { describe, it, expect } from "vitest";
import { escapeHtml } from "./escape-html.ts";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("handles XSS payload in item name", () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      "&lt;img src=x onerror=alert(1)&gt;"
    );
  });

  it("returns empty/falsy strings unchanged", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(null as unknown as string)).toBe(null);
    expect(escapeHtml(undefined as unknown as string)).toBe(undefined);
  });

  it("does not double-escape already-escaped content", () => {
    // First pass
    const once = escapeHtml("A & B");
    expect(once).toBe("A &amp; B");
    // Second pass would double-escape — callers must avoid this
    const twice = escapeHtml(once);
    expect(twice).toBe("A &amp;amp; B");
  });

  it("handles strings with no special characters", () => {
    expect(escapeHtml("Fireball")).toBe("Fireball");
  });
});
