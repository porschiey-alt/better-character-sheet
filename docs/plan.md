# Better Character Sheet — FoundryVTT Module Plan

## Problem
The default dnd5e character sheet in FoundryVTT is hard to navigate, unintuitive, and causes slowdown during play. We're building a replacement module that mirrors the DnDBeyond character sheet layout and UX.

## Target Environment
- **FoundryVTT**: v14 (API v2 — ApplicationV2 / HandlebarsApplicationMixin)
- **dnd5e system**: v5.3.2
- **Tech stack**: TypeScript + SCSS + esbuild
- **Module ID**: `better-character-sheet`

## Reference
- DnDBeyond layout screenshot: `docs/charSheetExample.png`

---

## Progress

### ✅ Phase 1: Module Scaffolding — COMPLETE
- Module config (`module.json`), build toolchain (esbuild + TS + SCSS), `.gitignore`
- Sheet class (`BetterCharacterSheet`) extending dnd5e's `CharacterActorSheet`
- Factory pattern to resolve parent class at `init` time
- Registered via `DocumentSheetConfig.registerSheet()` as default character sheet
- ddb-importer compatibility (v1-compat render hook, `input[name=name]` anchor)
- Playwright test helper for automated visual verification

### ✅ Phase 2: Core Layout & Styling — COMPLETE
### ✅ Phase 3: Left & Middle Columns — COMPLETE
- Root template with 3-column DnDBeyond-style layout
- Header: portrait, name (editable), race/class/level, Short Rest / Long Rest buttons
- Ability scores horizontal row (6 abilities with modifier + score)
- Stats bar: proficiency, walking speed, inspiration toggle, HP bar, AC
- Sidebar: saving throws, passive scores, senses, proficiencies
- Skills: all 18 skills with proficiency dots, governing ability, and modifier
- DnDBeyond-inspired dark theme (dark backgrounds, gold accents, proper typography)
- All data built from `context.system` since parent only prepares per-PART data lazily

### 🔲 Phase 4: Right Column Tabs — NEXT
- Tab navigation UI (Actions · Spells · Inventory · Features · Background · Notes · Extras)
- Actions tab with sub-filters, attack table, combat actions, usage trackers
- Spells tab with spell slot tracking, spell list grouped by level
- Inventory tab with equipment list, attunement, encumbrance
- Features & Traits tab listing class features, feats, racial traits
- Background tab with personality, ideals, bonds, flaws, backstory
- Notes tab with freeform rich-text editing
- Extras tab for misc content

### 🔲 Phase 5: Interactivity & Polish
- Dice rolling (ability checks, saves, skills, attacks, damage)
- HP management (heal/damage buttons, temp HP)
- Rest button wiring (Short Rest / Long Rest workflows)
- Usage/resource trackers (spell slots, Channel Divinity pips)
- Item interactions (drag-and-drop, edit on click, equip/attune)
- Responsive polish (window resizing, transitions)

### 🔲 Phase 6: Testing & Validation
- Integration testing in Foundry
- Performance validation

---

## Architecture
```
src/
  module.ts              — Entry point: register sheet, preload partials
  sheets/
    BetterCharacterSheet.ts  — Sheet class (factory pattern, extends CharacterActorSheet)
  styles/
    better-character-sheet.scss  — Full dark theme stylesheet
templates/
  character-sheet.hbs        — Root layout (includes partials)
  parts/
    header.hbs               — Portrait, name, class, rest buttons
    ability-scores-row.hbs   — Horizontal 6-ability row
    stats-bar.hbs            — Proficiency, speed, inspiration, HP, AC
    sidebar.hbs              — Saves, passives, senses, proficiencies
    skills.hbs               — 18-skill list
  tabs/                      — (Phase 4)
test/
  foundry-helper.mjs         — Playwright: join Foundry, open sheet, screenshot
  debug-sheet.mjs            — Playwright: open sheet + capture errors
```

## Key Decisions
- **Extends `CharacterActorSheet`** — inherits dnd5e data preparation, only overrides rendering
- **Skips parent `_onRender`** — goes directly to `ApplicationV2.prototype._onRender` because parent expects its own DOM elements
- **Emits v1-compat render hook** — allows ddb-importer and similar modules to inject buttons
- **Builds all template data from `context.system`** — parent's per-PART lazy context doesn't populate our single PART
- **`keepNames: true`** in esbuild — preserves class names for Foundry's hook system
- **Playwright testing** via "Tester" user — automated visual verification without interrupting GM session

## Notes
- `hotReload` is enabled in Foundry config
- Module symlink: `FoundryVTT\Data\modules\better-character-sheet` → `C:\source\better-character-sheet`
- Browser "Disable cache" in DevTools is recommended during development

