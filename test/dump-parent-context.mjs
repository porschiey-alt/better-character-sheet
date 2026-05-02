import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.toString()));

await page.goto("http://localhost:30000/join");
await page.waitForTimeout(2000);
await page.selectOption("select[name='userid']", { label: "Tester" });
await page.click("button:has-text('Join Game Session')");
await page.waitForTimeout(5000);
await page.evaluate(() => { document.querySelectorAll("#notifications .notification").forEach((n) => n.remove()); });
const cfg = await page.$('.application .window-header [data-action="close"]');
if (cfg) await cfg.click({ force: true });
await page.waitForTimeout(500);

// Dump raw parent context (before our override)
const data = await page.evaluate(async () => {
  const actor = game.actors?.contents?.find((a) => a.type === "character");
  if (!actor) return { error: "no actor" };
  
  // Get parent class _prepareContext directly
  const Parent = dnd5e.applications.actor.CharacterActorSheet;
  const ctx = await Parent.prototype._prepareContext.call(actor.sheet, {});
  
  return {
    // Check top-level keys
    topKeys: Object.keys(ctx).sort(),
    // Skills shape
    skillsType: typeof ctx.skills,
    skillsIsArray: Array.isArray(ctx.skills),
    skillsSample: Array.isArray(ctx.skills) 
      ? ctx.skills.slice(0, 2) 
      : Object.entries(ctx.skills || {}).slice(0, 2).map(([k, v]) => ({ key: k, ...v })),
    // Abilities
    abilityRowsTop: ctx.abilityRows?.top?.length,
    abilityRowsBottom: ctx.abilityRows?.bottom?.length,
    abilities: ctx.abilities ? Object.keys(ctx.abilities) : null,
    // Check for various trait/sense paths
    hasSenses: !!ctx.senses,
    hasTraits: !!ctx.traits,
    hasDetails: !!ctx.details,
    // Check what the context.details has
    detailsKeys: ctx.details ? Object.keys(ctx.details) : null,
    // Species/labels
    species: ctx.species ? { name: ctx.species.name } : null,
    labels: ctx.labels ? Object.keys(ctx.labels) : null,
    labelsClass: ctx.labels?.class,
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
