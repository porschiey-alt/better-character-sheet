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

const debug = await p.evaluate(()=>{
  const wc = document.querySelector(".better-character-sheet .window-content");
  const hdr = document.querySelector(".better-character-sheet .window-header");
  if(!wc) return {error:"no wc"};
  
  // Check actual bounding rects
  const wcRect = wc.getBoundingClientRect();
  const hdrRect = hdr.getBoundingClientRect();
  const appRect = wc.parentElement.getBoundingClientRect();
  
  return {
    app: { top: appRect.top, bottom: appRect.bottom, height: appRect.height },
    hdr: { top: hdrRect.top, bottom: hdrRect.bottom, height: hdrRect.height },
    wc: { top: wcRect.top, bottom: wcRect.bottom, height: wcRect.height },
    wcStartsAfterHeader: wcRect.top >= hdrRect.bottom,
    overlap: hdrRect.bottom - wcRect.top,
  };
});
console.log(JSON.stringify(debug, null, 2));
await p.screenshot({path:".debug/header-fix.png"});
await b.close();
