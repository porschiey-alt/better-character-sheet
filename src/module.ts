import { createBetterCharacterSheet } from "./sheets/BetterCharacterSheet.ts";

const MODULE_ID = "better-character-sheet";
const TEMPLATES_PATH = `modules/${MODULE_ID}/templates`;

// Register the sheet when Foundry initializes.
// At `init` time, dnd5e globals are available so we can safely extend its classes.
Hooks.once("init", () => {
  const SheetClass = createBetterCharacterSheet();

  const DocumentSheetConfig =
    foundry.applications.apps.DocumentSheetConfig;

  DocumentSheetConfig.registerSheet(Actor, MODULE_ID, SheetClass, {
    types: ["character"],
    makeDefault: true,
    label: "Better Character Sheet",
  });

  // Pre-load partial templates
  loadTemplates([
    `${TEMPLATES_PATH}/parts/header.hbs`,
    `${TEMPLATES_PATH}/parts/ability-scores-row.hbs`,
    `${TEMPLATES_PATH}/parts/stats-bar.hbs`,
    `${TEMPLATES_PATH}/parts/sidebar.hbs`,
    `${TEMPLATES_PATH}/parts/skills.hbs`,
    `${TEMPLATES_PATH}/tabs/actions.hbs`,
    `${TEMPLATES_PATH}/tabs/spells.hbs`,
    `${TEMPLATES_PATH}/tabs/inventory.hbs`,
    `${TEMPLATES_PATH}/tabs/features.hbs`,
    `${TEMPLATES_PATH}/tabs/background.hbs`,
    `${TEMPLATES_PATH}/tabs/notes.hbs`,
    `${TEMPLATES_PATH}/tabs/extras.hbs`,
  ]);

  console.log("better-character-sheet | Sheet registered");
});
