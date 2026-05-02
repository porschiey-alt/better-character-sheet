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

// Check Axios spell preparation modes
const data = await p.evaluate(() => {
  const actor = game.actors?.contents?.find(a => a.name === "Axios 2024");
  if (!actor) return { error: "no Axios" };
  const spells = actor.items.filter(i => i.type === "spell");
  return spells.map(s => ({
    name: s.name,
    level: s.system.level,
    prepMode: s.system.preparation?.mode,
    prepared: s.system.preparation?.prepared,
  }));
});
console.log(JSON.stringify(data, null, 2));
await b.close();
