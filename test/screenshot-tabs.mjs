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

await page.evaluate(() => {
  const actor = game.actors?.contents?.find((a) => a.type === "character");
  if (actor) actor.sheet.render(true);
});
await page.waitForTimeout(5000);

// Screenshot each tab
const tabs = ["actions", "spells", "inventory", "features", "background", "notes", "extras"];
for (const tab of tabs) {
  await page.click(`.bcs-tab-btn[data-bcs-tab="${tab}"]`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `.debug/tab-${tab}.png` });
  console.log(`Captured tab: ${tab}`);
}

await browser.close();
