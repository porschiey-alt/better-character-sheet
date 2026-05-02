import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto("http://localhost:30000/join");
await page.waitForTimeout(2000);
await page.selectOption("select[name='userid']", { label: "Tester" });
await page.click("button:has-text('Join Game Session')");
await page.waitForTimeout(5000);
await page.evaluate(() => { document.querySelectorAll("#notifications .notification").forEach((n) => n.remove()); });
const cfg = await page.$('.application .window-header [data-action="close"]');
if (cfg) await cfg.click({ force: true });
await page.waitForTimeout(500);

const data = await page.evaluate(async () => {
  const actor = game.actors?.contents?.find((a) => a.type === "character");
  if (!actor) return { error: "no actor" };

  const items = actor.items.contents;
  
  // Group items by type
  const byType = {};
  for (const item of items) {
    const t = item.type;
    if (!byType[t]) byType[t] = [];
    byType[t].push({
      name: item.name,
      type: item.type,
      img: item.img,
      system: {
        quantity: item.system.quantity,
        weight: item.system.weight?.value,
        equipped: item.system.equipped,
        attunement: item.system.attunement,
        rarity: item.system.rarity,
        uses: item.system.uses ? { value: item.system.uses.value, max: item.system.uses.max, per: item.system.uses.recovery?.[0]?.type } : null,
        damage: item.system.damage?.base ? { formula: item.system.damage.base.formula, type: item.system.damage.base.types?.[0] } : null,
        range: item.system.range ? { value: item.system.range.value, units: item.system.range.units } : null,
        level: item.system.level,
        school: item.system.school,
        preparation: item.system.preparation,
        description: item.system.description?.value?.substring(0, 100),
      },
    });
  }

  // Spellbook from sheet context
  const sheet = actor.sheet;
  const ctx = await sheet._prepareContext({});

  return {
    itemTypes: Object.keys(byType).map(t => `${t}: ${byType[t].length}`),
    byType,
    spellbook: ctx.spellbook ? Object.keys(ctx.spellbook) : null,
    itemCategories: ctx.itemCategories ? Object.keys(ctx.itemCategories) : null,
    biography: {
      trait: actor.system.details?.trait,
      ideal: actor.system.details?.ideal,
      bond: actor.system.details?.bond,
      flaw: actor.system.details?.flaw,
      biography: actor.system.details?.biography?.value?.substring(0, 100),
    },
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
