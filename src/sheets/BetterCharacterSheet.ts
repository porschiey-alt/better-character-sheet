import { getDDBBackdropUrl } from "../helpers/ddb-backdrop.ts";
import { escapeHtml } from "../helpers/escape-html.ts";
import {
  buildAbilities,
  buildSaves,
  buildSkills,
  resolveFormula,
  isSpellAvailable,
  buildSpellSlots,
  buildInventoryGroups,
  buildConditionTypes,
  buildCurrency,
  buildEncumbrance,
  buildSpellcastingInfo,
  buildSpellsByActivation,
  buildSpellsByLevel,
  buildAttacks,
  buildActionFeatures,
  buildFeatureGroups,
  LEVEL_LABELS,
} from "../helpers/data-transforms.ts";
import type { ResolvedWeaponData } from "../helpers/data-transforms.ts";

/**
 * BetterCharacterSheet — extends the dnd5e CharacterActorSheet,
 * inheriting all data preparation and system logic,
 * while completely replacing the rendering layer.
 *
 * This factory is called at `init` time when dnd5e globals are available.
 */
export function createBetterCharacterSheet(): any {
  const Parent = (globalThis as any).dnd5e?.applications?.actor
    ?.CharacterActorSheet;

  if (!Parent) {
    throw new Error(
      "better-character-sheet | Could not find dnd5e CharacterActorSheet. Is the dnd5e system active?"
    );
  }

  return class BetterCharacterSheet extends Parent {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
      Parent.DEFAULT_OPTIONS,
      {
        classes: ["better-character-sheet", "dnd5e", "character"],
        position: {
          width: 1100,
          height: 780,
          top: 50,
        },
        window: {
          resizable: true,
          minimizable: true,
        },
        actions: {
          shortRest: BetterCharacterSheet.#onShortRest,
          longRest: BetterCharacterSheet.#onLongRest,
          heal: BetterCharacterSheet.#onHeal,
          damage: BetterCharacterSheet.#onDamage,
          toggleClassicSheet: BetterCharacterSheet.#onToggleClassicSheet,
        },
      },
      { inplace: false }
    );

    static PARTS = {
      sheet: {
        template:
          "modules/better-character-sheet/templates/character-sheet.hbs",
      },
    };

    // No sidebar tabs — we manage our own tab UI
    static TABS: never[] = [];

    // Persist active tab across re-renders
    _bcsActiveTab = "actions";
    // Persist scroll position across re-renders
    _bcsScrollTop = 0;
    // Persist manage panel state across re-renders
    _bcsManagePanelOpen = false;
    _bcsLearnPanelOpen = false;
    _bcsManageScrollTop = 0;
    /**
     * Adjust an item's pending uses count in the given direction.
     * Returns the new state, or null if the item/uses are invalid.
     */
    private _adjustItemUses(
      itemId: string,
      direction: "increment" | "decrement"
    ): { newSpent: number; usesMax: number } | null {
      const item = this.document.items.get(itemId);
      if (!item) return null;
      const usesMax = Number(item.system.uses?.max) || 0;
      if (!usesMax) return null;

      const currentSpent = this._pendingUsesChanges.has(itemId)
        ? this._pendingUsesChanges.get(itemId)!
        : (Number(item.system.uses?.spent) || 0);

      const newSpent = direction === "increment"
        ? Math.min(currentSpent + 1, usesMax)
        : Math.max(currentSpent - 1, 0);

      this._pendingUsesChanges.set(itemId, newSpent);
      return { newSpent, usesMax };
    }

    // Pending state maps — cleared each render, flushed on tab/panel change or close
    _pendingUsesChanges = new Map<string, number>();
    _pendingPrep = new Map<string, boolean>();
    _pendingAddDocs: any[] = [];
    _pendingAddIds = new Set<string>();

    // Save scroll position before DOM is replaced
    override async _preRender(context: any, options: any) {
      await super._preRender(context, options);
      const tabContent = this.element?.querySelector(".bcs-tab-content") as HTMLElement;
      if (tabContent) this._bcsScrollTop = tabContent.scrollTop;
      const manageBody = this.element?.querySelector(".bcs-manage-body") as HTMLElement;
      if (manageBody) this._bcsManageScrollTop = manageBody.scrollTop;
    }
    override async _prepareContext(options: any) {
      const context = await super._prepareContext(options);
      const system = context.system;
      const actor = context.actor;

      // DnD Beyond backdrop image (stored by our ddb-importer hook)
      const backdropUrl = getDDBBackdropUrl(this.document);

      // Build ability scores for the horizontal row
      const abilityLabels: Record<string, string> = {};
      for (const k of ["str", "dex", "con", "int", "wis", "cha"]) {
        abilityLabels[k] = CONFIG.DND5E.abilities[k]?.label ?? k;
      }
      const abilities = buildAbilities(system.abilities, abilityLabels);

      // Build saving throws
      const saves = buildSaves(system.abilities);

      // Build skills array sorted alphabetically
      const skillLabels: Record<string, string> = {};
      for (const k of Object.keys(system.skills || {})) {
        skillLabels[k] = CONFIG.DND5E.skills[k]?.label ?? k;
      }
      const skills = buildSkills(system.skills || {}, skillLabels);

      // Portrait
      const portrait = {
        src: actor.img || "icons/svg/mystery-man.svg",
      };

      // Species (from actor items)
      const speciesItem = actor.items?.find(
        (i: any) => i.type === "race" || i.type === "species"
      );
      const species = speciesItem
        ? { name: speciesItem.name }
        : null;

      // Class label from items
      const classItems = actor.items?.filter(
        (i: any) => i.type === "class"
      ) || [];
      const classLabel = classItems
        .map(
          (c: any) =>
            `${c.name} ${c.system?.levels || ""}`
        )
        .join(" / ");

      // Senses
      const sensesData = system.attributes?.senses;
      const senses: { label: string; value: string }[] = [];
      if (sensesData?.ranges) {
        for (const [key, val] of Object.entries(sensesData.ranges)) {
          if (val) senses.push({ label: key.charAt(0).toUpperCase() + key.slice(1), value: `${val} ft` });
        }
      }

      // Traits / proficiencies
      const traits: Record<string, string> = {};
      const traitData = system.traits || {};
      for (const key of ["armor", "weapon", "languages"] as const) {
        const t = traitData[key];
        if (t?.value?.size) {
          traits[key] = [...t.value].join(", ");
        } else if (t?.label) {
          traits[key] = t.label;
        }
      }

      // Spellcasting info
      const prof = system.attributes.prof ?? 0;
      const scInfo = buildSpellcastingInfo(classItems, system.abilities, prof);
      const { spellcasting, showManageSpells, isWizard, maxPreparedSpells } = scInfo;

      // Spell level labels (used by both attacks and spells sections)
      const levelLabels = LEVEL_LABELS;

      // Pre-resolve weapon data (getRollData is a Foundry method — keep it here)
      const weapons: ResolvedWeaponData[] = actor.items
        .filter((i: any) => i.type === "weapon" && i.system.equipped)
        .map((i: any) => {
          let dmgFormula = i.system.damage?.base?.formula || "0";
          const rollData = i.getRollData?.() || {};
          dmgFormula = resolveFormula(dmgFormula, rollData);
          return {
            id: i.id,
            name: i.name,
            img: i.img,
            rangeValue: i.system.range?.value,
            rangeUnits: i.system.range?.units,
            attackFlat: i.system.attack?.flat,
            damageFormula: dmgFormula,
          };
        });

      // Available spells (prepared/always/cantrip)
      const allSpellItems = actor.items.filter(
        (i: any) => i.type === "spell"
      );
      const spellItems = allSpellItems.filter(isSpellAvailable);

      // Build attacks from weapons AND attack spells
      const attacks = buildAttacks(weapons, spellItems, spellcasting, levelLabels, classLabel);

      // Build action features
      const featItems = actor.items.filter((i: any) => i.type === "feat");
      const actionFeatures = buildActionFeatures(featItems);

      // Categorize spells by activation type for the action tab sections
      const spellsByActivation = buildSpellsByActivation(spellItems, levelLabels);

      // Build spells grouped by level
      const spellsByLevel = buildSpellsByLevel(spellItems, levelLabels);

      // Spell slots
      const spellSlots = buildSpellSlots(system.spells || {});

      // Build inventory groups
      const inventoryGroups = buildInventoryGroups([...actor.items]);
      const hasInventory = inventoryGroups.some((g) => g.items.length > 0);

      // Encumbrance
      const encumbrance = buildEncumbrance(system.attributes?.encumbrance);

      // Feature groups with descriptions and pips
      const featureGroups = buildFeatureGroups(featItems);
      const hasFeatures = featureGroups.some((g) => g.items.length > 0);

      // Death saves — show when HP is 0
      const showDeathSaves = (system.attributes?.hp?.value ?? 1) === 0;

      // Currency data for editing panel
      const currency = buildCurrency(system.currency);

      // Attunement — items that require attunement
      const attunableItems = actor.items
        .filter((i: any) => i.system.attunement && i.system.attunement !== "none" && i.system.attunement !== "")
        .map((i: any) => ({
          id: i.id,
          name: i.name,
          img: i.img,
          attuned: i.system.attuned ?? (i.system.attunement === "attuned"),
        }));
      const attunementMax = system.attributes?.attunement?.max ?? 3;
      const attunementCount = attunableItems.filter((i: any) => i.attuned).length;

      // Resistances/Immunities for extras tab
      const dr = system.traits?.dr;
      const di = system.traits?.di;
      const ci = system.traits?.ci;
      const resistances = dr?.value ? [...dr.value] : [];
      const immunities = di?.value ? [...di.value] : [];
      const conditionImmunities = ci?.value ? [...ci.value] : [];

      // Active conditions on the actor
      const conditions = actor.effects
        ?.filter((e: any) =>
          (e.type === "condition" || e.statuses?.size > 0) &&
          !e.statuses?.has("exhaustion") &&
          !(e.type === "condition" && e.system?.id === "exhaustion")
        )
        ?.map((e: any) => e.name) || [];

      // All available conditions for the conditions panel
      const conditionTypes = buildConditionTypes(
        actor.effects ? [...actor.effects] : [],
        CONFIG.statusEffects || [],
      );
      const exhaustionLevel = system.attributes?.exhaustion || 0;
      const hasDefenses = resistances.length > 0 || immunities.length > 0 ||
        conditionImmunities.length > 0 || conditions.length > 0 || exhaustionLevel > 0;

      return {
        ...context,
        abilities,
        saves,
        skills,
        portrait,
        species,
        senses,
        traits,
        labels: { ...(context.labels || {}), class: classLabel },
        // Tab data
        attacks,
        actionFeatures,
        bonusSpells: spellsByActivation.bonus,
        reactionSpells: spellsByActivation.reaction,
        otherSpells: spellsByActivation.other,
        ritualSpells: spellsByActivation.ritual,
        spellcasting,
        spellSlots,
        spellsByLevel,
        showManageSpells,
        isWizard,
        maxPreparedSpells,
        inventoryGroups,
        hasInventory,
        encumbrance,
        featureGroups,
        hasFeatures,
        resistances,
        immunities,
        conditionImmunities,
        conditions,
        conditionTypes,
        exhaustionLevel,
        hasDefenses,
        showDeathSaves,
        currency,
        attunableItems,
        attunementMax,
        attunementCount,
        backdropUrl,
        themeAccent: actor.getFlag("better-character-sheet", "themeAccent") || "#c8a85c",
        themeBg: actor.getFlag("better-character-sheet", "themeBg") || "#12151a",
        themeGradient: actor.getFlag("better-character-sheet", "themeGradient") || "#12151a",
        themeGradientDir: actor.getFlag("better-character-sheet", "themeGradientDir") || "none",
        module: "better-character-sheet",
      };
    }

    static #onShortRest(this: any) {
      this.document.shortRest();
    }

    static #onLongRest(this: any) {
      this.document.longRest();
    }

    static async #onHeal(this: any) {
      const input = this.element.querySelector(
        ".bcs-hp-input"
      ) as HTMLInputElement;
      const val = parseInt(input?.value || "0", 10);
      if (val > 0) {
        await this.document.applyDamage(-val);
        await this.document.update({ "system.attributes.death.success": 0, "system.attributes.death.failure": 0 });
        if (input) input.value = "";
      }
    }

    static #onDamage(this: any) {
      const input = this.element.querySelector(
        ".bcs-hp-input"
      ) as HTMLInputElement;
      const val = parseInt(input?.value || "0", 10);
      if (val > 0) {
        this.document.applyDamage(val);
        if (input) input.value = "";
      }
    }

    static #onToggleClassicSheet(this: any) {
      const actor = this.document;
      // Close our sheet
      this.close();
      // Switch to the default dnd5e CharacterActorSheet
      actor.setFlag("core", "sheetClass", "dnd5e.CharacterActorSheet");
      // Re-render with the classic sheet
      setTimeout(() => actor.sheet.render(true), 100);
    }

    override _getHeaderControls() {
      const controls = super._getHeaderControls();
      controls.unshift({
        icon: "fas fa-exchange-alt",
        label: "Classic View",
        action: "toggleClassicSheet",
        ownership: "OWNER",
      });
      return controls;
    }

    // Flush pending uses changes before the sheet closes
    override async _preClose(options: any) {
      await this._flushPendingUses?.();
      return super._preClose(options);
    }

    override async _onRender(context: any, options: any) {
      // Skip dnd5e's _onRender (it expects DOM elements from its own templates).
      // Go directly to the Foundry framework's base _onRender.
      const baseProto =
        foundry.applications.api.ApplicationV2.prototype as any;
      await baseProto._onRender.call(this, context, options);

      // Clear pending state maps (re-populated each render cycle)
      this._pendingUsesChanges.clear();
      this._pendingPrep.clear();
      this._pendingAddDocs.length = 0;
      this._pendingAddIds.clear();

      this._safeSetup("EditMode", () => this._setupEditMode());
      this._safeSetup("Backdrop", () => this._setupBackdrop(context));
      this._safeSetup("Tabs", () => this._setupTabs());
      this._safeSetup("Filters", () => this._setupFilters());
      this._safeSetup("Rolls", () => this._setupRolls());
      this._safeSetup("DeathSaves", () => this._setupDeathSaves());
      this._safeSetup("Attacks", () => this._setupAttacks());
      this._safeSetup("SpellDetailPanel", () => this._setupSpellDetailPanel());
      this._safeSetup("Inspiration", () => this._setupInspiration());
      this._safeSetup("SpellSlotPips", () => this._setupSpellSlotPips());
      this._safeSetup("ManageSpells", () => this._setupManageSpells());
      this._safeSetup("FeaturePips", () => this._setupFeaturePips());
      this._safeSetup("CombatActions", () => this._setupCombatActions());
      this._safeSetup("ActionFeatures", () => this._setupActionFeatures());
      this._safeSetup("ItemSheets", () => this._setupItemSheets());
      this._safeSetup("EquipAttune", () => this._setupEquipAttune());
      this._safeSetup("CurrencyPanel", () => this._setupCurrencyPanel());
      this._safeSetup("ACPanel", () => this._setupACPanel());
      this._safeSetup("HPPanel", () => this._setupHPPanel());
      this._safeSetup("ConditionsPanel", () => this._setupConditionsPanel());
      this._safeSetup("Theme", () => this._setupTheme());
      this._safeSetup("DetailPanel", () => this._setupDetailPanel());
      this._safeSetup("EmitCompatHook", () => this._emitCompatHook(context));
      this._safeSetup("RestoreScroll", () => this._restoreScroll());
    }

    // ========================================
    // SETUP SUB-METHODS (extracted from _onRender)
    // ========================================

    /** Wraps a setup step in try-catch so one failure doesn't abort the rest. */
    private _safeSetup(name: string, fn: () => void) {
      try {
        fn();
      } catch (err) {
        console.error(`better-character-sheet | _setup${name} failed:`, err);
      }
    }

    private _setupEditMode() {
      // Restore edit mode toggle and CSS classes that the skipped parent chain provides
      this._renderModeToggle();
      this.element.classList.toggle(
        "editable",
        this.isEditable && this.isEditMode
      );
      this.element.classList.toggle("locked", !this.isEditable);

      // Force resize handle to be visible and on top
      const resizeHandle = this.element.querySelector(
        ".window-resize-handle"
      ) as HTMLElement;
      if (resizeHandle) {
        resizeHandle.style.zIndex = "30";
        resizeHandle.style.width = "18px";
        resizeHandle.style.height = "18px";
      }
    }

    private _setupBackdrop(context: any) {
      if (context.backdropUrl) {
        const rawUrl = String(context.backdropUrl).replace(/'/g, "");
        if (/^https?:\/\//i.test(rawUrl)) {
          const header = this.element.querySelector(".bcs-header") as HTMLElement | null;
          if (header) {
            header.style.setProperty(
              "background",
              `linear-gradient(to right, rgba(18,21,26,0.85), rgba(18,21,26,0.5)), url('${rawUrl}') center / cover no-repeat`,
              "important"
            );
            header.classList.add("bcs-has-backdrop");
          }
        }
      }
    }

    private _setupTabs() {
      // Restore active tab from instance state
      const savedTab = this._bcsActiveTab || "actions";
      this.element
        .querySelectorAll(".bcs-tab-btn")
        .forEach((b: Element) => {
          b.classList.toggle("active", (b as HTMLElement).dataset.bcsTab === savedTab);
        });
      this.element
        .querySelectorAll(".bcs-tab-pane")
        .forEach((p: Element) => {
          p.classList.toggle("active", (p as HTMLElement).dataset.bcsTabPane === savedTab);
        });

      // Tab switching
      this.element
        .querySelectorAll(".bcs-tab-btn")
        .forEach((btn: Element) => {
          btn.addEventListener("click", (e: Event) => {
            const tab = (e.currentTarget as HTMLElement).dataset.bcsTab;
            if (!tab) return;
            this._bcsActiveTab = tab;
            // Update active button
            this.element
              .querySelectorAll(".bcs-tab-btn")
              .forEach((b: Element) => b.classList.remove("active"));
            (e.currentTarget as HTMLElement).classList.add("active");
            // Update active pane
            this.element
              .querySelectorAll(".bcs-tab-pane")
              .forEach((p: Element) => p.classList.remove("active"));
            this.element
              .querySelector(`[data-bcs-tab-pane="${tab}"]`)
              ?.classList.add("active");
          });
        });
    }

    private _setupFilters() {
      this.element
        .querySelectorAll(".bcs-filter-pill")
        .forEach((btn: Element) => {
          btn.addEventListener("click", (e: Event) => {
            const target = e.currentTarget as HTMLElement;
            const container = target.closest(
              ".bcs-action-filters, .bcs-spell-filters, .bcs-inv-filters, .bcs-feat-filters"
            );
            if (!container) return;

            // Toggle active state within this filter group
            container
              .querySelectorAll(".bcs-filter-pill")
              .forEach((b: Element) => b.classList.remove("active"));
            target.classList.add("active");

            // Spell level filters
            const spellFilter = target.dataset.spellFilter;
            if (spellFilter !== undefined) {
              this.element
                .querySelectorAll(".bcs-spell-level-section")
                .forEach((sec: Element) => {
                  const el = sec as HTMLElement;
                  if (spellFilter === "all") {
                    el.style.display = "";
                  } else {
                    el.style.display =
                      el.dataset.spellLevel === spellFilter ? "" : "none";
                  }
                });
            }

            // Inventory filters
            const invFilter = target.dataset.invFilter;
            if (invFilter !== undefined) {
              this.element
                .querySelectorAll(".bcs-inv-section")
                .forEach((sec: Element) => {
                  const el = sec as HTMLElement;
                  if (invFilter === "all") {
                    el.style.display = "";
                  } else {
                    el.style.display =
                      el.dataset.invType === invFilter ? "" : "none";
                  }
                });
            }

            // Feature filters
            const featFilter = target.dataset.featFilter;
            if (featFilter !== undefined) {
              this.element
                .querySelectorAll(".bcs-feature-group")
                .forEach((sec: Element) => {
                  const el = sec as HTMLElement;
                  if (featFilter === "all") {
                    el.style.display = "";
                  } else {
                    el.style.display =
                      el.dataset.featType === featFilter ? "" : "none";
                  }
                });
            }

            // Action filters
            const actionFilter = target.dataset.actionFilter;
            if (actionFilter !== undefined) {
              // Filter attack rows
              this.element
                .querySelectorAll(".bcs-attack-row")
                .forEach((row: Element) => {
                  const el = row as HTMLElement;
                  if (actionFilter === "all") el.style.display = "";
                  else if (actionFilter === "attack") el.style.display = "";
                  else el.style.display = "none";
                });
              // Filter action sections and features
              this.element
                .querySelectorAll(".bcs-action-section, .bcs-action-feature")
                .forEach((sec: Element) => {
                  const el = sec as HTMLElement;
                  if (actionFilter === "all") {
                    el.style.display = "";
                  } else if (actionFilter === "limited") {
                    el.style.display = el.dataset.limited === "true" ? "" : "none";
                  } else {
                    const type = el.dataset.actionType || "";
                    el.style.display = type === actionFilter ? "" : "none";
                  }
                });
            }
          });
        });
    }

    private _setupRolls() {
      const actor = this.document;

      // Ability checks — click ability score block
      this.element
        .querySelectorAll(".bcs-ability[data-ability]")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            const ability = (el as HTMLElement).dataset.ability;
            if (ability) actor.rollAbilityCheck({ ability, event: e });
          });
        });

      // Saving throws — click save row
      this.element
        .querySelectorAll(".bcs-save-item[data-ability]")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            const ability = (el as HTMLElement).dataset.ability;
            if (ability) actor.rollSavingThrow({ ability, event: e });
          });
        });

      // Skill checks — click skill row
      this.element
        .querySelectorAll(".bcs-skill-item[data-skill]")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            const skill = (el as HTMLElement).dataset.skill;
            if (skill) actor.rollSkill({ skill, event: e });
          });
        });

      // Initiative — click initiative stat block
      this.element
        .querySelectorAll(".bcs-combat-init")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            actor.rollInitiativeDialog({ event: e });
          });
          (el as HTMLElement).style.cursor = "pointer";
        });
    }

    private _setupDeathSaves() {
      const actor = this.document;

      // Death saves — click individual pips to toggle values
      this.element
        .querySelectorAll(".bcs-ds-pip[data-ds-type]")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            e.stopPropagation();
            const pipEl = el as HTMLElement;
            const type = pipEl.dataset.dsType; // "success" or "failure"
            const idx = parseInt(pipEl.dataset.dsIndex || "0", 10);
            if (!type) return;
            const key = type === "success" ? "success" : "failure";
            const current = actor.system.attributes.death[key] ?? 0;
            // If clicking at/below current value, set to index-1; otherwise set to index
            const newVal = current >= idx ? idx - 1 : idx;
            actor.update({
              [`system.attributes.death.${key}`]: Math.max(0, Math.min(3, newVal)),
            });
          });
          (el as HTMLElement).style.cursor = "pointer";
        });

      // Death save roll button
      this.element
        .querySelectorAll(".bcs-ds-roll-btn")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            e.stopPropagation();
            actor.rollDeathSave({ event: e, legacy: false });
          });
        });

      // Death saves heal button — heal 1 HP to stabilize
      this.element
        .querySelectorAll(".bcs-ds-heal-btn")
        .forEach((el: Element) => {
          el.addEventListener("click", async (e: Event) => {
            e.stopPropagation();
            e.preventDefault();
            await actor.applyDamage(-1);
            await actor.update({ "system.attributes.death.success": 0, "system.attributes.death.failure": 0 });
          });
        });
    }

    private _setupAttacks() {
      const actor = this.document;

      // Attack rolls — click attack row to use the item
      this.element
        .querySelectorAll(
          ".bcs-attack-row[data-item-id]"
        )
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            const itemId = (el as HTMLElement).dataset.itemId;
            const item = actor.items.get(itemId);
            if (!item) return;
            const activity = item.system.activities?.values()?.next()?.value;
            if (activity) {
              activity.use({ event: e, legacy: false });
            } else {
              item.use({ event: e, legacy: false });
            }
          });
          (el as HTMLElement).style.cursor = "pointer";
        });
    }

    private _setupSpellDetailPanel() {
      const actor = this.document;

      // Spell rows — click to open detail panel with description + cast button
      this.element
        .querySelectorAll(".bcs-spell-row[data-item-id]")
        .forEach((el: Element) => {
          el.addEventListener("click", () => {
            const itemId = (el as HTMLElement).dataset.itemId;
            const item = actor.items.get(itemId);
            if (!item) return;
            const panel = this.element.querySelector(".bcs-detail-panel") as HTMLElement;
            const panelTitle = this.element.querySelector(".bcs-detail-title") as HTMLElement;
            const panelBody = this.element.querySelector(".bcs-detail-body") as HTMLElement;
            const panelActions = this.element.querySelector(".bcs-detail-actions") as HTMLElement;
            const panelMeta = this.element.querySelector(".bcs-detail-spell-meta") as HTMLElement;
            const castBtn = this.element.querySelector(".bcs-detail-cast-btn") as HTMLElement;
            const upcastDiv = this.element.querySelector(".bcs-detail-upcast") as HTMLElement;
            if (!panel || !panelTitle || !panelBody) return;

            // Reset stale state from previous panel interactions
            if (panelActions) panelActions.style.display = "none";
            if (panelMeta) { panelMeta.style.display = "none"; panelMeta.innerHTML = ""; }
            if (castBtn) {
              delete castBtn.dataset.openSheet;
              delete castBtn.dataset.activityId;
              castBtn.innerHTML = '<i class="fas fa-magic"></i> Cast Spell';
            }
            if (upcastDiv) upcastDiv.innerHTML = "";

            // Title
            panelTitle.textContent = item.name;

            // Spell metadata
            if (panelMeta) {
              const sp = item.system;
              const props = sp.properties;
              const lvl = sp.level ?? 0;
              const levelLabel = lvl === 0 ? "Cantrip" : `Level ${lvl}`;
              const school = sp.school ? (CONFIG as any).DND5E?.spellSchools?.[sp.school]?.label || sp.school : "";

              // Cast time
              const actType = sp.activation?.type || "";
              const actVal = sp.activation?.value ?? "";
              const timeLabels: Record<string, string> = {
                action: "Action", bonus: "Bonus Action", reaction: "Reaction",
                minute: "Minute", hour: "Hour",
              };
              const castTime = actVal && actVal !== 1
                ? `${actVal} ${timeLabels[actType] || actType}s`
                : timeLabels[actType] || actType || "—";

              // Range
              const rng = sp.range;
              let range = "—";
              if (rng?.value) range = `${rng.value} ${rng.units || "ft."}`;
              else if (rng?.units === "touch") range = "Touch";
              else if (rng?.units === "self") range = "Self";

              // Area of effect
              const target = sp.target;
              let aoe = "";
              if (target?.template?.type) {
                const size = target.template.size || "";
                const aoeType = target.template.type || "";
                aoe = size ? `${size} ft. ${aoeType}` : aoeType;
              }

              // Duration
              const dur = sp.duration;
              let duration = "Instantaneous";
              if (dur?.value && dur?.units) {
                duration = `${dur.value} ${dur.units}`;
              } else if (dur?.units === "instantaneous" || dur?.units === "inst") {
                duration = "Instantaneous";
              } else if (dur?.units === "special") {
                duration = "Special";
              } else if (dur?.units) {
                duration = dur.units;
              }

              // Components
              const comps: string[] = [];
              if (props?.has?.("vocal")) comps.push("V");
              if (props?.has?.("somatic")) comps.push("S");
              if (props?.has?.("material")) comps.push("M");
              const materials = sp.materials?.value || "";

              // Tags
              const tags: string[] = [];
              if (props?.has?.("concentration")) tags.push("Concentration");
              if (props?.has?.("ritual")) tags.push("Ritual");

              let metaHtml = `<div class="bcs-spell-meta-grid">`;
              metaHtml += `<div class="bcs-meta-row"><span class="bcs-meta-label">Level</span><span class="bcs-meta-value">${escapeHtml(levelLabel)}${school ? ` (${escapeHtml(school)})` : ""}</span></div>`;
              metaHtml += `<div class="bcs-meta-row"><span class="bcs-meta-label">Casting Time</span><span class="bcs-meta-value">${escapeHtml(castTime)}</span></div>`;
              metaHtml += `<div class="bcs-meta-row"><span class="bcs-meta-label">Range</span><span class="bcs-meta-value">${escapeHtml(range)}</span></div>`;
              if (aoe) metaHtml += `<div class="bcs-meta-row"><span class="bcs-meta-label">Area</span><span class="bcs-meta-value">${escapeHtml(aoe)}</span></div>`;
              metaHtml += `<div class="bcs-meta-row"><span class="bcs-meta-label">Duration</span><span class="bcs-meta-value">${escapeHtml(duration)}</span></div>`;
              metaHtml += `<div class="bcs-meta-row"><span class="bcs-meta-label">Components</span><span class="bcs-meta-value">${comps.join(", ") || "None"}${materials ? ` (${escapeHtml(materials)})` : ""}</span></div>`;
              if (tags.length) metaHtml += `<div class="bcs-meta-row"><span class="bcs-meta-label">Tags</span><span class="bcs-meta-value">${tags.map(t => `<span class="bcs-meta-tag">${t}</span>`).join(" ")}</span></div>`;
              metaHtml += `</div>`;
              panelMeta.innerHTML = metaHtml;
              panelMeta.style.display = "";
            }

            // Description
            panelBody.innerHTML = item.system.description?.value || "";

            // Cast button
            if (panelActions) panelActions.style.display = "";
            if (castBtn) castBtn.dataset.itemId = item.id;

            // Upcast buttons
            if (upcastDiv) {
              const spellLevel = item.system.level ?? 0;
              if (spellLevel > 0) {
                const slots = actor.system.spells || {};
                const upcastButtons: string[] = [];
                for (let lvl = spellLevel + 1; lvl <= 9; lvl++) {
                  const slotData = slots[`spell${lvl}`];
                  if (slotData && slotData.max > 0) {
                    const available = slotData.value ?? 0;
                    const disabled = available <= 0 ? "disabled" : "";
                    upcastButtons.push(
                      `<button class="bcs-upcast-btn" data-item-id="${escapeHtml(item.id)}" data-level="${lvl}" ${disabled}>` +
                      `Lv ${lvl} <span class="bcs-upcast-slots">(${available}/${slotData.max})</span></button>`
                    );
                  }
                }
                upcastDiv.innerHTML = upcastButtons.length
                  ? `<div class="bcs-upcast-label">Upcast</div><div class="bcs-upcast-grid">${upcastButtons.join("")}</div>`
                  : "";
              } else {
                upcastDiv.innerHTML = "";
              }
            }

            panel.dataset.panel = "open";
          });
          (el as HTMLElement).style.cursor = "pointer";
        });
    }

    private _setupInspiration() {
      const actor = this.document;

      this.element
        .querySelectorAll(".bcs-inspiration")
        .forEach((el: Element) => {
          el.addEventListener("click", () => {
            actor.update({
              "system.attributes.inspiration":
                !actor.system.attributes.inspiration,
            });
          });
        });
    }

    private _setupSpellSlotPips() {
      const actor = this.document;

      this.element
        .querySelectorAll(".bcs-slot-pip")
        .forEach((el: Element) => {
          el.addEventListener("click", () => {
            const section = el.closest(
              ".bcs-spell-level-section"
            ) as HTMLElement;
            const level = section?.dataset.spellLevel;
            if (!level) return;
            const slotKey = `spell${level}` as string;
            const currentSlots =
              actor.system.spells?.[slotKey];
            if (!currentSlots) return;
            const isUsed = el.classList.contains("used");
            const newVal = isUsed
              ? Math.min(
                  currentSlots.value + 1,
                  currentSlots.max
                )
              : Math.max(currentSlots.value - 1, 0);
            actor.update({
              [`system.spells.${slotKey}.value`]: newVal,
            });
          });
        });
    }

    private _setupManageSpells() {
      const actor = this.document;

      const managePanel = this.element.querySelector(".bcs-manage-panel") as HTMLElement;
      const manageBody = this.element.querySelector(".bcs-manage-body") as HTMLElement;
      const manageClose = this.element.querySelector(".bcs-manage-close");
      const learnSection = this.element.querySelector(".bcs-manage-wizard-add") as HTMLElement;
      const learnSearch = this.element.querySelector(".bcs-manage-search") as HTMLInputElement;
      const learnLevelFilter = this.element.querySelector(".bcs-manage-level-filter") as HTMLSelectElement;
      const learnResults = this.element.querySelector(".bcs-manage-search-results") as HTMLElement;
      const learnBar = this.element.querySelector(".bcs-manage-learn-bar") as HTMLElement;
      const learnToggleBtn = this.element.querySelector(".bcs-manage-learn-toggle") as HTMLElement;

      if (managePanel && manageBody) {
        // Detect caster type from context
        const prepCasterIds = new Set(["wizard", "cleric", "druid", "paladin"]);
        const castingClass = actor.items?.find((i: any) => {
          const id = i.system?.identifier?.toLowerCase();
          return i.type === "class" && id && prepCasterIds.has(id) && i.system?.spellcasting?.ability;
        });
        const isWizardClass = castingClass?.system?.identifier?.toLowerCase() === "wizard";

        // Max prepared spells — use dnd5e's computed value from the class
        let maxPrep = 0;
        if (castingClass) {
          maxPrep = castingClass.system.spellcasting?.preparation?.max ?? 0;
          // Fallback to ability mod + level if system doesn't provide max
          if (!maxPrep) {
            const scAbility = castingClass.system.spellcasting.ability;
            const abilMod = actor.system.abilities?.[scAbility]?.mod ?? 0;
            const classLvl = castingClass.system.levels ?? 1;
            maxPrep = Math.max(1, abilMod + classLvl);
          }
        }

 
        // Restore panel state after re-render
        if (this._bcsManagePanelOpen) {
          this._populateManagePanel(manageBody, isWizardClass, maxPrep);
          managePanel.dataset.panel = "open";
          if (isWizardClass && learnBar) learnBar.style.display = "";
          if (this._bcsLearnPanelOpen && learnSection) learnSection.style.display = "";
          // Restore scroll position after re-render
          if (this._bcsManageScrollTop) manageBody.scrollTop = this._bcsManageScrollTop;
        }

        // Open panel
        this.element.querySelector(".bcs-manage-spells-btn")?.addEventListener("click", () => {
          this._populateManagePanel(manageBody, isWizardClass, maxPrep);
          if (isWizardClass && learnBar) learnBar.style.display = "";
          this._bcsManagePanelOpen = true;
          managePanel.dataset.panel = "open";
        });

        // Close panel — flush pending prep changes and spell additions
        manageClose?.addEventListener("click", async () => {
          managePanel.dataset.panel = "closed";
          this._bcsManagePanelOpen = false;
          this._bcsLearnPanelOpen = false;
          if (learnSection) learnSection.style.display = "none";
          if (learnBar) learnBar.style.display = "none";
          if (learnResults) learnResults.innerHTML = "";
          await this._flushPendingAdds();
          await this._flushPendingPrep();
        });

        // Wizard: "Learn New Spells" toggle
        if (learnToggleBtn) {
          learnToggleBtn.addEventListener("click", () => {
            if (!learnSection) return;
            const isOpen = learnSection.style.display !== "none";
            learnSection.style.display = isOpen ? "none" : "";
            this._bcsLearnPanelOpen = !isOpen;
            if (!isOpen) this._populateLearnList(learnResults, learnSearch, learnLevelFilter);
          });
        }

        // Wizard: learn spells list search/filter
        if (isWizardClass && learnSearch && learnResults) {
          let searchTimeout: any = null;
          learnSearch.addEventListener("input", () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this._populateLearnList(learnResults, learnSearch, learnLevelFilter), 300);
          });
          learnLevelFilter?.addEventListener("change", () => this._populateLearnList(learnResults, learnSearch, learnLevelFilter));
        }
      }
    }

    private _isEffectivelyPrepared(sp: any): boolean {
      if (this._pendingPrep.has(sp.id)) return this._pendingPrep.get(sp.id)!;
      return !!sp.system.preparation?.prepared;
    }

    private _countPreparedWithPending(): number {
      const actor = this.document;
      return [...actor.items].filter((i: any) => {
        if (i.type !== "spell") return false;
        if ((i.system.level ?? 0) === 0) return false;
        const mode = i.system.preparation?.mode;
        if (mode === "always" || mode === "innate" || mode === "atwill" || mode === "pact") return false;
        return this._isEffectivelyPrepared(i);
      }).length;
    }

    private async _flushPendingPrep() {
      const actor = this.document;
      if (this._pendingPrep.size === 0) return;
      const updates = [...this._pendingPrep.entries()].map(([id, prepared]) => ({
        _id: id, "system.preparation.prepared": prepared,
      }));
      this._pendingPrep.clear();
      await actor.updateEmbeddedDocuments("Item", updates);
    }

    private async _flushPendingAdds() {
      const actor = this.document;
      if (this._pendingAddDocs.length === 0) return;
      const docs = [...this._pendingAddDocs];
      this._pendingAddDocs.length = 0;
      this._pendingAddIds.clear();
      await actor.createEmbeddedDocuments("Item", docs);
    }

    private async _flushPendingUses() {
      const actor = this.document;
      if (this._pendingUsesChanges.size === 0) return;
      const updates = [...this._pendingUsesChanges.entries()].map(([id, spent]) => ({
        _id: id, "system.uses.spent": spent,
      }));
      this._pendingUsesChanges.clear();
      await actor.updateEmbeddedDocuments("Item", updates);
    }

    private _populateManagePanel(manageBody: HTMLElement, isWizardClass: boolean, maxPrep: number) {
      const actor = this.document;
      const lvlLabels = LEVEL_LABELS;

      // Save scroll position before repopulating
      const scrollTop = manageBody.scrollTop;

      const allSpells = [...actor.items].filter((i: any) => i.type === "spell");
      const grouped: Record<number, any[]> = {};
      for (const sp of allSpells) {
        const lvl = sp.system.level ?? 0;
        if (!grouped[lvl]) grouped[lvl] = [];
        grouped[lvl].push(sp);
      }
      const prepCount = this._countPreparedWithPending();
      const atMax = maxPrep > 0 && prepCount >= maxPrep;

      let html = `<div class="bcs-manage-prep-counter">Prepared: <strong>${prepCount}</strong> / <strong>${maxPrep}</strong></div>`;
      const sortedLevels = Object.keys(grouped).map(Number).sort((a, b) => a - b);
      for (const lvl of sortedLevels) {
        const spells = grouped[lvl].sort((a: any, b: any) => a.name.localeCompare(b.name));
        html += `<div class="bcs-manage-level-group">`;
        html += `<div class="bcs-manage-level-label">${lvlLabels[lvl] || `Level ${lvl}`}</div>`;
        for (const sp of spells) {
          const isCantrip = lvl === 0;
          const prepMode = sp.system.preparation?.mode;
          const isAlwaysOn = prepMode === "always" || prepMode === "innate" || prepMode === "atwill" || prepMode === "pact";
          const isPrepared = this._isEffectivelyPrepared(sp);
          const showToggle = !isCantrip && !isAlwaysOn;
          const checkedClass = isPrepared ? "prepared" : "";
          const disabledClass = !isPrepared && atMax && showToggle ? "disabled" : "";
          const alwaysLabel = isCantrip ? "Always" : isAlwaysOn ? "Always" : "";
          const ritual = sp.system.properties?.has?.("ritual");

          html += `<div class="bcs-manage-spell-row" data-item-id="${escapeHtml(sp.id)}">`;
          if (showToggle) {
            html += `<span class="bcs-manage-prep-check ${checkedClass} ${disabledClass}" data-item-id="${escapeHtml(sp.id)}" title="${disabledClass ? "Max prepared reached" : "Toggle prepared"}"></span>`;
          } else {
            html += `<span class="bcs-manage-prep-label">${alwaysLabel}</span>`;
          }
          html += `<img src="${escapeHtml(sp.img || "icons/svg/mystery-man.svg")}" alt="" class="bcs-manage-spell-icon" />`;
          html += `<span class="bcs-manage-spell-name">${escapeHtml(sp.name)}`;
          if (ritual) html += ` <span class="bcs-spell-icon" title="Ritual">ℛ</span>`;
          html += `</span>`;
          if (isWizardClass && !isCantrip) {
            html += `<button class="bcs-manage-remove-btn" data-item-id="${escapeHtml(sp.id)}" title="Remove from spellbook"><i class="fas fa-trash-alt"></i></button>`;
          }
          html += `</div>`;
        }
        html += `</div>`;
      }
      if (!sortedLevels.length) {
        html += `<div class="bcs-empty-state">No spells on this character</div>`;
      }
      manageBody.innerHTML = html;
      manageBody.scrollTop = scrollTop;

      // Bind prep toggles — local toggle, no server update
      manageBody.querySelectorAll(".bcs-manage-prep-check:not(.disabled)").forEach((el: Element) => {
        el.addEventListener("click", (e: Event) => {
          e.stopPropagation();
          const itemId = (el as HTMLElement).dataset.itemId;
          if (!itemId) return;
          const sp = actor.items.get(itemId);
          if (!sp) return;
          const currentlyPrepped = this._isEffectivelyPrepared(sp);
          this._pendingPrep.set(itemId, !currentlyPrepped);
          this._populateManagePanel(manageBody, isWizardClass, maxPrep);
        });
        (el as HTMLElement).style.cursor = "pointer";
      });

      // Bind remove buttons (wizard only)
      manageBody.querySelectorAll(".bcs-manage-remove-btn").forEach((el: Element) => {
        el.addEventListener("click", async (e: Event) => {
          e.stopPropagation();
          const itemId = (el as HTMLElement).dataset.itemId;
          if (!itemId) return;
          const item = actor.items.get(itemId);
          if (!item) return;
          const confirmed = await Dialog.confirm({
            title: "Remove Spell",
            content: `<p>Remove <strong>${item.name}</strong> from your spellbook?</p>`,
          });
          if (confirmed) {
            await item.delete();
            this._populateManagePanel(manageBody, isWizardClass, maxPrep);
          }
        });
      });
    }

    private async _populateLearnList(learnResults: HTMLElement | null, learnSearch: HTMLInputElement | null, learnLevelFilter: HTMLSelectElement | null) {
      const actor = this.document;
      const lvlLabels = LEVEL_LABELS;

      if (!learnResults) return;
      const learnScrollTop = learnResults.scrollTop;
      const pack = (game as any).packs?.get("dnd5e.spells");
      if (!pack) {
        learnResults.innerHTML = `<div class="bcs-empty-state">Spell compendium not found</div>`;
        return;
      }
      // Determine highest spell slot level the actor can cast
      const slots = actor.system.spells || {};
      let maxSlotLevel = 0;
      for (let i = 1; i <= 9; i++) {
        if (slots[`spell${i}`]?.max > 0) maxSlotLevel = i;
      }

      const index = await pack.getIndex({ fields: ["system.level", "system.school"] });
      const ownedNames = new Set(
        [...actor.items].filter((i: any) => i.type === "spell").map((i: any) => `${i.name}::${i.system.level ?? 0}`)
      );
      // Also count pending adds as owned
      for (const doc of this._pendingAddDocs) {
        ownedNames.add(`${doc.name}::${doc.system?.level ?? 0}`);
      }
      const query = learnSearch?.value?.trim().toLowerCase() || "";
      const levelVal = learnLevelFilter?.value || "all";

      const matches = [...index].filter((entry: any) => {
        const lvl = entry.system?.level ?? 0;
        if (lvl === 0) return false;
        if (maxSlotLevel > 0 && lvl > maxSlotLevel) return false;
        if (levelVal !== "all" && lvl !== Number(levelVal)) return false;
        if (query && !entry.name.toLowerCase().includes(query)) return false;
        return true;
      }).sort((a: any, b: any) => {
        const lvlDiff = (a.system?.level ?? 0) - (b.system?.level ?? 0);
        return lvlDiff !== 0 ? lvlDiff : a.name.localeCompare(b.name);
      }).slice(0, 50);

      if (!matches.length) {
        learnResults.innerHTML = `<div class="bcs-empty-state">No matching spells found</div>`;
        return;
      }

      let html = "";
      let currentLvl = -1;
      for (const m of matches) {
        const lvl = m.system?.level ?? 0;
        if (lvl !== currentLvl) {
          currentLvl = lvl;
          html += `<div class="bcs-manage-level-label" style="margin-top:8px;">${lvlLabels[lvl] || `Level ${lvl}`}</div>`;
        }
        const owned = ownedNames.has(`${m.name}::${lvl}`);
        const justAdded = this._pendingAddIds.has(m._id);
        html += `<div class="bcs-manage-search-result ${owned ? "owned" : ""}">`;
        html += `<img src="${escapeHtml(m.img || "icons/svg/mystery-man.svg")}" alt="" class="bcs-manage-spell-icon" />`;
        html += `<span class="bcs-manage-spell-name">${escapeHtml(m.name)}</span>`;
        if (owned || justAdded) {
          html += `<span class="bcs-manage-owned-badge">${justAdded ? "Added" : "In Book"}</span>`;
        } else {
          html += `<button class="bcs-manage-add-btn" data-pack-id="${escapeHtml(m._id)}" title="Add to spellbook"><i class="fas fa-plus"></i> Add</button>`;
        }
        html += `</div>`;
      }
      learnResults.innerHTML = html;
      learnResults.scrollTop = learnScrollTop;

      // Bind add buttons — local queue, no server call
      learnResults.querySelectorAll(".bcs-manage-add-btn").forEach((el: Element) => {
        el.addEventListener("click", async (e: Event) => {
          e.stopPropagation();
          const packId = (el as HTMLElement).dataset.packId;
          if (!packId || this._pendingAddIds.has(packId)) return;
          const doc = await pack.getDocument(packId);
          if (!doc) return;
          const data = doc.toObject();
          data.system.preparation = { mode: "prepared", prepared: false };
          this._pendingAddDocs.push(data);
          this._pendingAddIds.add(packId);
          this._populateLearnList(learnResults, learnSearch, learnLevelFilter);
        });
      });
    }

    private _setupFeaturePips() {
      const actor = this.document;

      // Feature use pips — click to toggle, update DOM in-place
      this.element
        .querySelectorAll(".bcs-feat-pip")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            e.stopPropagation();
            e.preventDefault();
            const itemId = (el.closest("[data-item-id]") as HTMLElement)?.dataset.itemId;
            if (!itemId) return;

            const isFilled = el.classList.contains("filled");
            const result = this._adjustItemUses(itemId, isFilled ? "increment" : "decrement");
            if (!result) return;

            // Update all pips for this item in-place
            const allPipContainers = this.element.querySelectorAll(`[data-item-id="${itemId}"]`);
            allPipContainers.forEach((container: Element) => {
              const pips = container.querySelectorAll(".bcs-feat-pip");
              pips.forEach((pip: Element, idx: number) => {
                if (idx >= result.newSpent) {
                  pip.classList.add("filled");
                } else {
                  pip.classList.remove("filled");
                }
              });
            });
          });
        });

      // Numeric uses +/- buttons (for items with >7 max uses)
      this.element
        .querySelectorAll(".bcs-uses-minus, .bcs-uses-plus")
        .forEach((el: Element) => {
          el.addEventListener("dblclick", (e: Event) => e.stopPropagation());
          el.addEventListener("click", (e: Event) => {
            e.stopPropagation();
            e.preventDefault();
            const itemId = (el.closest("[data-item-id]") as HTMLElement)?.dataset.itemId;
            if (!itemId) return;

            const isMinus = el.classList.contains("bcs-uses-minus");
            const result = this._adjustItemUses(itemId, isMinus ? "increment" : "decrement");
            if (!result) return;

            // Update all numeric displays for this item in-place
            const allContainers = this.element.querySelectorAll(`[data-item-id="${itemId}"]`);
            allContainers.forEach((container: Element) => {
              const numericEl = container.querySelector(".bcs-uses-numeric");
              if (numericEl) {
                numericEl.textContent = `${result.usesMax - result.newSpent} / ${result.usesMax}`;
              }
            });
          });
        });

      // Flush pending uses changes on tab change
      this.element.querySelectorAll(".bcs-tab-btn").forEach((btn: Element) => {
        btn.addEventListener("click", () => this._flushPendingUses());
      });
    }

    private _setupCombatActions() {
      const actor = this.document;

      // Combat actions — click to post description to chat
      this.element
        .querySelectorAll(".bcs-combat-action")
        .forEach((el: Element) => {
          el.addEventListener("click", () => {
            const name = (el as HTMLElement).dataset.actionName;
            const desc = (el as HTMLElement).dataset.actionDesc;
            if (!name) return;
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<h3>${name}</h3><p>${desc || ""}</p>`,
            });
          });
        });

      // Action tab spell references — click to cast
      this.element
        .querySelectorAll(".bcs-action-spell-ref[data-spell-name]")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            const name = (el as HTMLElement).dataset.spellName;
            const spell = actor.items.find(
              (i: any) => i.type === "spell" && i.name === name
            );
            if (!spell) return;
            const activity = spell.system.activities?.values()?.next()?.value;
            if (activity) {
              activity.use({ event: e, legacy: false });
            } else {
              spell.use({ event: e, legacy: false });
            }
          });
        });
    }

    private _setupActionFeatures() {
      const actor = this.document;

      // Action features — click name to use, double-click to open sheet
      this.element
        .querySelectorAll(".bcs-action-feature[data-item-id]")
        .forEach((el: Element) => {
          const nameEl = el.querySelector(".bcs-action-feature-name");
          if (nameEl) {
            nameEl.addEventListener("click", (e: Event) => {
              const itemId = (el as HTMLElement).dataset.itemId;
              const item = actor.items.get(itemId);
              if (!item) return;
              const activity = item.system.activities?.values()?.next()?.value;
              if (activity) {
                activity.use({ event: e, legacy: false });
              } else {
                item.use({ event: e, legacy: false });
              }
            });
            (nameEl as HTMLElement).style.cursor = "pointer";
          }
          el.addEventListener("dblclick", () => {
            const itemId = (el as HTMLElement).dataset.itemId;
            const item = actor.items.get(itemId);
            if (item) item.sheet.render(true);
          });
        });
    }

    private _setupItemSheets() {
      const actor = this.document;

      // Click item/spell name — open item sheet
      this.element
        .querySelectorAll(
          ".bcs-inv-row[data-item-id], .bcs-feature-item[data-item-id]"
        )
        .forEach((el: Element) => {
          el.addEventListener("dblclick", () => {
            const itemId = (el as HTMLElement).dataset.itemId;
            const item = actor.items.get(itemId);
            if (item) item.sheet.render(true);
          });
        });
    }

    private _setupEquipAttune() {
      const actor = this.document;

      // Equipped toggle — click the equip checkbox
      this.element
        .querySelectorAll(".bcs-equip-check")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            e.stopPropagation();
            e.preventDefault();
            const row = el.closest("[data-item-id]") as HTMLElement;
            const itemId = row?.dataset.itemId;
            if (!itemId) return;
            const item = actor.items.get(itemId);
            if (!item) return;
            const current = typeof item.system.equipped === "object"
              ? item.system.equipped?.value
              : item.system.equipped;
            item.update({ "system.equipped": !current });
          });
          (el as HTMLElement).style.cursor = "pointer";
        });

      // Attunement toggle — click attune checkbox
      this.element
        .querySelectorAll(".bcs-attune-check")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            e.stopPropagation();
            e.preventDefault();
            const row = el.closest("[data-item-id]") as HTMLElement;
            const itemId = row?.dataset.itemId;
            if (!itemId) return;
            const item = actor.items.get(itemId);
            if (!item) return;
            const isAttuned = item.system.attuned ?? (item.system.attunement === "attuned");
            item.update({ "system.attuned": !isAttuned });
          });
          (el as HTMLElement).style.cursor = "pointer";
        });
    }

    private _setupCurrencyPanel() {
      const actor = this.document;

      const currencyPanel = this.element.querySelector(".bcs-currency-panel") as HTMLElement;
      const currencyClose = this.element.querySelector(".bcs-currency-close");
      const currencyApply = this.element.querySelector(".bcs-currency-apply");

      this.element.querySelectorAll(".bcs-inv-gold").forEach((el: Element) => {
        el.addEventListener("click", () => {
          if (currencyPanel) currencyPanel.dataset.panel = "open";
        });
        (el as HTMLElement).style.cursor = "pointer";
      });

      currencyClose?.addEventListener("click", () => {
        if (currencyPanel) currencyPanel.dataset.panel = "closed";
      });

      currencyApply?.addEventListener("click", () => {
        const updates: Record<string, number> = {};
        this.element.querySelectorAll(".bcs-currency-input").forEach((input: Element) => {
          const inp = input as HTMLInputElement;
          const denom = inp.dataset.currency;
          if (denom) updates[`system.currency.${denom}`] = Math.max(0, parseInt(inp.value, 10) || 0);
        });
        actor.update(updates);
        if (currencyPanel) currencyPanel.dataset.panel = "closed";
      });
    }

    private _setupACPanel() {
      const actor = this.document;

      const acPanel = this.element.querySelector(".bcs-ac-panel") as HTMLElement;
      const acPanelClose = this.element.querySelector(".bcs-ac-panel-close");
      const acPanelApply = this.element.querySelector(".bcs-ac-panel-apply");

      this.element.querySelectorAll('[data-action="open-ac"]').forEach((el: Element) => {
        el.addEventListener("click", () => {
          if (acPanel) acPanel.dataset.panel = "open";
        });
        (el as HTMLElement).style.cursor = "pointer";
      });

      acPanelClose?.addEventListener("click", () => {
        if (acPanel) acPanel.dataset.panel = "closed";
      });

      acPanelApply?.addEventListener("click", () => {
        const bonusInput = this.element.querySelector('.bcs-hp-edit-input[data-ac-field="bonus"]') as HTMLInputElement;
        const flatInput = this.element.querySelector('.bcs-hp-edit-input[data-ac-field="flat"]') as HTMLInputElement;
        const updates: Record<string, any> = {};
        if (bonusInput) updates["system.attributes.ac.bonus"] = parseInt(bonusInput.value, 10) || 0;
        // Flat: empty string or NaN means null (use normal calculation)
        if (flatInput) {
          const flatVal = flatInput.value.trim();
          updates["system.attributes.ac.flat"] = flatVal === "" ? null : parseInt(flatVal, 10);
        }
        actor.update(updates);
        if (acPanel) acPanel.dataset.panel = "closed";
      });
    }

    private _setupHPPanel() {
      const actor = this.document;

      const hpPanel = this.element.querySelector(".bcs-hp-panel") as HTMLElement;
      const hpPanelClose = this.element.querySelector(".bcs-hp-panel-close");
      const hpPanelApply = this.element.querySelector(".bcs-hp-panel-apply");

      this.element.querySelectorAll(".bcs-hp-info").forEach((el: Element) => {
        el.addEventListener("click", () => {
          if (hpPanel) hpPanel.dataset.panel = "open";
        });
        (el as HTMLElement).style.cursor = "pointer";
      });

      hpPanelClose?.addEventListener("click", () => {
        if (hpPanel) hpPanel.dataset.panel = "closed";
      });

      hpPanelApply?.addEventListener("click", () => {
        const hpCur = this.element.querySelector('.bcs-hp-edit-input[data-hp-field="value"]') as HTMLInputElement;
        const hpMax = this.element.querySelector('.bcs-hp-edit-input[data-hp-field="max"]') as HTMLInputElement;
        const hpTemp = this.element.querySelector('.bcs-hp-edit-input[data-hp-field="temp"]') as HTMLInputElement;
        const updates: Record<string, number> = {};
        if (hpCur) updates["system.attributes.hp.value"] = Math.max(0, parseInt(hpCur.value, 10) || 0);
        if (hpMax) updates["system.attributes.hp.max"] = Math.max(0, parseInt(hpMax.value, 10) || 0);
        if (hpTemp) updates["system.attributes.hp.temp"] = Math.max(0, parseInt(hpTemp.value, 10) || 0);
        actor.update(updates);
        if (hpPanel) hpPanel.dataset.panel = "closed";
      });
    }

    private _setupConditionsPanel() {
      const actor = this.document;

      const conditionsPanel = this.element.querySelector(".bcs-conditions-panel") as HTMLElement;
      const conditionsClose = this.element.querySelector(".bcs-conditions-close");

      this.element.querySelectorAll('[data-action="open-conditions"]').forEach((el: Element) => {
        el.addEventListener("click", () => {
          if (conditionsPanel) conditionsPanel.dataset.panel = "open";
        });
      });

      conditionsClose?.addEventListener("click", () => {
        if (conditionsPanel) conditionsPanel.dataset.panel = "closed";
      });

      // Condition toggles
      this.element.querySelectorAll(".bcs-condition-row").forEach((row: Element) => {
        row.addEventListener("click", async (e: Event) => {
          e.preventDefault();
          const conditionId = (row as HTMLElement).dataset.conditionId;
          if (!conditionId) return;
          // Use the token's toggleStatusEffect or actor's toggleStatusEffect
          const token = actor.getActiveTokens()?.[0];
          if (token) {
            await token.toggleStatusEffect(conditionId);
          } else {
            await actor.toggleStatusEffect(conditionId);
          }
        });
      });

      // Exhaustion stepper
      this.element.querySelectorAll(".bcs-exhaustion-btn").forEach((btn: Element) => {
        btn.addEventListener("click", async (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          const dir = (btn as HTMLElement).dataset.exhaustionDir;
          const current = actor.system.attributes?.exhaustion || 0;
          let next = dir === "up" ? current + 1 : current - 1;
          next = Math.max(0, Math.min(6, next));
          if (next !== current) {
            await actor.update({ "system.attributes.exhaustion": next });
          }
        });
      });
    }

    private _setupTheme() {
      const actor = this.document;

      const themePanel = this.element.querySelector(
        ".bcs-theme-panel"
      ) as HTMLElement;
      const themeToggle = this.element.querySelector(".bcs-theme-toggle");
      const themeClose = this.element.querySelector(".bcs-theme-close");

      // Apply saved theme on render
      const savedAccent =
        actor.getFlag("better-character-sheet", "themeAccent") as string;
      const savedBg =
        actor.getFlag("better-character-sheet", "themeBg") as string;
      const savedGradient =
        actor.getFlag("better-character-sheet", "themeGradient") as string;
      const savedGradientDir =
        actor.getFlag("better-character-sheet", "themeGradientDir") as string;
      if (savedAccent) this._applyAccentColor(savedAccent);
      if (savedBg) this._applyBgColor(savedBg);
      if (savedGradient && savedGradientDir && savedGradientDir !== "none") {
        const darkBg = this._darkenColor(savedBg || "#12151a", 0.82);
        const darkGrad = this._darkenColor(savedGradient, 0.82);
        this.element.style.setProperty(
          "--bcs-bg-gradient-img",
          `linear-gradient(${savedGradientDir}, ${darkBg}, ${darkGrad})`
        );
      }

      // Toggle panel
      themeToggle?.addEventListener("click", () => {
        themePanel.dataset.panel =
          themePanel.dataset.panel === "open" ? "closed" : "open";
      });
      themeClose?.addEventListener("click", () => {
        themePanel.dataset.panel = "closed";
      });

      // Color inputs
      this.element
        .querySelectorAll(".bcs-theme-input")
        .forEach((input: Element) => {
          input.addEventListener("input", (e: Event) => {
            const el = e.target as HTMLInputElement;
            const key = el.dataset.theme;
            if (key === "accentColor") this._applyAccentColor(el.value);
            if (key === "bgColor") this._applyBgColor(el.value);
            // Live gradient update on any color change
            this._applyGradientFromDOM();
          });
          input.addEventListener("change", (e: Event) => {
            const el = e.target as HTMLInputElement;
            const key = el.dataset.theme;
            const flagMap: Record<string, string> = {
              accentColor: "themeAccent",
              bgColor: "themeBg",
              gradientColor: "themeGradient",
            };
            const flag = flagMap[key || ""];
            if (flag) actor.setFlag("better-character-sheet", flag, el.value);
          });
        });

      // Gradient direction select
      this.element
        .querySelectorAll(".bcs-theme-select")
        .forEach((sel: Element) => {
          sel.addEventListener("change", (e: Event) => {
            const el = e.target as HTMLSelectElement;
            this._applyGradientFromDOM();
            actor.setFlag("better-character-sheet", "themeGradientDir", el.value);
          });
        });

      // Reset button
      this.element
        .querySelector(".bcs-theme-reset")
        ?.addEventListener("click", async () => {
          await actor.unsetFlag("better-character-sheet", "themeAccent");
          await actor.unsetFlag("better-character-sheet", "themeBg");
          await actor.unsetFlag("better-character-sheet", "themeGradient");
          await actor.unsetFlag("better-character-sheet", "themeGradientDir");
          this.element.removeAttribute("style");
          this.render();
        });
    }

    private _setupDetailPanel() {
      const actor = this.document;

      const panel = this.element.querySelector(
        ".bcs-detail-panel"
      ) as HTMLElement;
      const panelTitle = this.element.querySelector(
        ".bcs-detail-title"
      ) as HTMLElement;
      const panelBody = this.element.querySelector(
        ".bcs-detail-body"
      ) as HTMLElement;
      const panelClose = this.element.querySelector(".bcs-detail-close");
      const panelActions = this.element.querySelector(
        ".bcs-detail-actions"
      ) as HTMLElement;
      const panelMeta = this.element.querySelector(
        ".bcs-detail-spell-meta"
      ) as HTMLElement;
      const castBtn = this.element.querySelector(
        ".bcs-detail-cast-btn"
      ) as HTMLElement;
      const upcastDiv = this.element.querySelector(
        ".bcs-detail-upcast"
      ) as HTMLElement;

      const resetPanel = () => {
        if (panelActions) panelActions.style.display = "none";
        if (panelMeta) { panelMeta.style.display = "none"; panelMeta.innerHTML = ""; }
        if (castBtn) {
          delete castBtn.dataset.itemId;
          delete castBtn.dataset.activityId;
          delete castBtn.dataset.openSheet;
          castBtn.innerHTML = `<i class="fas fa-magic"></i> Cast Spell`;
        }
        if (upcastDiv) upcastDiv.innerHTML = "";
      };

      if (panel && panelTitle && panelBody) {
        // Feature descriptions — show full description + Edit or Use button
        this.element
          .querySelectorAll(
            ".bcs-feature-desc-truncated, .bcs-action-feature-desc-truncated"
          )
          .forEach((el: Element) => {
            el.addEventListener("click", () => {
              const itemId = (el as HTMLElement).dataset.itemId;
              const activityId = (el as HTMLElement).dataset.activityId;
              const item = (this as any).document.items.get(itemId);
              if (!item) return;

              resetPanel();

              // If a specific activity is referenced, show that activity's details + Use
              if (activityId && item.system.activities) {
                let activity: any = null;
                for (const act of item.system.activities.values()) {
                  if ((act.id || act._id) === activityId) { activity = act; break; }
                }
                panelTitle.textContent = activity?.name || item.name;
                panelBody.innerHTML = activity?.description?.value || item.system.description?.value || "";
                if (panelActions) panelActions.style.display = "";
                if (castBtn) {
                  castBtn.dataset.itemId = item.id;
                  castBtn.dataset.activityId = activityId;
                  castBtn.innerHTML = `<i class="fas fa-bolt"></i> Use`;
                }
              } else {
                // Generic feature — show description + Edit button
                panelTitle.textContent = item.name;
                panelBody.innerHTML = item.system.description?.value || "";
                if (panelActions) panelActions.style.display = "";
                if (castBtn) {
                  castBtn.dataset.itemId = item.id;
                  castBtn.dataset.openSheet = "true";
                  castBtn.innerHTML = `<i class="fas fa-edit"></i> Edit Feature`;
                }
              }

              panel.dataset.panel = "open";
            });
          });

        // Feature sub-actions — open detail panel with Use button
        this.element
          .querySelectorAll(".bcs-feature-subaction")
          .forEach((el: Element) => {
            el.addEventListener("click", () => {
              const itemId = (el as HTMLElement).dataset.itemId;
              const activityId = (el as HTMLElement).dataset.activityId;
              const item = (this as any).document.items.get(itemId);
              if (!item) return;
              // Find the specific activity
              let activity: any = null;
              if (activityId && item.system.activities) {
                for (const act of item.system.activities.values()) {
                  if ((act.id || act._id) === activityId) { activity = act; break; }
                }
              }
              panelTitle.textContent = activity?.name || item.name;
              const actDesc = activity?.description?.value || item.system.description?.value || "";
              panelBody.innerHTML = actDesc;
              resetPanel();
              // Show Use button with the activity
              if (panelActions) panelActions.style.display = "";
              if (castBtn) {
                castBtn.dataset.itemId = item.id;
                if (activityId) castBtn.dataset.activityId = activityId;
                castBtn.innerHTML = `<i class="fas fa-bolt"></i> Use`;
              }
              panel.dataset.panel = "open";
            });
            (el as HTMLElement).style.cursor = "pointer";
          });

        // Cast/Use/Edit button — multipurpose action button in detail panel
        if (castBtn) {
          castBtn.addEventListener("click", (e: Event) => {
            const itemId = castBtn.dataset.itemId;
            if (!itemId) return;
            const item = actor.items.get(itemId);
            if (!item) return;

            // Open native item sheet for Edit Feature
            if (castBtn.dataset.openSheet === "true") {
              item.sheet.render(true);
              return;
            }

            // If a specific activity is targeted, find and use it
            const activityId = castBtn.dataset.activityId;
            if (activityId && item.system.activities) {
              for (const act of item.system.activities.values()) {
                if ((act.id || act._id) === activityId) {
                  act.use({ event: e, legacy: false });
                  return;
                }
              }
            }
            // Default: first activity or item.use()
            const activity = item.system.activities?.values()?.next()?.value;
            if (activity) {
              activity.use({ event: e, legacy: false });
            } else {
              item.use({ event: e, legacy: false });
            }
          });
        }

        // Upcast buttons — delegate click from the upcast container
        if (upcastDiv) {
          upcastDiv.addEventListener("click", (e: Event) => {
            const btn = (e.target as HTMLElement).closest(".bcs-upcast-btn") as HTMLElement;
            if (!btn || btn.hasAttribute("disabled")) return;
            const itemId = btn.dataset.itemId;
            const slotLevel = Number(btn.dataset.level);
            if (!itemId || !slotLevel) return;
            const item = actor.items.get(itemId);
            if (!item) return;
            const activity = item.system.activities?.values()?.next()?.value;
            if (activity) {
              activity.use({ event: e, legacy: false, slotLevel });
            } else {
              item.use({ event: e, legacy: false, slotLevel });
            }
          });
        }

        panelClose?.addEventListener("click", () => {
          panel.dataset.panel = "closed";
          resetPanel();
        });
      }
    }

    private _emitCompatHook(context: any) {
      // modules like ddb-importer (which discover sheet names from
      // CONFIG.Actor.sheetClasses and listen for render{SheetName}
      // with {owner, actor} data) can inject their buttons.
      const hookData = {
        owner: this.document.isOwner,
        actor: this.document,
        data: context,
        editable: this.isEditable,
      };
      Hooks.callAll(
        `render${this.constructor.name}`,
        this,
        $(this.element),
        hookData
      );
    }

    private _restoreScroll() {
      const savedScrollTop = this._bcsScrollTop;
      if (savedScrollTop > 0) {
        setTimeout(() => {
          const tc = this.element?.querySelector(".bcs-tab-content") as HTMLElement;
          if (tc) tc.scrollTop = savedScrollTop;
        }, 10);
      }
    }

    // Darken a hex color by mixing with near-black
    _darkenColor(hex: string, amount = 0.7): string {
      if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return '#000000';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const dr = Math.round(r * (1 - amount));
      const dg = Math.round(g * (1 - amount));
      const db = Math.round(b * (1 - amount));
      return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
    }

    _applyAccentColor(color: string) {
      const el = this.element;
      el.style.setProperty("--bcs-accent", color);
      // Dimmed version for borders
      el.style.setProperty("--bcs-accent-dim", this._darkenColor(color, 0.4));
      // Contrast text color for buttons with accent background
      el.style.setProperty("--bcs-accent-text", this._contrastTextColor(color));
    }

    // Return black or white depending on which has better contrast with the given hex color
    _contrastTextColor(hex: string): string {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      // Relative luminance (WCAG formula)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? "#000000" : "#ffffff";
    }

    _applyBgColor(color: string) {
      const el = this.element;
      const darkBg = this._darkenColor(color, 0.82);
      const cardBg = this._darkenColor(color, 0.75);
      const cardAlt = this._darkenColor(color, 0.65);
      el.style.setProperty("--bcs-bg-dark", darkBg);
      el.style.setProperty("--bcs-bg-card", cardBg);
      el.style.setProperty("--bcs-bg-card-alt", cardAlt);
    }

    _applyGradientFromDOM() {
      const bgInput = this.element.querySelector(
        '[data-theme="bgColor"]'
      ) as HTMLInputElement;
      const gradInput = this.element.querySelector(
        '[data-theme="gradientColor"]'
      ) as HTMLInputElement;
      const dirSelect = this.element.querySelector(
        '[data-theme="gradientDir"]'
      ) as HTMLSelectElement;
      if (!bgInput || !gradInput || !dirSelect) return;
      const dir = dirSelect.value;
      if (dir === "none") {
        this.element.style.removeProperty("--bcs-bg-gradient-img");
        return;
      }
      const darkBg = this._darkenColor(bgInput.value, 0.82);
      const darkGrad = this._darkenColor(gradInput.value, 0.82);
      this.element.style.setProperty(
        "--bcs-bg-gradient-img",
        `linear-gradient(${dir}, ${darkBg}, ${darkGrad})`
      );
    }
  };
}

