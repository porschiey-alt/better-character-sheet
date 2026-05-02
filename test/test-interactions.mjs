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

// Test: verify click handlers are wired
const tests = await p.evaluate(() => {
  const sheet = document.querySelector(".better-character-sheet");
  if (!sheet) return { error: "no sheet" };
  
  const results = {};
  
  // Check ability scores have click handlers
  const abs = sheet.querySelectorAll(".bcs-ability[data-ability]");
  results["abilityBlocks"] = abs.length;
  
  // Check saves
  const saves = sheet.querySelectorAll(".bcs-save-item[data-ability]");
  results["saveItems"] = saves.length;
  
  // Check skills
  const skills = sheet.querySelectorAll(".bcs-skill-item[data-skill]");
  results["skillItems"] = skills.length;
  
  // Check attack rows
  const attacks = sheet.querySelectorAll(".bcs-attack-row[data-item-id]");
  results["attackRows"] = attacks.length;
  
  // Check spell rows
  const spells = sheet.querySelectorAll(".bcs-spell-row[data-item-id]");
  results["spellRows"] = spells.length;
  
  // Check slot pips
  const slotPips = sheet.querySelectorAll(".bcs-slot-pip");
  results["slotPips"] = slotPips.length;
  
  // Check feat pips
  const featPips = sheet.querySelectorAll(".bcs-feat-pip");
  results["featPips"] = featPips.length;
  
  // Check HP controls
  results["hpInput"] = !!sheet.querySelector(".bcs-hp-input");
  results["healBtn"] = !!sheet.querySelector(".bcs-heal-btn");
  results["damageBtn"] = !!sheet.querySelector(".bcs-damage-btn");
  
  // Check inspiration
  results["inspiration"] = !!sheet.querySelector(".bcs-inspiration");
  
  // Check equip toggles
  results["equipChecks"] = sheet.querySelectorAll(".bcs-equip-check").length;
  
  return results;
});
console.log("Interactive elements:", JSON.stringify(tests, null, 2));
await b.close();
