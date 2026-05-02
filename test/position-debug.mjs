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

const debug = await p.evaluate(()=>{
  const wc = document.querySelector(".better-character-sheet .window-content");
  const hdr = document.querySelector(".better-character-sheet .window-header");
  const app = document.querySelector(".better-character-sheet");
  const wcS = getComputedStyle(wc);
  const hdrS = getComputedStyle(hdr);
  const appS = getComputedStyle(app);
  return {
    wc: { position: wcS.position, top: wcS.top, left: wcS.left, right: wcS.right, bottom: wcS.bottom, margin: wcS.margin, padding: wcS.padding },
    hdr: { position: hdrS.position, top: hdrS.top, margin: hdrS.margin },
    app: { position: appS.position, display: appS.display, flexDir: appS.flexDirection },
  };
});
console.log(JSON.stringify(debug, null, 2));
await b.close();
