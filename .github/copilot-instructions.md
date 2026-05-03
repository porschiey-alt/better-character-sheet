# Copilot Instructions for better-character-sheet

## Project Overview
This is a FoundryVTT module that replaces the default dnd5e (D&D 5th Edition) character sheet with a DnDBeyond-inspired dark-themed alternative. It extends the dnd5e `CharacterActorSheet` class, inheriting all data preparation while completely replacing the rendering layer.

## Tech Stack
- **TypeScript** + **SCSS** compiled via **esbuild**
- **FoundryVTT v14** (ApplicationV2 / HandlebarsApplicationMixin)
- **dnd5e system v5.3.2**
- **Handlebars** templates (`.hbs`)
- **Playwright** for automated visual testing

## Build & Test Commands
- `npm run build` — Build JS + CSS to `dist/`
- `npm run watch` — Watch mode for development
- `npm run clean` — Remove `dist/`
- `node test/foundry-helper.mjs` — Playwright: join Foundry, open sheet, screenshot
- `node test/debug-sheet.mjs` — Playwright: open sheet + capture errors

## Architecture

### Key Files
- `src/module.ts` — Entry point. Registers sheet at `init` hook, preloads templates.
- `src/sheets/BetterCharacterSheet.ts` — Main sheet class. Factory pattern (`createBetterCharacterSheet()`) resolves parent class at runtime.
- `src/styles/better-character-sheet.scss` — All styling. Uses CSS custom properties (`--bcs-accent`, `--bcs-bg-dark`, etc.) for theming.
- `templates/character-sheet.hbs` — Root template that includes partials.
- `templates/parts/*.hbs` — Header, ability scores, stats bar, sidebar, skills.
- `templates/tabs/*.hbs` — Actions, spells, inventory, features, background, notes, extras.
- `module.json` — FoundryVTT module manifest.

### Critical Design Patterns

#### Factory Pattern for Sheet Class
The dnd5e `CharacterActorSheet` is not available at ESM evaluation time. We use a factory function called during the `init` hook:
```typescript
export function createBetterCharacterSheet(): any {
  const Parent = globalThis.dnd5e?.applications?.actor?.CharacterActorSheet;
  return class BetterCharacterSheet extends Parent { ... };
}
```
**NEVER** use a Proxy pattern or top-level `const dnd5e = globalThis.dnd5e` — the global isn't ready at module load time.

#### Skipping Parent _onRender
We skip dnd5e's `_onRender` chain because it expects DOM elements from its own templates (attunement containers, sidebar, meters). Instead, call `ApplicationV2.prototype._onRender` directly:
```typescript
const baseProto = foundry.applications.api.ApplicationV2.prototype;
await baseProto._onRender.call(this, context, options);
```

#### Window Header Fix (CRITICAL)
Foundry's `standard-form` class uses CSS grid that hides the window-header behind window-content. The dnd5e CSS sets `margin-top: -65px` on `.window-content` and `margin-bottom: 30px` on `.window-header`. Our fix:
```scss
&.standard-form {
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}
.window-content { margin-top: 0 !important; }
.window-header { margin-bottom: 0 !important; }
```
**This was the hardest bug to find.** Always verify the header is not overlapping content after layout changes.

#### Data Preparation
The parent's `_prepareContext` only populates data per-PART lazily. Since we use a single PART (`sheet`), we must build ALL template data ourselves from `context.system`:
- Abilities, saves, skills — built from `system.abilities` and `system.skills`
- Spells — filtered by `isSpellAvailable()` (prepared/always/cantrip only)
- Attacks — from equipped weapons + spells with attack/save+damage activities
- Features — from feat items grouped by `system.type.value`

#### dnd5e v5.3.2 Activity System
Spells and items use an **Activities** system (not the legacy `actionType`). To check if a spell has an attack:
```typescript
for (const act of item.system.activities.values()) {
  if (act.type === "attack") { /* has attack roll */ }
  if (act.type === "save" && act.damage?.parts?.[0]?.formula) { /* save + damage */ }
}
```
**Do NOT use** `item.system.actionType` — it doesn't exist in v5.3.2.

#### ddb-importer Compatibility
We emit a v1-style render hook for modules like ddb-importer:
```typescript
Hooks.callAll(`render${this.constructor.name}`, this, $(this.element), {
  owner: this.document.isOwner, actor: this.document, ...
});
```
The template must include `<input name="name">` for ddb-importer's fallback button injection.

### esbuild Configuration
- `keepNames: true` is required — Foundry's hook system relies on `constructor.name`
- Separate CSS build from SCSS entry point
- `format: "esm"`, `platform: "browser"`

## CSS/Styling Rules
- Use CSS custom properties (`--bcs-accent`, `--bcs-bg-dark`, etc.) for any color that should respond to theming
- Use `!important` sparingly but it IS needed to override Foundry/dnd5e core styles
- Always test with Playwright after CSS changes — Foundry has aggressive caching
- The `compressStatic` Foundry option caches files server-side; disable it during development
- Use dnd5e's Handlebars helpers: `dnd5e-formatModifier` and `dnd5e-numberFormat` (NOT generic `numberFormat`)

## Common Pitfalls
1. **Variable hoisting** — `const` declarations used before definition cause `Cannot access 'X' before initialization` at runtime. esbuild minification makes these errors cryptic (single letters). Always define variables before use.
2. **Foundry caching** — Even with browser cache disabled, Foundry's `compressStatic` can serve stale files. Restart Foundry if changes don't appear.
3. **Symlink for development** — The module directory is a symlink: `FoundryVTT/Data/modules/better-character-sheet` → `C:\source\better-character-sheet`. If it breaks (e.g., after uninstalling), recreate it.
4. **Playwright testing** — The "Tester" user (no password, player role) is used for automated testing. Always dismiss the UserConfig dialog before interacting. Use `actor.sheet.render(true)` via `page.evaluate()` to open sheets reliably.
5. **Resize handle** — Foundry sets `position: absolute` on the resize handle. Set `z-index` via inline JS in `_onRender`, not CSS, because Foundry's styles override CSS classes.

## Theme System
Per-character theming stored as actor flags:
- `actor.getFlag("better-character-sheet", "themeAccent")` — accent color hex
- `actor.getFlag("better-character-sheet", "themeBg")` — background tint hex
Applied via CSS custom properties in `_onRender`. Background colors are darkened (multiplied by ~0.82) to maintain dark theme.

## Release Process
- Push a tag: `git tag v0.X.Y && git push origin v0.X.Y`
- GitHub Actions (`.github/workflows/release.yml`) builds and creates a release
- Manifest URL for installation: `https://github.com/porschiey-alt/better-character-sheet/releases/latest/download/module.json`
