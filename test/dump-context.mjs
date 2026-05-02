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

// Dump the sheet context data
const data = await page.evaluate(async () => {
  const actor = game.actors?.contents?.find((a) => a.type === "character");
  if (!actor) return { error: "no actor" };
  const sheet = actor.sheet;
  // Get context by calling _prepareContext
  const ctx = await sheet._prepareContext({});
  return {
    hasAbilityRows: !!ctx.abilityRows,
    abilityRowsTopKeys: ctx.abilityRows?.top?.map(a => a.key),
    abilityRowsBottomKeys: ctx.abilityRows?.bottom?.map(a => a.key),
    firstAbility: ctx.abilityRows?.top?.[0],
    skillsType: typeof ctx.skills,
    skillsIsArray: Array.isArray(ctx.skills),
    skillsLength: Array.isArray(ctx.skills) ? ctx.skills.length : Object.keys(ctx.skills || {}).length,
    firstSkill: Array.isArray(ctx.skills) ? ctx.skills[0] : Object.entries(ctx.skills || {})[0],
    savesKeys: Object.keys(ctx.saves || {}),
    firstSave: Object.values(ctx.saves || {})[0],
    labelsClass: ctx.labels?.class,
    speciesName: ctx.species?.name,
    portrait: ctx.portrait,
    traitsKeys: Object.keys(ctx.traits || {}),
    traitsArmor: ctx.traits?.armor,
    sensesType: typeof ctx.senses,
    sensesIsArray: Array.isArray(ctx.senses),
    senses: ctx.senses,
    abilitiesStr: ctx.system?.abilities?.str,
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
