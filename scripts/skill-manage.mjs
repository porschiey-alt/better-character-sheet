#!/usr/bin/env node
/**
 * Skill Management Script
 *
 * Manage skill lifecycle: rank, expire, list.
 *
 * Usage:
 *   node scripts/skill-manage.mjs <command> [options]
 *
 * Commands:
 *   list                          List all skills with metadata
 *   uprank <id> [--amount 10]     Increase effectiveness score
 *   downrank <id> [--amount 10]   Decrease effectiveness score
 *   expire [--days 90] [--min-score 20]   List stale skills
 */

import { loadAllSkills, updateSkillMeta } from './lib/frontmatter.mjs';
import { resolve } from 'node:path';

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const opts = { command, id: null, amount: 10, days: 90, minScore: 20 };

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--amount' && args[i + 1]) opts.amount = parseInt(args[++i]);
    else if (args[i] === '--days' && args[i + 1]) opts.days = parseInt(args[++i]);
    else if (args[i] === '--min-score' && args[i + 1]) opts.minScore = parseInt(args[++i]);
    else if (!opts.id) opts.id = args[i];
  }

  return opts;
}

async function listSkills(skills) {
  const header = 'ID'.padEnd(50) + 'Category'.padEnd(15) + 'Score'.padEnd(8) + 'Reads'.padEnd(8) + 'Source';
  console.log(header);
  console.log('-'.repeat(header.length));

  const sorted = [...skills].sort(
    (a, b) => (b.meta.effectiveness_score ?? 50) - (a.meta.effectiveness_score ?? 50)
  );

  for (const skill of sorted) {
    const id = (skill.meta.id || 'unknown').substring(0, 48);
    const cat = (skill.meta.problem_category || '-').substring(0, 13);
    const score = String(skill.meta.effectiveness_score ?? 50);
    const reads = String(skill.meta.read_count || 0);
    const source = skill.meta.source || 'manual';
    console.log(`${id.padEnd(50)}${cat.padEnd(15)}${score.padEnd(8)}${reads.padEnd(8)}${source}`);
  }

  console.log(`\nTotal: ${skills.length} skill(s)`);
}

async function rankSkill(skills, id, amount) {
  const skill = skills.find(s => s.meta.id === id);
  if (!skill) {
    console.error(`Skill not found: ${id}`);
    console.error('Available skills:');
    skills.forEach(s => console.error(`  - ${s.meta.id || '(no id)'}`));
    process.exit(1);
  }

  const currentScore = skill.meta.effectiveness_score ?? 50;
  const newScore = Math.max(0, Math.min(100, currentScore + amount));

  await updateSkillMeta(skill.path, { effectiveness_score: newScore });
  console.log(`${skill.meta.id}: ${currentScore} → ${newScore}`);
}

async function expireSkills(skills, maxDays, minScore) {
  const now = Date.now();
  const stale = [];

  for (const skill of skills) {
    const score = skill.meta.effectiveness_score ?? 50;
    const lastUsed = skill.meta.last_used_at ? new Date(skill.meta.last_used_at).getTime() : 0;
    const created = skill.meta.created_at ? new Date(skill.meta.created_at).getTime() : 0;
    const lastActivity = Math.max(lastUsed, created);
    const daysSince = lastActivity ? (now - lastActivity) / 86400000 : Infinity;

    if (daysSince > maxDays && score < minScore) {
      stale.push({ skill, daysSince: Math.round(daysSince), score });
    }
  }

  if (stale.length === 0) {
    console.log('No stale skills found.');
    return;
  }

  console.log(`Found ${stale.length} stale skill(s):`);
  for (const { skill, daysSince, score } of stale) {
    console.log(`  - ${skill.meta.id || 'unknown'} (score: ${score}, inactive: ${daysSince} days)`);
  }
}

async function main() {
  const opts = parseArgs();
  const skillsDir = resolve('.github/skills');
  const skills = await loadAllSkills(skillsDir);

  switch (opts.command) {
    case 'list':
      await listSkills(skills);
      break;
    case 'uprank':
      if (!opts.id) { console.error('Usage: skill-manage.mjs uprank <id>'); process.exit(1); }
      await rankSkill(skills, opts.id, opts.amount);
      break;
    case 'downrank':
      if (!opts.id) { console.error('Usage: skill-manage.mjs downrank <id>'); process.exit(1); }
      await rankSkill(skills, opts.id, -opts.amount);
      break;
    case 'expire':
      await expireSkills(skills, opts.days, opts.minScore);
      break;
    default:
      console.error('Usage: node scripts/skill-manage.mjs <list|uprank|downrank|expire> [options]');
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
