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

// Check if window-content has an inline style height
const debug = await p.evaluate(()=>{
  const app = document.querySelector(".better-character-sheet");
  if(!app) return {error:"no app"};
  const wc = app.querySelector(".window-content");
  const hdr = app.querySelector(".window-header");
  return {
    appInlineStyle: app.getAttribute("style"),
    wcInlineStyle: wc?.getAttribute("style"),
    hdrInlineStyle: hdr?.getAttribute("style"),
    appHeight: getComputedStyle(app).height,
    wcHeight: getComputedStyle(wc).height,
    hdrHeight: getComputedStyle(hdr).height,
    wcFlex: getComputedStyle(wc).flex,
    wcMinHeight: getComputedStyle(wc).minHeight,
    // Check if bcs-header is overlapped
    bcsHeader: (() => {
      const h = app.querySelector(".bcs-header");
      if (!h) return null;
      const r = h.getBoundingClientRect();
      const hr = hdr.getBoundingClientRect();
      return { bcsTop: r.top, bcsBottom: r.bottom, hdrTop: hr.top, hdrBottom: hr.bottom, overlaps: r.top < hr.bottom };
    })(),
  };
});
console.log(JSON.stringify(debug, null, 2));
await p.screenshot({path:".debug/header-fix.png"});
await b.close();
