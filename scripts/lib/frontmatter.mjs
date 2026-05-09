/**
 * Simple YAML frontmatter parser/serializer for skill documents.
 * Handles the controlled subset of YAML used in our skill schema:
 * - Key-value pairs (string, number, boolean)
 * - Array values (indented `- item` syntax)
 * - No nested objects
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Parse a markdown file's content into { meta, body }.
 * If no frontmatter is present, returns empty meta and the full content as body.
 */
export function parseFrontmatter(content) {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  const yamlLines = match[1].split(/\r?\n/);
  let currentKey = null;

  for (const line of yamlLines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Array item: starts with whitespace + dash
    const arrayMatch = line.match(/^\s+-\s+(.*)/);
    if (arrayMatch && currentKey) {
      if (!Array.isArray(meta[currentKey])) {
        meta[currentKey] = [];
      }
      meta[currentKey].push(arrayMatch[1].trim());
      continue;
    }

    // Key-value pair
    const kvMatch = line.match(/^([\w][\w-]*)\s*:\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const rawValue = kvMatch[2].trim();
      if (rawValue === '' || rawValue === '[]') {
        meta[currentKey] = rawValue === '[]' ? [] : '';
      } else {
        meta[currentKey] = coerceValue(rawValue);
      }
    }
  }

  return { meta, body: match[2] };
}

function coerceValue(raw) {
  // Remove surrounding quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
  return raw;
}

/**
 * Serialize metadata object and body string into frontmatter-formatted content.
 */
export function serializeFrontmatter(meta, body) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(meta)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${item}`);
        }
      }
    } else if (value === '' || value === null || value === undefined) {
      lines.push(`${key}:`);
    } else if (typeof value === 'string' && needsQuoting(value)) {
      lines.push(`${key}: "${value}"`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---');
  lines.push('');
  return lines.join('\n') + body;
}

function needsQuoting(str) {
  return str.includes(':') || str.includes('#') || str.includes('"') ||
         str.includes("'") || str.startsWith(' ') || str.endsWith(' ');
}

/**
 * Recursively load all skill documents from a directory.
 * Skips SCHEMA.md and README.md.
 * Returns array of { path, meta, body }.
 */
export async function loadAllSkills(skillsDir) {
  const skills = [];

  async function scanDir(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md') &&
                 entry.name !== 'SCHEMA.md' && entry.name !== 'README.md') {
        const content = await readFile(fullPath, 'utf-8');
        const { meta, body } = parseFrontmatter(content);
        skills.push({ path: fullPath, meta, body });
      }
    }
  }

  await scanDir(skillsDir);
  return skills;
}

/**
 * Update a skill file's frontmatter fields while preserving the body.
 */
export async function updateSkillMeta(filePath, updates) {
  const content = await readFile(filePath, 'utf-8');
  const { meta, body } = parseFrontmatter(content);
  Object.assign(meta, updates);
  const newContent = serializeFrontmatter(meta, body);
  await writeFile(filePath, newContent, 'utf-8');
  return meta;
}
