import { chromium } from "playwright";
const b = await chromium.launch({headless:true});
const p = await b.newPage({viewport:{width:1400,height:900}});
await p.goto("http://localhost:30000/join");
await p.waitForTimeout(2000);
await p.selectOption("select[name='userid']",{label:"Tester"});
await p.click("button:has-text('Join Game Session')");
await p.waitForTimeout(6000);
await p.evaluate(()=>{document.querySelectorAll("#notifications .notification").forEach(n=>n.remove());});
await p.evaluate(()=>{const btn=document.querySelector('[id*="UserConfig"] [data-action="close"]');if(btn)btn.click();});
await p.waitForTimeout(1000);
await p.evaluate(async()=>{const a=game.actors?.get("lTiUF9R7Vc08jTK0");if(a)await a.sheet.render(true);});
await p.waitForTimeout(6000);
await p.evaluate(()=>{document.querySelectorAll("#notifications .notification").forEach(n=>n.remove());});

// Test: manually set a gradient and check if it applies
const result = await p.evaluate(() => {
  const app = document.querySelector(".better-character-sheet");
  const wc = app?.querySelector(".window-content");
  if (!app || !wc) return { error: "no app/wc" };

  // Set the gradient variable
  app.style.setProperty("--bcs-bg-gradient", "linear-gradient(to right, #1a0505, #05051a)");
  
  const wcStyle = getComputedStyle(wc);
  return {
    wcBackground: wcStyle.background,
    wcBackgroundImage: wcStyle.backgroundImage,
    appHasVar: app.style.getPropertyValue("--bcs-bg-gradient"),
  };
});
console.log(JSON.stringify(result, null, 2));
await p.screenshot({path:".debug/gradient-test.png"});
await b.close();
