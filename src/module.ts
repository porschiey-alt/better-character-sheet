import { createBetterCharacterSheet } from "./sheets/BetterCharacterSheet.ts";
import { registerDDBBackdropHook } from "./helpers/ddb-backdrop.ts";

const MODULE_ID = "better-character-sheet";
const TEMPLATES_PATH = `modules/${MODULE_ID}/templates`; // relative to Data/modules

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

  // Listen for ddb-importer character imports to capture backdrop images
  registerDDBBackdropHook();

  // Add "Better Sheet" button to the default CharacterActorSheet header
  // so users can switch back from classic view
  Hooks.on("getHeaderControlsCharacterActorSheet", (config: any, controls: any[]) => {
    if (!config.document?.isOwner) return;
    controls.unshift({
      icon: "fas fa-exchange-alt",
      label: "Better Sheet",
      action: "switchToBetterSheet",
      ownership: "OWNER",
    });
    config.options.actions["switchToBetterSheet"] = function (this: any) {
      const actor = this.document;
      this.close();
      actor.setFlag("core", "sheetClass", `${MODULE_ID}.BetterCharacterSheet`);
      setTimeout(() => actor.sheet.render(true), 100);
    };
  });

  console.log("better-character-sheet | Sheet registered");
});
