---
id: foundry-module-dev
problem_category: general
source: manual
affected_files:
  - src/module.ts
  - src/sheets/BetterCharacterSheet.ts
  - module.json
  - templates/**/*.hbs
keywords:
  - FoundryVTT
  - ApplicationV2
  - dnd5e
  - sheet
  - module
  - activities
  - rendering
  - hooks
effectiveness_score: 90
read_count: 0
created_at: 2026-04-01
last_used_at:
repository: porschiey-alt/better-character-sheet
---
# Skill: FoundryVTT Module Development

## When to Use
When working on any FoundryVTT module code, templates, or styles in this repository.

## Key Knowledge

### FoundryVTT v14 ApplicationV2 API
- Sheet classes extend `foundry.applications.api.ApplicationV2` (or a subclass)
- Use `static PARTS` to define template sections (not `get template()`)
- Use `static DEFAULT_OPTIONS` with `foundry.utils.mergeObject(Parent.DEFAULT_OPTIONS, ...)` — never spread
- Register sheets via `foundry.applications.apps.DocumentSheetConfig.registerSheet()`
- Actions are registered in `DEFAULT_OPTIONS.actions` and triggered by `data-action` attributes in HTML
- Header controls use `_getHeaderControls()` method
- The `_onRender(context, options)` method fires after HTML is inserted into the DOM

### dnd5e v5.3.2 Specifics
- Access system classes via `globalThis.dnd5e.applications.actor.CharacterActorSheet`
- System is loaded BEFORE modules, but ESM evaluation order means globals may not be ready at import time
- The Activity system replaces legacy `actionType`: check `item.system.activities.values()` for attack/save/damage types
- Spell preparation: check `system.preparation.mode` ("prepared", "always", "innate", "atwill", "pact") and `system.preparation.prepared`
- Use `dnd5e-formatModifier` and `dnd5e-numberFormat` Handlebars helpers (NOT generic Foundry helpers)
- Actor rolling API: `actor.rollAbilityCheck({ability})`, `actor.rollSavingThrow({ability})`, `actor.rollSkill({skill})`, `actor.rollDeathSave()`, `actor.rollInitiativeDialog()`
- Item usage: `activity.use({event, legacy: false})` or `item.use({event, legacy: false})`
- HP: `actor.applyDamage(amount)` for damage, `actor.applyDamage(-amount)` for healing
- Rests: `actor.shortRest()`, `actor.longRest()`
- Inspiration: `actor.update({"system.attributes.inspiration": !current})`
- Spell slots: `actor.update({"system.spells.spell${level}.value": newVal})`
- Feature uses: `item.update({"system.uses.value": newVal})`

### CSS Override Hierarchy
Foundry and dnd5e have aggressive CSS. Override order:
1. Foundry core CSS (lowest)
2. dnd5e system CSS (`dnd5e.css`)
3. Module CSS (ours — `better-character-sheet.css`)
4. Inline styles (highest — sometimes needed for resize handle, etc.)

Key overrides needed:
- `.standard-form` uses grid layout → force `display: flex !important; flex-direction: column !important`
- `.window-content` has `margin-top: -65px` → reset to `0 !important`
- `.window-header` has `margin-bottom: 30px` → reset to `0 !important`
- `thead` backgrounds from Foundry → `background: transparent !important`
- Use `!important` when overriding Foundry/dnd5e core styles

### Template Data Paths
Key Handlebars paths available in context:
- `actor.name`, `actor.img` — identity
- `system.abilities.str.mod`, `.value`, `.save`, `.proficient` — abilities
- `system.skills.acr.total`, `.value`, `.ability`, `.passive` — skills
- `system.attributes.hp.value`, `.max`, `.effectiveMax`, `.temp`, `.pct` — HP
- `system.attributes.ac.value` — Armor Class
- `system.attributes.prof` — proficiency bonus
- `system.attributes.movement.walk` — speed
- `system.attributes.inspiration` — boolean
- `system.attributes.init.total` — initiative modifier
- `system.spells.spell${1-9}.value`, `.max` — spell slots
- `system.details.trait`, `.ideal`, `.bond`, `.flaw` — personality
- `system.details.biography.value` — backstory HTML
- `actor.items` — all items (filter by `.type`: "spell", "weapon", "feat", "equipment", etc.)

### Module Compatibility
- ddb-importer hooks into `getHeaderControlsBaseActorSheet` and `render{SheetName}`
- It checks `config.constructor.name === "CharacterActorSheet"` — our custom class name won't match
- Fallback: ddb-importer looks for `input[name='name']` in the DOM to inject its button
- Always emit v1-compat render hooks with `{owner, actor, data, editable}` shape
- `keepNames: true` in esbuild preserves class names for hook routing
