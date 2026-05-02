import { chromium } from "playwright";
const b = await chromium.launch({headless:true});
const p = await b.newPage({viewport:{width:1400,height:900}});
await p.goto("http://localhost:30000/join");
await p.waitForTimeout(2000);
await p.selectOption("select[name='userid']",{label:"Tester"});
await p.click("button:has-text('Join Game Session')");
await p.waitForTimeout(5000);
await p.evaluate(()=>{document.querySelectorAll("#notifications .notification").forEach(n=>n.remove());});
await p.waitForTimeout(500);
// Save & close player config if present
await p.evaluate(() => {
  const closeBtn = document.querySelector('.application:not(.better-character-sheet) .window-header [data-action="close"]');
  if (closeBtn) closeBtn.click();
});
await p.waitForTimeout(1000);

await p.evaluate(()=>{const a=game.actors?.contents?.find(a=>a.type==="character");if(a)a.sheet.render(true);});
await p.waitForTimeout(6000);
await p.evaluate(()=>{document.querySelectorAll("#notifications .notification").forEach(n=>n.remove());});
const info = await p.evaluate(()=>{
  const app = document.querySelector(".better-character-sheet");
  if(!app) return {error:"no app"};
  const hdr = app.querySelector(".window-header");
  const s = hdr ? getComputedStyle(hdr) : null;
  // Check all direct children of app
  const children = [...app.children].map(c => ({
    tag: c.tagName, 
    classes: [...c.classList].join(" "),
    display: getComputedStyle(c).display,
    height: getComputedStyle(c).height,
    overflow: getComputedStyle(c).overflow,
  }));
  return {
    hasHeader: !!hdr,
    headerDisplay: s?.display,
    headerHeight: s?.height,
    headerOverflow: s?.overflow,
    appDisplay: getComputedStyle(app).display,
    appFlexDir: getComputedStyle(app).flexDirection,
    appOverflow: getComputedStyle(app).overflow,
    children,
  };
});
console.log(JSON.stringify(info,null,2));
await p.screenshot({path:".debug/header-debug.png"});
await b.close();
