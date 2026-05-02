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

// Get ALL CSS rules that apply to window-content
const debug = await p.evaluate(()=>{
  const wc = document.querySelector(".better-character-sheet .window-content");
  if(!wc) return {error:"no wc"};
  
  // Get all matched CSS rules
  const rules = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText && wc.matches(rule.selectorText)) {
          const h = rule.style.height || rule.style.gridRow || rule.style.gridTemplateRows;
          if (h || rule.style.flex || rule.style.minHeight) {
            rules.push({
              selector: rule.selectorText.substring(0, 80),
              height: rule.style.height,
              flex: rule.style.flex,
              minHeight: rule.style.minHeight,
              gridRow: rule.style.gridRow,
            });
          }
        }
      }
    } catch(e) {}
  }
  
  // Check parent app for grid
  const app = wc.parentElement;
  const appS = getComputedStyle(app);
  
  return {
    rules,
    appGridTemplate: appS.gridTemplateRows,
    appGridTemplateC: appS.gridTemplateColumns,
    appDisplay: appS.display,
    appFlexDir: appS.flexDirection,
    appOverflow: appS.overflow,
  };
});
console.log(JSON.stringify(debug, null, 2));
await b.close();
