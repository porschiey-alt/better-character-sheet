import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errors = [];
page.on("pageerror", err => errors.push(err.message));
page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });

await page.goto("http://localhost:30000/join");
await page.waitForTimeout(2000);
await page.selectOption("select[name='userid']", { label: "Tester" });
await page.click("button:has-text('Join Game Session')");
await page.waitForTimeout(6000);

// Remove notifications
await page.evaluate(() => {
  document.querySelectorAll("#notifications .notification").forEach(n => n.remove());
});

// Close UserConfig via DOM
await page.evaluate(() => {
  const btn = document.querySelector('[id*="UserConfig"] [data-action="close"]');
  if (btn) btn.click();
});
await page.waitForTimeout(1000);

// Open actors sidebar and double-click Refuge
await page.click('#sidebar-tabs [data-tab="actors"]');
await page.waitForTimeout(1000);

// Open via API
const openResult = await page.evaluate(async () => {
  const actor = game.actors?.get("lTiUF9R7Vc08jTK0");
  if (!actor) return "no actor";
  try {
    await actor.sheet.render(true);
    return "rendered";
  } catch(e) {
    return "error: " + e.message;
  }
});
console.log("Open result:", openResult);
await page.waitForTimeout(8000);

// Remove notifications again
await page.evaluate(() => {
  document.querySelectorAll("#notifications .notification").forEach(n => n.remove());
});

// Check state
const info = await page.evaluate(() => {
  const app = document.querySelector(".better-character-sheet");
  if (!app) return { error: "no app", allApps: [...document.querySelectorAll(".application")].map(a => a.id) };
  const hdr = app.querySelector(".window-header");
  const s = hdr ? getComputedStyle(hdr) : null;
  return {
    hasHeader: !!hdr,
    headerDisplay: s?.display,
    headerHeight: s?.height,
    headerOverflow: s?.overflow,
    appDisplay: getComputedStyle(app).display,
    appOverflow: getComputedStyle(app).overflow,
    children: [...app.children].map(c => ({
      tag: c.tagName, cls: [...c.classList].join(" "),
      display: getComputedStyle(c).display, height: getComputedStyle(c).height,
    })),
  };
});
console.log(JSON.stringify(info, null, 2));
console.log("Errors:", errors.filter(e => !e.includes("CORS")).slice(0, 5));

await page.screenshot({ path: ".debug/header-fix.png" });
await browser.close();
