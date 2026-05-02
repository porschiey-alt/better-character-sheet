/**
 * Playwright helper to launch Foundry, join as Tester, and open a character sheet.
 * Usage: node test/foundry-helper.mjs [screenshot-name]
 *
 * Saves a screenshot to .debug/<screenshot-name>.png
 */
import { chromium } from "playwright";

const screenshotName = process.argv[2] || "foundry-sheet";
const FOUNDRY_URL = "http://localhost:30000";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // 1. Go to join page
  await page.goto(`${FOUNDRY_URL}/join`);
  await page.waitForTimeout(2000);

  // 2. Select Tester user and join
  await page.selectOption("select[name='userid']", { label: "Tester" });
  await page.click("button:has-text('Join Game Session')");
  await page.waitForTimeout(5000);

  // 3. Dismiss any dialogs/notifications (first-login config, warnings, etc.)
  await page.waitForTimeout(1000);

  // Force-dismiss the hardware acceleration warning banner first (it blocks clicks)
  await page.evaluate(() => {
    document.querySelectorAll('#notifications .notification').forEach(n => n.remove());
  });
  await page.waitForTimeout(500);

  // Close the player configuration dialog if it appears
  const configClose = await page.$('.application .window-header [data-action="close"]');
  if (configClose) {
    await configClose.click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(500);

  // 4. Open character sheet via the Actors sidebar
  await page.click('#sidebar-tabs [data-tab="actors"]');
  await page.waitForTimeout(1000);

  // 5. Open the character sheet via Foundry API (most reliable)
  const sheetOpened = await page.evaluate(() => {
    const actor = game.actors?.contents?.find(a => a.type === "character");
    if (actor) {
      actor.sheet.render(true);
      return actor.name;
    }
    return null;
  });
  if (sheetOpened) {
    console.log(`Opened sheet for: ${sheetOpened}`);
    await page.waitForTimeout(3000);
  } else {
    console.log("No character actor found");
  }

  // 5. Screenshot
  await page.screenshot({ path: `.debug/${screenshotName}.png`, fullPage: false });
  console.log(`Screenshot saved to .debug/${screenshotName}.png`);

  // Log any console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("BROWSER ERROR:", msg.text());
  });

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
