#!/usr/bin/env node
/**
 * Skill Retrieval Script
 *
 * Searches for relevant skills based on keywords, file paths, or categories.
 * Returns the top N most relevant skills for injection into agent context.
 *
 * Usage:
 *   node scripts/skill-retrieve.mjs [options]
 *
 * Options:
 *   --keywords <words>     Comma-separated keywords to match
 *   --files <paths>        Comma-separated file paths to match
 *   --category <cat>       Problem category to filter by
 *   --limit <n>            Max results (default: 3)
 *   --update-counts        Update read_count and last_used_at on retrieved skills
 *   --format <fmt>         Output format: "full" (default), "summary", "paths"
 */

import { loadAllSkills, updateSkillMeta } from './lib/frontmatter.mjs';
import { resolve } from 'node:path';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    keywords: [],
    files: [],
    category: null,
    limit: 3,
    updateCounts: false,
    format: 'full',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--keywords' && args[i + 1]) {
      opts.keywords = args[++i].split(',').map(k => k.trim().toLowerCase());
    } else if (args[i] === '--files' && args[i + 1]) {
      opts.files = args[++i].split(',').map(f => f.trim());
    } else if (args[i] === '--category' && args[i + 1]) {
      opts.category = args[++i].trim().toLowerCase();
    } else if (args[i] === '--limit' && args[i + 1]) {
      opts.limit = parseInt(args[++i]);
    } else if (args[i] === '--update-counts') {
      opts.updateCounts = true;
    } else if (args[i] === '--format' && args[i + 1]) {
      opts.format = args[++i];
    }
  }

  return opts;
}

/**
 * Score a skill's relevance to the query.
 * Higher score = more relevant.
 */
function scoreSkill(skill, opts) {
  let score = 0;
  const meta = skill.meta;

  // Category match (strong signal)
  if (opts.category && meta.problem_category === opts.category) {
    score += 30;
  }

  // Keyword matches
  if (opts.keywords.length > 0) {
    const skillKeywords = (meta.keywords || []).map(k =>
      typeof k === 'string' ? k.toLowerCase() : ''
    );
    const bodyLower = skill.body.toLowerCase();

    for (const kw of opts.keywords) {
      if (skillKeywords.includes(kw)) {
        score += 15; // Exact keyword match
      } else if (skillKeywords.some(sk => sk.includes(kw) || kw.includes(sk))) {
        score += 8; // Partial keyword match
      } else if (bodyLower.includes(kw)) {
        score += 5; // Body text match
      }
    }
  }

  // File path matches
  if (opts.files.length > 0 && Array.isArray(meta.affected_files)) {
    for (const queryFile of opts.files) {
      for (const skillFile of meta.affected_files) {
        // Exact or substring match
        if (queryFile.includes(skillFile) || skillFile.includes(queryFile)) {
          score += 20;
        }
        // Directory-level match
        const queryDir = queryFile.split('/').slice(0, -1).join('/');
        const skillDir = skillFile.split('/').slice(0, -1).join('/');
        if (queryDir && skillDir && queryDir === skillDir) {
          score += 10;
        }
      }
    }
  }

  // Effectiveness weight: normalize around 1.0 for default score of 50
  const effectScore = typeof meta.effectiveness_score === 'number' ? meta.effectiveness_score : 50;
  score *= (effectScore / 50);

  // Recency boost
  if (meta.last_used_at) {
    const daysSinceUse = (Date.now() - new Date(meta.last_used_at).getTime()) / (86400000);
    if (daysSinceUse < 7) score *= 1.2;
    else if (daysSinceUse < 30) score *= 1.1;
    else if (daysSinceUse > 180) score *= 0.8;
  }

  return score;
}

async function main() {
  const opts = parseArgs();
  const skillsDir = resolve('.github/skills');

  const skills = await loadAllSkills(skillsDir);

  if (skills.length === 0) {
    console.error('No skills found in', skillsDir);
    process.exit(0);
  }

  // Score, filter, and rank
  const scored = skills
    .map(skill => ({ ...skill, score: scoreSkill(skill, opts) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit);

  if (scored.length === 0) {
    console.error('No matching skills found.');
    process.exit(0);
  }

  // Update read counts if requested
  if (opts.updateCounts) {
    const today = new Date().toISOString().split('T')[0];
    for (const skill of scored) {
      await updateSkillMeta(skill.path, {
        read_count: (skill.meta.read_count || 0) + 1,
        last_used_at: today,
      });
    }
  }

  // Output
  switch (opts.format) {
    case 'paths':
      for (const skill of scored) {
        console.log(skill.path);
      }
      break;

    case 'summary':
      for (const skill of scored) {
        const title = skill.body.split('\n').find(l => l.startsWith('# '))?.replace(/^#\s*/, '') || 'Unknown';
        console.log(`[${skill.score.toFixed(1)}] ${skill.meta.id || '-'}: ${title}`);
      }
      break;

    default: {
      // Full output: print skill bodies with metadata comments
      for (let i = 0; i < scored.length; i++) {
        if (i > 0) console.log('\n---\n');
        console.log(`<!-- Skill: ${scored[i].meta.id || 'unknown'} | score: ${scored[i].score.toFixed(1)} | reads: ${scored[i].meta.read_count || 0} -->`);
        console.log(scored[i].body.trim());
      }
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
