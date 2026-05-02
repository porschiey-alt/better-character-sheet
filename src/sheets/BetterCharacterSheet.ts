import { fetchDDBBackdrop } from "../helpers/ddb-backdrop.ts";

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
        actions: {
          shortRest: BetterCharacterSheet.#onShortRest,
          longRest: BetterCharacterSheet.#onLongRest,
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

      // DnD Beyond backdrop image (via ddb-importer flags)
      const backdropUrl = await fetchDDBBackdrop(this.document);

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

      // Weapons
      for (const i of actor.items.filter((i: any) => i.type === "weapon")) {
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

      // Attack spells — any spell with an attack or save+damage activity
      for (const i of actor.items.filter((i: any) => i.type === "spell")) {
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
          return {
            id: i.id,
            name: i.name,
            img: i.img,
            description: i.system.description?.value || "",
            activationType,
            activationLabel: labelMap[actType] || "",
            uses,
            pips,
          };
        })
        .filter((f: any) => f.activationType !== "other" || f.uses);

      // Categorize spells by activation type for the action tab sections
      const spellItems = actor.items.filter(
        (i: any) => i.type === "spell"
      );
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
        return {
          id: i.id,
          name: i.name,
          img: i.img,
          source: i.system.requirements || "",
          description: i.system.description?.value || "",
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
        module: "better-character-sheet",
      };
    }

    static #onShortRest(this: any) {
      this.document.shortRest();
    }

    static #onLongRest(this: any) {
      this.document.longRest();
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

      // Apply DnD Beyond backdrop image to the header
      if (context.backdropUrl) {
        const header = this.element.querySelector(".bcs-header") as HTMLElement | null;
        if (header) {
          header.style.backgroundImage =
            `linear-gradient(to right, rgba(18,21,26,0.85), rgba(18,21,26,0.5)), url('${context.backdropUrl}')`;
          header.style.backgroundSize = "cover";
          header.style.backgroundPosition = "center";
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
  };
}
