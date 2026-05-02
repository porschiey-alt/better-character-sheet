import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(err.toString()));

await page.goto("http://localhost:30000/join");
await page.waitForTimeout(2000);
await page.selectOption("select[name='userid']", { label: "Tester" });
await page.click("button:has-text('Join Game Session')");
await page.waitForTimeout(5000);
await page.evaluate(() => {
  document.querySelectorAll("#notifications .notification").forEach((n) => n.remove());
  document.querySelectorAll('.application .window-header [data-action="close"]').forEach(b => b.click());
});
await page.waitForTimeout(1000);

const result = await page.evaluate(() => {
  const actor = game.actors?.contents?.find((a) => a.type === "character");
  if (!actor) return { error: "no actor found" };
  actor.sheet.render(true);
  return { name: actor.name, owner: actor.isOwner, sheetClass: actor.sheet.constructor.name };
});
console.log("Result:", JSON.stringify(result));
await page.waitForTimeout(8000);

// Dismiss any error notifications blocking the view
await page.evaluate(() => {
  document.querySelectorAll("#notifications .notification").forEach((n) => n.remove());
});
await page.waitForTimeout(500);

// Click actions tab (default)
await page.screenshot({ path: ".debug/phase2-debug.png" });
await browser.close();
