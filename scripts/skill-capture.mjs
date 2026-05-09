#!/usr/bin/env node
/**
 * Skill Capture Script
 *
 * Analyzes a merged PR and generates a structured skill document.
 *
 * Usage:
 *   node scripts/skill-capture.mjs <pr-number> [options]
 *
 * Options:
 *   --output <dir>   Output directory (default: .github/skills/auto)
 *   --dry-run        Print to stdout instead of writing file
 *   --force          Generate skill even for trivial PRs
 */

import { execSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { serializeFrontmatter } from './lib/frontmatter.mjs';

function gh(args) {
  return execSync(`gh ${args}`, { encoding: 'utf-8', timeout: 30000 }).trim();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, force: false, output: '.github/skills/auto' };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--force') opts.force = true;
    else if (args[i] === '--output' && args[i + 1]) opts.output = args[++i];
    else positional.push(args[i]);
  }

  if (!positional[0] || isNaN(parseInt(positional[0]))) {
    console.error('Usage: node scripts/skill-capture.mjs <pr-number> [--dry-run] [--force] [--output <dir>]');
    process.exit(1);
  }

  opts.prNumber = parseInt(positional[0]);
  return opts;
}

function fetchPRData(prNumber) {
  const json = gh(`pr view ${prNumber} --json title,body,labels,mergedAt,headRefName,commits,files,number,url`);
  return JSON.parse(json);
}

function fetchLinkedIssue(prBody) {
  const match = prBody?.match(/(?:fixes|closes|resolves)\s+#(\d+)/i);
  if (!match) return null;

  try {
    const json = gh(`issue view ${match[1]} --json title,body,labels,number`);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function categorizeFromTitle(title) {
  const lower = title.toLowerCase();
  if (lower.startsWith('fix:') || lower.startsWith('fix(')) return 'bug-fix';
  if (lower.startsWith('feat:') || lower.startsWith('feat(')) return 'feature';
  if (lower.startsWith('refactor:')) return 'refactoring';
  if (lower.startsWith('perf:')) return 'performance';
  if (lower.startsWith('test:')) return 'testing';
  if (lower.startsWith('style:') || lower.startsWith('css:')) return 'styling';
  if (lower.startsWith('docs:')) return 'documentation';
  if (lower.startsWith('chore:')) return 'chore';
  if (lower.startsWith('ci:')) return 'ci-cd';
  return 'general';
}

function categorizeFromFiles(files) {
  const paths = files.map(f => f.path || f.filename || '');
  if (paths.some(p => p.endsWith('.scss') || p.endsWith('.css'))) return 'styling';
  if (paths.some(p => p.includes('test/'))) return 'testing';
  if (paths.some(p => p.endsWith('.yml') || p.endsWith('.yaml'))) return 'ci-cd';
  if (paths.some(p => p.endsWith('.hbs'))) return 'templates';
  if (paths.some(p => p.endsWith('.ts'))) return 'typescript';
  return 'general';
}

function isSkillWorthy(pr, category) {
  if (category === 'chore' || category === 'documentation') return false;

  const totalChanges = (pr.files || []).reduce(
    (sum, f) => sum + (f.additions || 0) + (f.deletions || 0), 0
  );
  if (totalChanges < 5) return false;

  return true;
}

function generateId(prNumber, title) {
  const slug = title
    .toLowerCase()
    .replace(/^(fix|feat|refactor|perf|test|style|docs|chore|ci)\s*[:(]\s*/i, '')
    .replace(/\)\s*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  return `pr-${prNumber}-${slug}`;
}

function extractKeywords(pr, issue) {
  const keywords = new Set();

  // From title words
  pr.title.toLowerCase().split(/\W+/)
    .filter(w => w.length > 3)
    .forEach(w => keywords.add(w));

  // From directory names in changed files
  for (const file of (pr.files || [])) {
    const path = file.path || file.filename || '';
    path.split('/').forEach(p => {
      if (p.length > 3 && !p.includes('.')) keywords.add(p.toLowerCase());
    });
  }

  // From issue title
  if (issue?.title) {
    issue.title.toLowerCase().split(/\W+/)
      .filter(w => w.length > 3)
      .forEach(w => keywords.add(w));
  }

  // From labels
  for (const label of (pr.labels || [])) {
    const name = label.name || label;
    if (typeof name === 'string') keywords.add(name.toLowerCase());
  }

  const stopWords = new Set([
    'that', 'this', 'with', 'from', 'have', 'been', 'were', 'they',
    'will', 'when', 'what', 'which', 'their', 'into', 'more', 'some',
    'than', 'them', 'very', 'just', 'about', 'also', 'does', 'should',
  ]);
  for (const word of stopWords) keywords.delete(word);

  return [...keywords].slice(0, 15);
}

function extractAffectedFiles(pr) {
  return (pr.files || []).map(f => f.path || f.filename || '').filter(Boolean);
}

function generateSkillBody(pr, issue) {
  const cleanTitle = pr.title
    .replace(/^(fix|feat|refactor|perf|test|style|docs|chore|ci)\s*[:(]\s*/i, '')
    .replace(/\)\s*/, '')
    .trim();
  const affectedFiles = extractAffectedFiles(pr);

  let body = `# Skill: ${cleanTitle}\n\n`;

  // When to Use
  body += `## When to Use\n`;
  if (issue?.body) {
    const firstPara = issue.body.split('\n\n')[0].trim().substring(0, 200);
    body += `When encountering a similar problem: ${firstPara}\n\n`;
  } else {
    body += `When working on similar changes to: ${affectedFiles.slice(0, 5).join(', ')}\n\n`;
  }

  // Problem
  body += `## Problem\n`;
  if (issue?.body) {
    body += `${issue.body.substring(0, 500)}\n\n`;
  } else {
    body += `${pr.body?.substring(0, 500) || pr.title}\n\n`;
  }

  // Solution Pattern
  body += `## Solution Pattern\n`;
  if (pr.commits?.length) {
    for (const commit of pr.commits) {
      const msg = commit.messageHeadline || commit.message || '';
      if (msg) body += `- ${msg}\n`;
    }
  } else {
    body += `- ${pr.title}\n`;
  }
  body += '\n';

  // Affected Files
  body += `## Affected Files\n`;
  for (const file of affectedFiles) {
    body += `- \`${file}\`\n`;
  }
  body += '\n';

  // Pitfalls
  body += `## Pitfalls\n`;
  body += `- Review the PR discussion for full context: ${pr.url}\n`;
  body += `- Verify changes don't break existing behavior\n\n`;

  // Verification
  body += `## Verification\n`;
  body += `- Run \`npm run build\` to verify compilation\n`;
  body += `- Run \`npm test\` to verify tests pass\n`;

  return body;
}

async function main() {
  const opts = parseArgs();

  console.error(`Analyzing PR #${opts.prNumber}...`);

  const pr = fetchPRData(opts.prNumber);
  if (!pr.mergedAt && !opts.force) {
    console.error(`PR #${opts.prNumber} is not merged. Use --force to generate anyway.`);
    process.exit(0);
  }

  // Determine category
  const titleCategory = categorizeFromTitle(pr.title);
  const fileCategory = categorizeFromFiles(pr.files || []);
  const category = titleCategory !== 'general' ? titleCategory : fileCategory;

  // Check skill-worthiness
  if (!isSkillWorthy(pr, category) && !opts.force) {
    console.error(`PR #${opts.prNumber} is not skill-worthy (category: ${category}). Use --force to override.`);
    process.exit(0);
  }

  console.error(`Category: ${category}`);

  const issue = fetchLinkedIssue(pr.body);

  // Generate skill document
  const id = generateId(opts.prNumber, pr.title);
  const keywords = extractKeywords(pr, issue);
  const affectedFiles = extractAffectedFiles(pr);

  const meta = {
    id,
    problem_category: category,
    source: 'pr-merge',
    source_pr: opts.prNumber,
    source_issue: issue?.number || '',
    affected_files: affectedFiles,
    keywords,
    effectiveness_score: 50,
    read_count: 0,
    created_at: new Date().toISOString().split('T')[0],
    last_used_at: '',
    repository: 'porschiey-alt/better-character-sheet',
  };

  const body = generateSkillBody(pr, issue);
  const content = serializeFrontmatter(meta, body);

  if (opts.dryRun) {
    console.log(content);
  } else {
    await mkdir(opts.output, { recursive: true });
    const filename = `${id}.md`;
    const filepath = join(opts.output, filename);
    await writeFile(filepath, content, 'utf-8');
    console.error(`Skill written to: ${filepath}`);
    // Output filepath for CI use
    console.log(filepath);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
