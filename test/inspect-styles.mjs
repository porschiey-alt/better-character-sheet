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

// Inspect computed styles
const styles = await page.evaluate(() => {
  // Try multiple selectors
  const sheet = document.querySelector(".better-character-sheet") 
    || document.querySelector(".bcs-sheet")?.closest(".application");
  const allApps = document.querySelectorAll(".application");
  if (!sheet) return { error: "no sheet found", appCount: allApps.length, appClasses: [...allApps].map(a => [...a.classList].join(" ")) };

  const portrait = sheet.querySelector(".bcs-portrait img");
  const portraitStyles = portrait ? getComputedStyle(portrait) : null;

  const restBtn = sheet.querySelector(".bcs-rest-btn");
  const restBtnStyles = restBtn ? getComputedStyle(restBtn) : null;

  const subtitle = sheet.querySelector(".bcs-subtitle");
  const subtitleStyles = subtitle ? getComputedStyle(subtitle) : null;

  const nameInput = sheet.querySelector("input[name='name']");
  const nameStyles = nameInput ? getComputedStyle(nameInput) : null;

  const abilityBlock = sheet.querySelector(".bcs-ability");
  const abilityStyles = abilityBlock ? getComputedStyle(abilityBlock) : null;

  return {
    portrait: {
      opacity: portraitStyles?.opacity,
      background: portraitStyles?.background,
      found: !!portrait,
    },
    restBtn: {
      background: restBtnStyles?.background,
      backgroundColor: restBtnStyles?.backgroundColor,
      color: restBtnStyles?.color,
      found: !!restBtn,
    },
    subtitle: {
      color: subtitleStyles?.color,
      fontSize: subtitleStyles?.fontSize,
      fontWeight: subtitleStyles?.fontWeight,
      textShadow: subtitleStyles?.textShadow,
      found: !!subtitle,
    },
    nameInput: {
      color: nameStyles?.color,
      found: !!nameInput,
    },
    ability: {
      backgroundColor: abilityStyles?.backgroundColor,
      found: !!abilityBlock,
    },
    // Check if our stylesheet is loaded
    stylesheets: Array.from(document.styleSheets)
      .map(s => s.href)
      .filter(h => h && h.includes("better-character-sheet")),
  };
});
console.log(JSON.stringify(styles, null, 2));
await browser.close();
