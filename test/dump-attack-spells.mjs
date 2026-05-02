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

  // Find spells with attack or damage activities
  const spells = actor.items.filter(i => i.type === "spell");
  return spells.map(s => {
    const acts = s.system.activities;
    const actList = [];
    if (acts) {
      for (const act of acts.values()) {
        actList.push({
          type: act.type,
          attackType: act.attack?.type?.value,
          attackFlat: act.attack?.flat,
          attackBonus: act.attack?.bonus,
          damageFormula: act.damage?.parts?.[0]?.formula,
          damageType: act.damage?.parts?.[0]?.types?.[0],
          saveAbility: act.save?.ability,
          saveDC: act.save?.dc?.value,
        });
      }
    }
    return {
      name: s.name,
      level: s.system.level,
      activitiesTypes: actList.map(a => a.type),
      hasAttackActivity: actList.some(a => a.type === "attack"),
      hasSaveActivity: actList.some(a => a.type === "save"),
      hasDamageActivity: actList.some(a => a.type === "damage"),
      hasHealActivity: actList.some(a => a.type === "heal"),
      activities: actList.length > 0 ? actList : null,
    };
  }).filter(s => s.hasAttackActivity || s.hasSaveActivity || s.hasDamageActivity);
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
