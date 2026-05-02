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

const data = await page.evaluate(() => {
  const actor = game.actors?.contents?.find((a) => a.type === "character");
  if (!actor) return { error: "no actor" };

  // Dump a few spells to see what fields exist
  const spells = actor.items.filter(i => i.type === "spell").slice(0, 5);
  return spells.map(s => ({
    name: s.name,
    level: s.system.level,
    actionType: s.system.actionType,
    hasActivities: !!s.system.activities,
    activitiesCount: s.system.activities?.size ?? Object.keys(s.system.activities || {}).length,
    firstActivity: (() => {
      const acts = s.system.activities;
      if (!acts) return null;
      const first = acts.values?.()?.next?.()?.value || Object.values(acts)[0];
      if (!first) return null;
      return {
        type: first.type,
        attack: first.attack,
        damage: first.damage,
        save: first.save,
        activation: first.activation,
      };
    })(),
    damage: s.system.damage,
    range: s.system.range,
    properties: s.system.properties ? [...s.system.properties] : null,
    activation: s.system.activation,
    components: s.system.components,
  }));
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
