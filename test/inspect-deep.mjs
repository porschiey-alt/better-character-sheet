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
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  // Check ALL stylesheets
  const sheets = Array.from(document.styleSheets).map(s => ({
    href: s.href,
    rulesCount: (() => { try { return s.cssRules?.length; } catch { return "blocked"; } })(),
  }));

  // Check link tags
  const links = Array.from(document.querySelectorAll("link[rel='stylesheet']")).map(l => l.href);

  // Check the portrait container computed styles
  const portraitDiv = document.querySelector(".bcs-portrait");
  const portraitDivStyles = portraitDiv ? getComputedStyle(portraitDiv) : null;
  const portraitImg = document.querySelector(".bcs-portrait img");
  const portraitImgStyles = portraitImg ? getComputedStyle(portraitImg) : null;

  // Check the FULL application element for opacity
  const app = document.querySelector(".better-character-sheet");
  const appStyles = app ? getComputedStyle(app) : null;
  const windowContent = app?.querySelector(".window-content");
  const wcStyles = windowContent ? getComputedStyle(windowContent) : null;

  return {
    sheetsWithBCS: sheets.filter(s => s.href?.includes("better")),
    linksWithBCS: links.filter(l => l.includes("better")),
    totalSheets: sheets.length,
    portraitContainer: {
      background: portraitDivStyles?.backgroundColor,
      opacity: portraitDivStyles?.opacity,
      overflow: portraitDivStyles?.overflow,
    },
    portraitImg: {
      opacity: portraitImgStyles?.opacity,
      mixBlendMode: portraitImgStyles?.mixBlendMode,
      filter: portraitImgStyles?.filter,
    },
    app: {
      opacity: appStyles?.opacity,
      background: appStyles?.backgroundColor,
    },
    windowContent: {
      opacity: wcStyles?.opacity,
      background: wcStyles?.backgroundColor,
    },
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
