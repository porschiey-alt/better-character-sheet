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

  // Check all feats and their activation types
  const feats = actor.items.filter(i => i.type === "feat");
  return feats.map(f => ({
    name: f.name,
    activationType: f.system.activation?.type,
    activationValue: f.system.activation?.value,
    hasUses: !!f.system.uses?.max,
    usesMax: f.system.uses?.max,
    featType: f.system.type?.value,
    // Also check activities
    activitiesCount: f.system.activities?.size ?? 0,
    activities: (() => {
      const acts = f.system.activities;
      if (!acts) return [];
      const result = [];
      for (const act of acts.values()) {
        result.push({
          type: act.type,
          activationType: act.activation?.type,
        });
      }
      return result;
    })(),
  })).filter(f => 
    f.activationType === "reaction" || 
    f.activities.some(a => a.activationType === "reaction")
  );
});
console.log("REACTION FEATURES:", JSON.stringify(data, null, 2));
await browser.close();
