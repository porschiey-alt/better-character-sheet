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

// Dump full DOM tree of the application element
const domInfo = await page.evaluate(() => {
  const app = document.querySelector(".better-character-sheet");
  if (!app) return { error: "no app" };

  function getElementInfo(el, depth = 0) {
    if (depth > 4) return "...";
    const s = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      classes: [...el.classList].join(" "),
      id: el.id || undefined,
      bg: s.backgroundColor,
      opacity: s.opacity,
      display: s.display,
      gridTemplate: s.gridTemplateColumns,
      children: depth < 4 ? [...el.children].slice(0, 8).map(c => getElementInfo(c, depth + 1)) : "..."
    };
  }

  return getElementInfo(app);
});
console.log(JSON.stringify(domInfo, null, 2));
await browser.close();
