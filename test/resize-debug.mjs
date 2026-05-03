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

const info = await p.evaluate(() => {
  const app = document.querySelector(".better-character-sheet");
  if (!app) return { error: "no app" };
  const handle = app.querySelector(".window-resize-handle");
  const wc = app.querySelector(".window-content");
  if (!handle) return { error: "no resize handle in DOM" };
  const hs = getComputedStyle(handle);
  const hr = handle.getBoundingClientRect();
  const ar = app.getBoundingClientRect();
  const wr = wc.getBoundingClientRect();
  return {
    handleExists: true,
    handleDisplay: hs.display,
    handlePosition: hs.position,
    handleZIndex: hs.zIndex,
    handleWidth: hs.width,
    handleHeight: hs.height,
    handleRect: { top: hr.top, bottom: hr.bottom, left: hr.left, right: hr.right },
    appRect: { bottom: ar.bottom, right: ar.right },
    wcRect: { bottom: wr.bottom, right: wr.right },
    handleVisible: hr.width > 0 && hr.height > 0,
    handleInsideApp: hr.bottom <= ar.bottom && hr.right <= ar.right,
    handleBelowContent: hr.top >= wr.bottom,
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
