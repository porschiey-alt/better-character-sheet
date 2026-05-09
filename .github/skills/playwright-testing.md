---
id: playwright-testing
problem_category: testing
source: manual
affected_files:
  - test/*.mjs
keywords:
  - playwright
  - testing
  - screenshot
  - visual
  - browser
  - automation
  - debug
effectiveness_score: 75
read_count: 0
created_at: 2026-04-01
last_used_at:
repository: porschiey-alt/better-character-sheet
---
# Skill: Visual Testing with Playwright

## When to Use
When verifying visual changes to the character sheet, debugging CSS issues, or checking DOM structure.

## Setup
- Playwright is a dev dependency: `npm install --save-dev playwright`
- Chromium browser installed via `npx playwright install chromium`
- Test user "Tester" exists in Foundry (no password, player role, owns "Refuge" character)
- Foundry runs on `http://localhost:30000`

## Test Scripts
- `test/foundry-helper.mjs` — Join as Tester, open sheet via sidebar, screenshot
- `test/debug-sheet.mjs` — Open sheet via API, check DOM, capture errors
- `test/screenshot-tabs.mjs` — Screenshot all 7 tabs sequentially


## Common Patterns

### Opening a Sheet
```javascript
// Via Foundry API (most reliable)
await page.evaluate(async () => {
  const actor = game.actors?.get("ACTOR_ID");
  if (actor) await actor.sheet.render(true);
});
await page.waitForTimeout(6000); // Wait for render
```

### Dismissing Dialogs
```javascript
// Notifications
await page.evaluate(() => {
  document.querySelectorAll("#notifications .notification").forEach(n => n.remove());
});

// UserConfig dialog
await page.evaluate(() => {
  const btn = document.querySelector('[id*="UserConfig"] [data-action="close"]');
  if (btn) btn.click();
});
```

### Checking Computed Styles
```javascript
const styles = await page.evaluate(() => {
  const el = document.querySelector(".my-element");
  const s = getComputedStyle(el);
  return { background: s.backgroundColor, margin: s.margin };
});
```

### Checking Bounding Rects (for overlap bugs)
```javascript
const rects = await page.evaluate(() => {
  const header = document.querySelector(".window-header").getBoundingClientRect();
  const content = document.querySelector(".window-content").getBoundingClientRect();
  return { overlap: header.bottom - content.top };
});
```

## Critical Lessons

### 1. Always Verify with Screenshots
Don't assume CSS changes work just because the build succeeds. Always take a Playwright screenshot and VIEW IT before telling the user it's fixed. Many CSS issues (overlapping headers, invisible elements, wrong colors) are only visible in screenshots.

### 2. Foundry Caching
Foundry's `compressStatic` option caches static files server-side. Even with browser cache disabled, the server may serve stale JS/CSS. Verify by checking:
```javascript
const response = await fetch("http://localhost:30000/modules/.../dist/module.js");
const size = (await response.text()).length;
// Compare with actual file size
```
If sizes don't match, Foundry needs a restart.

### 3. Symlink Fragility
The dev symlink (`FoundryVTT/Data/modules/better-character-sheet` → source dir) breaks when:
- The module is uninstalled/reinstalled via Foundry UI
- Foundry updates
Recreate with: `New-Item -ItemType SymbolicLink -Path $link -Target $source`

### 4. Double-Click vs API
Double-clicking actor entries in the sidebar is unreliable in Playwright (timing, overlapping notifications). Using `actor.sheet.render(true)` via `page.evaluate()` is more reliable.

### 5. Wait Times
- After joining game: 6000ms
- After opening sheet: 6000-8000ms
- After dismissing dialogs: 500-1000ms
- After tab click: 500ms
