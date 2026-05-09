---
id: css-debugging
problem_category: styling
source: manual
affected_files:
  - src/styles/better-character-sheet.scss
  - src/sheets/BetterCharacterSheet.ts
keywords:
  - CSS
  - styling
  - layout
  - override
  - visual
  - debug
  - window-header
  - z-index
  - theming
effectiveness_score: 80
read_count: 0
created_at: 2026-04-01
last_used_at:
repository: porschiey-alt/better-character-sheet
---
# Skill: CSS Debugging for FoundryVTT

## When to Use
When fixing visual bugs, layout issues, or CSS override conflicts in this module.

## The Core Challenge
FoundryVTT and dnd5e have multiple layers of CSS that aggressively style application windows. Our module CSS must override these without breaking Foundry's window management (drag, resize, close, minimize).

## CSS Specificity Hierarchy (most to least specific)
1. Inline styles (set via JS in `_onRender`)
2. `!important` rules in module CSS
3. dnd5e system CSS (`dnd5e.css`)
4. Foundry core CSS
5. Browser defaults

## Known Foundry/dnd5e CSS Traps

### 1. Window Header Hidden Behind Content
**Symptom**: No title bar, can't close/move/resize the sheet
**Cause**: `.standard-form` uses CSS grid; dnd5e sets `margin-top: -65px` on `.window-content` and `margin-bottom: 30px` on `.window-header`
**Fix**:
```scss
&.standard-form {
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}
.window-content { margin-top: 0 !important; }
.window-header { margin-bottom: 0 !important; }
```
**Debugging approach**: Check bounding rects of `.window-header` and `.window-content` — if content.top < header.bottom, they're overlapping.

### 2. Vertical Tabs Sidebar
**Symptom**: Transparent gap on the left side of the sheet
**Cause**: dnd5e's `vertical-tabs` class creates a sidebar tab panel
**Fix**:
```scss
&.vertical-tabs {
  .window-content { grid-template-columns: 1fr !important; }
  > .window-content > .tabs-right,
  > .window-content > .sidebar-tabs { display: none !important; }
}
```

### 3. Table Header Crimson Background
**Symptom**: `thead` rows have dark red/crimson background
**Cause**: Foundry core sets background colors on `thead` and `th`
**Fix**:
```scss
table th, table thead th, thead, table thead {
  background: transparent !important;
  background-color: transparent !important;
}
table thead tr { background: transparent !important; }
```

### 4. Resize Handle Buried
**Symptom**: Can't resize the sheet, handle hidden behind scrollbar
**Cause**: `.window-resize-handle` has `position: absolute` from Foundry with default z-index
**Fix**: Set z-index via inline JS in `_onRender` (CSS classes get overridden):
```typescript
const handle = this.element.querySelector(".window-resize-handle");
if (handle) { handle.style.zIndex = "30"; }
```

### 5. CSS Custom Property Limitations
**Symptom**: Gradient backgrounds don't work via CSS variables
**Cause**: `background` shorthand with complex `var()` fallbacks (especially gradients) has browser inconsistencies
**Fix**: Split into `background-color` and `background-image`:
```scss
background-color: var(--bcs-bg-dark) !important;
background-image: var(--bcs-bg-gradient-img, none) !important;
```

## Debugging Workflow
1. **Playwright screenshot** — take a screenshot, actually look at it
2. **Computed styles** — use `getComputedStyle()` via Playwright to check what's actually applied
3. **Bounding rects** — use `getBoundingClientRect()` to check for overlaps
4. **CSS rule inspection** — find which rules match an element and what they set
5. **Inline style check** — check `element.getAttribute("style")` for Foundry-injected styles
6. **Served file check** — verify Foundry serves the latest file (compare sizes)

## Theming
- CSS custom properties: `--bcs-accent`, `--bcs-accent-dim`, `--bcs-bg-dark`, `--bcs-bg-card`, `--bcs-bg-card-alt`
- Set defaults in SCSS: `--bcs-accent: #{$gold};`
- Override at runtime via `element.style.setProperty("--bcs-accent", color)`
- When replacing SCSS variables with CSS vars, use find/replace carefully — don't replace the variable DEFINITION, only the USAGE in property values
