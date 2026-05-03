import { getDDBBackdropUrl } from "../helpers/ddb-backdrop.ts";

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
          width: 960,
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

    /** @override */
    async _prepareContext(options: any) {
      const context = await super._prepareContext(options);
      const system = context.system;
      const actor = context.actor;

      // DnD Beyond backdrop image (stored by our ddb-importer hook)
      const backdropUrl = getDDBBackdropUrl(this.document);

      // Build ability scores for the horizontal row
      const abilityKeys = ["str", "dex", "con", "int", "wis", "cha"] as const;
      const abilities = abilityKeys.map((key) => {
        const ab = system.abilities[key];
        return {
          key,
          abbr: key.toUpperCase(),
          label: CONFIG.DND5E.abilities[key]?.label ?? key,
          value: ab.value,
          mod: ab.mod,
        };
      });

      // Build saving throws
      const saves = abilityKeys.map((key) => {
        const ab = system.abilities[key];
        return {
          key,
          abbr: key.toUpperCase(),
          mod: ab.save?.value ?? ab.mod,
          proficient: ab.proficient ?? 0,
        };
      });

      // Build skills array sorted alphabetically
      const skills = Object.entries(system.skills || {})
        .map(([key, sk]: [string, any]) => ({
          key,
          label: CONFIG.DND5E.skills[key]?.label ?? key,
          ability: sk.ability,
          abbreviation: (sk.ability || "").toUpperCase().slice(0, 3),
          total: sk.total ?? 0,
          value: sk.value ?? 0,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

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
      const spellcasting = classItems
        .filter((c: any) => c.system?.spellcasting?.ability)
        .map((c: any) => {
          const sc = c.system.spellcasting;
          const abilityMod = system.abilities[sc.ability]?.mod ?? 0;
          return {
            label: c.name,
            ability: sc.ability,
            dc: 8 + (system.attributes.prof ?? 0) + abilityMod,
            attack: (system.attributes.prof ?? 0) + abilityMod,
          };
        });

      // Spell level labels (used by both attacks and spells sections)
      const levelLabels = [
        "Cantrips",
        "1st Level",
        "2nd Level",
        "3rd Level",
        "4th Level",
        "5th Level",
        "6th Level",
        "7th Level",
        "8th Level",
        "9th Level",
      ];

      // Build attacks from weapons AND attack spells
      const attacks: any[] = [];

      // Weapons — only equipped
      for (const i of actor.items.filter((i: any) => i.type === "weapon" && i.system.equipped)) {
        attacks.push({
          id: i.id,
          name: i.name,
          img: i.img,
          source: "Melee Attack",
          activationType: "attack",
          range: i.system.range?.value
            ? `${i.system.range.value} ${i.system.range.units || "ft."}`
            : "5 ft.",
          toHit: i.system.attack?.flat != null
            ? `+${i.system.attack.flat}`
            : "—",
          damage: i.system.damage?.base?.formula || "0",
          notes: "",
        });
      }

      // Attack spells — only prepared spells with attack or save+damage activities
      const isSpellAvailable = (s: any) => {
        const lvl = s.system.level ?? 0;
        if (lvl === 0) return true;
        const mode = s.system.preparation?.mode;
        if (mode === "always" || mode === "innate" || mode === "atwill" || mode === "pact") return true;
        if (mode === "prepared") return !!s.system.preparation?.prepared;
        return true;
      };

      for (const i of actor.items.filter((i: any) => i.type === "spell" && isSpellAvailable(i))) {
        const acts = i.system.activities;
        if (!acts) continue;

        let hasAttack = false;
        let hasSaveDamage = false;
        let damageFormula = "";
        let attackType = "";

        for (const act of acts.values()) {
          if (act.type === "attack") {
            hasAttack = true;
            attackType = act.attack?.type?.value || "ranged";
            damageFormula = act.damage?.parts?.[0]?.formula || damageFormula;
          }
          if (act.type === "save" && act.damage?.parts?.[0]?.formula) {
            hasSaveDamage = true;
            damageFormula = damageFormula || act.damage.parts[0].formula;
          }
        }

        if (!hasAttack && !hasSaveDamage) continue;

        const rng = i.system.range;
        let range = "—";
        if (rng?.value) range = `${rng.value} ${rng.units || "ft."}`;
        else if (rng?.units === "touch") range = "Touch";
        else if (rng?.units === "self") range = "Self";

        const comps: string[] = [];
        const props = i.system.properties;
        if (props?.has?.("vocal")) comps.push("V");
        if (props?.has?.("somatic")) comps.push("S");
        if (props?.has?.("material")) comps.push("M");

        const scInfo = spellcasting[0];
        const hitStr = hasAttack
          ? `+${scInfo?.attack ?? 0}`
          : hasSaveDamage ? `DC ${scInfo?.dc ?? 10}` : "—";

        const lvlLabel = i.system.level === 0 ? "Cantrip" : (levelLabels[i.system.level] || "");
        const className = classLabel.split(" ")[0] || "Spell";

        attacks.push({
          id: i.id,
          name: i.name,
          img: i.img,
          source: `${lvlLabel} • ${className}`,
          activationType: "attack",
          range,
          toHit: hitStr,
          damage: damageFormula || "—",
          notes: comps.length ? comps.join("/") : "",
        });
      }

      // Build action features (feats with activation or uses, with descriptions + pips)
      const actionFeatures = actor.items
        .filter(
          (i: any) =>
            i.type === "feat" &&
            (i.system.uses?.max || i.system.activation?.type || i.system.activities?.size > 0)
        )
        .map((i: any) => {
          const uses = i.system.uses?.max
            ? {
                value: i.system.uses.value ?? 0,
                max: i.system.uses.max,
                per: i.system.uses.recovery?.[0]?.type || "",
              }
            : null;
          const pips: { filled: boolean }[] = [];
          if (uses) {
            for (let p = 0; p < uses.max; p++) {
              pips.push({ filled: p < uses.value });
            }
          }

          // Resolve activation type: check item level first, then activities
          let actType = i.system.activation?.type || "";
          if (!actType && i.system.activities) {
            for (const act of i.system.activities.values()) {
              if (act.activation?.type) {
                actType = act.activation.type;
                break;
              }
            }
          }
          actType = actType || "other";

          const typeMap: Record<string, string> = {
            action: "action", bonus: "bonus", reaction: "reaction",
            minute: "other", hour: "other", special: "other",
          };
          const activationType = typeMap[actType] || "other";
          const labelMap: Record<string, string> = {
            minute: `${i.system.activation?.value || ""} Minutes`,
            hour: `${i.system.activation?.value || ""} Hours`,
          };
          const fullDesc = i.system.description?.value || "";
          const textOnly = fullDesc.replace(/<[^>]*>/g, "").trim();
          const truncated = textOnly.length > 80
            ? textOnly.substring(0, 80) + "…"
            : textOnly;

          return {
            id: i.id,
            name: i.name,
            img: i.img,
            description: fullDesc,
            truncatedDescription: truncated,
            hasLongDescription: textOnly.length > 80,
            activationType,
            activationLabel: labelMap[actType] || "",
            uses,
            pips,
          };
        })
        .filter((f: any) => f.activationType !== "other" || f.uses);

      // Categorize spells by activation type for the action tab sections
      const allSpellItems = actor.items.filter(
        (i: any) => i.type === "spell"
      );

      const spellItems = allSpellItems.filter(isSpellAvailable);
      const spellsByActivation: Record<string, any[]> = {
        bonus: [], reaction: [], other: [], ritual: [],
      };
      for (const spell of spellItems) {
        const actType = spell.system.activation?.type || "action";
        const lvl = spell.system.level ?? 0;
        const label = lvl === 0 ? "Cantrip" : levelLabels[lvl] || `${lvl}th`;
        const entry = { name: spell.name, level: lvl, levelLabel: label };

        if (actType === "bonus") spellsByActivation.bonus.push(entry);
        else if (actType === "reaction") spellsByActivation.reaction.push(entry);
        else if (actType !== "action") spellsByActivation.other.push(entry);

        // Ritual spells go in "other" section too
        const props = spell.system.properties;
        if (props?.has?.("ritual")) {
          spellsByActivation.ritual.push(entry);
        }
      }

      // Build spells grouped by level with DnDBeyond-style fields
      const spellLevels: Record<number, any[]> = {};
      for (const spell of spellItems) {
        const lvl = spell.system.level ?? 0;
        if (!spellLevels[lvl]) spellLevels[lvl] = [];

        // Activation time
        const actType = spell.system.activation?.type || "";
        const actVal = spell.system.activation?.value ?? "";
        const timeMap: Record<string, string> = {
          action: "A", bonus: "BA", reaction: "R", minute: "m", hour: "h",
        };
        const castTime = actVal
          ? `${actVal}${timeMap[actType] || actType}`
          : timeMap[actType] || actType || "—";

        // Range
        const rng = spell.system.range;
        let range = "—";
        if (rng?.value) range = `${rng.value} ${rng.units || "ft."}`;
        else if (rng?.units === "touch") range = "Touch";
        else if (rng?.units === "self") range = "Self";

        // Components
        const props = spell.system.properties;
        const comps: string[] = [];
        if (props?.has?.("vocal")) comps.push("V");
        if (props?.has?.("somatic")) comps.push("S");
        if (props?.has?.("material")) comps.push("M");
        const components = comps.join("/") || "—";

        // Source class
        const source = spell.system.sourceClass || "Cleric";

        // Effect/damage
        const dmg = spell.system.damage?.base;
        const effect = dmg?.formula || (spell.system.healing ? "Healing" : "—");

        spellLevels[lvl].push({
          id: spell.id,
          name: spell.name,
          img: spell.img,
          level: lvl,
          castTime,
          range,
          hitDc: "—",
          effect,
          components,
          source,
          prepared:
            spell.system.preparation?.mode === "prepared"
              ? spell.system.preparation?.prepared
              : true,
          concentration: props?.has?.("concentration"),
          ritual: props?.has?.("ritual"),
        });
      }
      const spellsByLevel = Object.entries(spellLevels)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([lvl, spells]) => ({
          level: Number(lvl),
          label: levelLabels[Number(lvl)] || `Level ${lvl}`,
          spells: spells.sort((a: any, b: any) =>
            a.name.localeCompare(b.name)
          ),
        }));

      // Spell slots
      const spellSlots = [];
      for (let i = 1; i <= 9; i++) {
        const slot = system.spells?.[`spell${i}`];
        if (slot) {
          const pips = [];
          for (let p = 0; p < (slot.max || 0); p++) {
            pips.push({ used: p >= (slot.value || 0) });
          }
          spellSlots.push({
            level: i,
            label: levelLabels[i] || `Level ${i}`,
            value: slot.value ?? 0,
            max: slot.max ?? 0,
            pips,
          });
        }
      }

      // Build inventory groups
      const invTypes = ["weapon", "equipment", "consumable", "container", "loot"];
      const invLabels: Record<string, string> = {
        weapon: "Weapons",
        equipment: "Equipment",
        consumable: "Consumables",
        container: "Containers",
        loot: "Loot",
      };
      const inventoryGroups = invTypes.map((type) => ({
        type,
        label: invLabels[type] || type,
        items: actor.items
          .filter((i: any) => i.type === type)
          .map((i: any) => {
            const price = i.system.price;
            const cost = price?.value ? `${price.value} ${price.denomination || "gp"}` : "";
            const subtype = i.system.type?.label || i.system.armor?.type || "";
            // Notes: AC for armor, damage for weapons, properties
            let notes = "";
            if (i.system.armor?.value) notes = `AC ${i.system.armor.value}`;
            else if (i.system.damage?.base?.formula) notes = i.system.damage.base.formula;
            if (i.system.uses?.max) notes += notes ? `, ${i.system.uses.value}/${i.system.uses.max} charges` : `${i.system.uses.value}/${i.system.uses.max} charges`;

            return {
              id: i.id,
              name: i.name,
              img: i.img,
              quantity: i.system.quantity ?? 1,
              weight: i.system.weight?.value ?? 0,
              equipped: !!i.system.equipped,
              attuned: i.system.attunement === "attuned",
              cost,
              subtype,
              notes,
            };
          }),
      }));
      const hasInventory = inventoryGroups.some((g) => g.items.length > 0);

      // Encumbrance
      const enc = system.attributes?.encumbrance || {};
      const encumbrance = {
        value: enc.value ?? 0,
        max: enc.max ?? 150,
        pct: enc.pct ?? 0,
      };

      // Feature groups with descriptions and pips
      const buildFeatureItem = (i: any) => {
        const uses = i.system.uses?.max
          ? {
              value: i.system.uses.value ?? 0,
              max: i.system.uses.max,
              per: i.system.uses.recovery?.[0]?.type || "",
            }
          : null;
        const pips: { filled: boolean }[] = [];
        if (uses) {
          for (let p = 0; p < uses.max; p++) {
            pips.push({ filled: p < uses.value });
          }
        }
        const fullDesc = i.system.description?.value || "";
        // Strip HTML tags for truncation
        const textOnly = fullDesc.replace(/<[^>]*>/g, "").trim();
        const truncated = textOnly.length > 80
          ? textOnly.substring(0, 80) + "…"
          : textOnly;

        return {
          id: i.id,
          name: i.name,
          img: i.img,
          source: i.system.requirements || "",
          description: fullDesc,
          truncatedDescription: truncated,
          hasLongDescription: textOnly.length > 80,
          uses,
          pips,
        };
      }

      const featureGroups = [
        {
          type: "class",
          label: "Class Features",
          items: actor.items
            .filter(
              (i: any) =>
                i.type === "feat" &&
                i.system.type?.value === "class"
            )
            .map(buildFeatureItem),
        },
        {
          type: "feat",
          label: "Feats",
          items: actor.items
            .filter(
              (i: any) =>
                i.type === "feat" &&
                (!i.system.type?.value ||
                  i.system.type?.value === "feat")
            )
            .map(buildFeatureItem),
        },
        {
          type: "race",
          label: "Species Traits",
          items: actor.items
            .filter(
              (i: any) =>
                i.type === "feat" &&
                i.system.type?.value === "race"
            )
            .map(buildFeatureItem),
        },
      ];
      const hasFeatures = featureGroups.some((g) => g.items.length > 0);

      // Resistances/Immunities for extras tab
      const dr = system.traits?.dr;
      const di = system.traits?.di;
      const ci = system.traits?.ci;
      const resistances = dr?.value ? [...dr.value] : [];
      const immunities = di?.value ? [...di.value] : [];
      const conditionImmunities = ci?.value ? [...ci.value] : [];

      // Active conditions on the actor
      const conditions = actor.effects
        ?.filter((e: any) => e.type === "condition" || e.statuses?.size > 0)
        ?.map((e: any) => e.name) || [];
      const hasDefenses = resistances.length > 0 || immunities.length > 0 ||
        conditionImmunities.length > 0 || conditions.length > 0;

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
        inventoryGroups,
        hasInventory,
        encumbrance,
        featureGroups,
        hasFeatures,
        resistances,
        immunities,
        conditionImmunities,
        conditions,
        hasDefenses,
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

    static #onHeal(this: any) {
      const input = this.element.querySelector(
        ".bcs-hp-input"
      ) as HTMLInputElement;
      const val = parseInt(input?.value || "0", 10);
      if (val > 0) {
        this.document.applyDamage(-val);
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

    /** @override */
    _getHeaderControls() {
      const controls = super._getHeaderControls();
      controls.unshift({
        icon: "fas fa-exchange-alt",
        label: "Classic View",
        action: "toggleClassicSheet",
        ownership: "OWNER",
      });
      return controls;
    }

    /** @override */
    async _onRender(context: any, options: any) {
      // Skip dnd5e's _onRender (it expects DOM elements from its own templates).
      // Go directly to the Foundry framework's base _onRender.
      const baseProto =
        foundry.applications.api.ApplicationV2.prototype as any;
      await baseProto._onRender.call(this, context, options);

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

      // Apply DnD Beyond backdrop image to the header
      if (context.backdropUrl) {
        const header = this.element.querySelector(".bcs-header") as HTMLElement | null;
        if (header) {
          header.style.setProperty(
            "background",
            `linear-gradient(to right, rgba(18,21,26,0.85), rgba(18,21,26,0.5)), url('${context.backdropUrl}') center / cover no-repeat`,
            "important"
          );
          header.classList.add("bcs-has-backdrop");
        }
      }

      // Tab switching
      this.element
        .querySelectorAll(".bcs-tab-btn")
        .forEach((btn: Element) => {
          btn.addEventListener("click", (e: Event) => {
            const tab = (e.currentTarget as HTMLElement).dataset.bcsTab;
            if (!tab) return;
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

      // Action filter pills
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
      // ========================================
      // PHASE 5: INTERACTIVITY
      // ========================================
      const actor = this.document;

      // 1. Ability checks — click ability score block
      this.element
        .querySelectorAll(".bcs-ability[data-ability]")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            const ability = (el as HTMLElement).dataset.ability;
            if (ability) actor.rollAbilityCheck({ ability, event: e });
          });
        });

      // 2. Saving throws — click save row
      this.element
        .querySelectorAll(".bcs-save-item[data-ability]")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            const ability = (el as HTMLElement).dataset.ability;
            if (ability) actor.rollSavingThrow({ ability, event: e });
          });
        });

      // 3. Skill checks — click skill row
      this.element
        .querySelectorAll(".bcs-skill-item[data-skill]")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            const skill = (el as HTMLElement).dataset.skill;
            if (skill) actor.rollSkill({ skill, event: e });
          });
        });

      // 4. Initiative — click initiative stat block
      this.element
        .querySelectorAll(".bcs-combat-init")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            actor.rollInitiativeDialog({ event: e });
          });
          (el as HTMLElement).style.cursor = "pointer";
        });

      // 5. Death saves — click death save pips (in extras tab)
      this.element
        .querySelectorAll(".bcs-death-saves")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            actor.rollDeathSave({ event: e, legacy: false });
          });
          (el as HTMLElement).style.cursor = "pointer";
        });

      // 6 & 7. Attack/spell rolls — click attack row or spell row to use the item
      this.element
        .querySelectorAll(
          ".bcs-attack-row[data-item-id], .bcs-spell-row[data-item-id]"
        )
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            const itemId = (el as HTMLElement).dataset.itemId;
            const item = actor.items.get(itemId);
            if (!item) return;
            // Use the first activity, or fall back to item.use()
            const activity = item.system.activities?.values()?.next()?.value;
            if (activity) {
              activity.use({ event: e, legacy: false });
            } else {
              item.use({ event: e, legacy: false });
            }
          });
          (el as HTMLElement).style.cursor = "pointer";
        });

      // 8 & 9. Heal/Damage buttons
      const hpInput = this.element.querySelector(
        ".bcs-hp-input"
      ) as HTMLInputElement;
      this.element
        .querySelectorAll(".bcs-heal-btn")
        .forEach((el: Element) => {
          el.addEventListener("click", () => {
            const val = parseInt(hpInput?.value || "0", 10);
            if (val > 0) {
              actor.applyDamage(-val);
              if (hpInput) hpInput.value = "";
            }
          });
        });
      this.element
        .querySelectorAll(".bcs-damage-btn")
        .forEach((el: Element) => {
          el.addEventListener("click", () => {
            const val = parseInt(hpInput?.value || "0", 10);
            if (val > 0) {
              actor.applyDamage(val);
              if (hpInput) hpInput.value = "";
            }
          });
        });

      // 11. Inspiration toggle
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

      // 12. Spell slot pips — click to toggle used/available
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

      // 13. Feature use pips — click to toggle used/available
      this.element
        .querySelectorAll(".bcs-feat-pip")
        .forEach((el: Element) => {
          el.addEventListener("click", () => {
            const itemEl = el.closest(
              "[data-item-id]"
            ) as HTMLElement;
            const itemId = itemEl?.dataset.itemId;
            if (!itemId) return;
            const item = actor.items.get(itemId);
            if (!item?.system.uses?.max) return;
            const isFilled = el.classList.contains("filled");
            // filled = available, clicking it = consume one
            // not filled = used up, clicking it = restore one
            const newVal = isFilled
              ? Math.max(
                  (item.system.uses.value || 0) - 1,
                  0
                )
              : Math.min(
                  (item.system.uses.value || 0) + 1,
                  item.system.uses.max
                );
            item.update({ "system.uses.value": newVal });
          });
        });

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

      // 16. Click item/spell name — open item sheet
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

      // 18. Equipped toggle — click the equip checkbox
      this.element
        .querySelectorAll(".bcs-equip-check")
        .forEach((el: Element) => {
          el.addEventListener("click", (e: Event) => {
            e.stopPropagation();
            const row = el.closest("[data-item-id]") as HTMLElement;
            const itemId = row?.dataset.itemId;
            if (!itemId) return;
            const item = actor.items.get(itemId);
            if (item) {
              item.update({
                "system.equipped": !item.system.equipped,
              });
            }
          });
          (el as HTMLElement).style.cursor = "pointer";
        });

      // ========================================
      // THEME CUSTOMIZATION
      // ========================================
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

      // Detail panel: click truncated text to show full description
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

      if (panel && panelTitle && panelBody) {
        this.element
          .querySelectorAll(
            ".bcs-feature-desc-truncated, .bcs-action-feature-desc-truncated"
          )
          .forEach((el: Element) => {
            el.addEventListener("click", () => {
              const itemId = (el as HTMLElement).dataset.itemId;
              const item = (this as any).document.items.get(itemId);
              if (!item) return;
              panelTitle.textContent = item.name;
              panelBody.innerHTML =
                item.system.description?.value || "";
              panel.dataset.panel = "open";
            });
          });

        panelClose?.addEventListener("click", () => {
          panel.dataset.panel = "closed";
        });
      }

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

    // Darken a hex color by mixing with near-black
    _darkenColor(hex: string, amount = 0.7): string {
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

