import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const pageErrors = [];
page.on("pageerror", err => pageErrors.push(err.message));
page.on("console", msg => { if (msg.type() === "error") pageErrors.push(msg.text()); });

await page.goto("http://localhost:30000/join");
await page.waitForTimeout(2000);
await page.selectOption("select[name='userid']", { label: "Tester" });
await page.click("button:has-text('Join Game Session')");
await page.waitForTimeout(6000);

// Remove notification banners
await page.evaluate(() => {
  document.querySelectorAll("#notifications .notification").forEach(n => n.remove());
});

// Dismiss UserConfig via DOM click
await page.evaluate(() => {
  const closeBtn = document.querySelector('[id*="UserConfig"] [data-action="close"]');
  if (closeBtn) closeBtn.click();
});
await page.waitForTimeout(1500);

// Open the character sheet
const openResult = await page.evaluate(() => {
  const actors = game.actors?.contents || [];
  const charActors = actors.filter(a => a.type === "character");
  return {
    totalActors: actors.length,
    charActors: charActors.map(a => ({ name: a.name, owner: a.isOwner, id: a.id })),
  };
});
console.log("Actors:", JSON.stringify(openResult, null, 2));

await page.evaluate(() => {
  // Try to open any character, owned or not
  const actor = game.actors?.contents?.find(a => a.type === "character");
  if (actor) {
    console.log("Opening sheet for", actor.name);
    actor.sheet.render(true);
  }
});
await page.waitForTimeout(5000);

// Remove notifications again
await page.evaluate(() => {
  document.querySelectorAll("#notifications .notification").forEach(n => n.remove());
});
await page.waitForTimeout(500);

// Check ALL DOM elements
const info2 = await page.evaluate(() => {
  const bcs = document.querySelector(".better-character-sheet");
  const anySheet = document.querySelector("[id*='BetterCharacterSheet']");
  return {
    appCount: allApps.length,
    apps: [...allApps].map(a => a.id || [...a.classList].join(" ")),
    hasBCS: !!bcs,
    hasSheetById: !!anySheet,
    // Check if render errored by looking at the sheet object
    sheetState: (() => {
      const actor = game.actors?.get("lTiUF9R7Vc08jTK0");
      if (!actor) return "no actor";
      return { rendered: actor.sheet.rendered, state: actor.sheet._state, id: actor.sheet.id };
    })(),
  };
});

// Remove notifications again
await page.evaluate(() => {
  document.querySelectorAll("#notifications .notification").forEach(n => n.remove());
});
await page.waitForTimeout(500);

// Debug: check the sheet DOM
const info = await page.evaluate(() => {
  const app = document.querySelector(".better-character-sheet");
  if (!app) return { error: "no app found", allApps: [...document.querySelectorAll(".application")].map(a => a.classList[0] + " " + a.id) };
  const hdr = app.querySelector(".window-header");
  const hdrS = hdr ? getComputedStyle(hdr) : null;
  const appS = getComputedStyle(app);
  return {
    appId: app.id,
    appDisplay: appS.display,
    appFlexDir: appS.flexDirection,
    appOverflow: appS.overflow,
    hasHeader: !!hdr,
    headerDisplay: hdrS?.display,
    headerHeight: hdrS?.height,
    headerVisibility: hdrS?.visibility,
    headerOverflow: hdrS?.overflow,
    headerFlexShrink: hdrS?.flexShrink,
    children: [...app.children].map(c => ({
      tag: c.tagName,
      cls: [...c.classList].join(" "),
      display: getComputedStyle(c).display,
      height: getComputedStyle(c).height,
    })),
  };
});
console.log(JSON.stringify(info, null, 2));

console.log("Errors:", JSON.stringify(pageErrors.filter(e => !e.includes("CORS") && !e.includes("favicon")), null, 2));

await page.screenshot({ path: ".debug/header-fix.png" });
await browser.close();
