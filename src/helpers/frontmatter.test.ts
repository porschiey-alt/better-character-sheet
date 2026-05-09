import { describe, it, expect } from 'vitest';
import { parseFrontmatter, serializeFrontmatter } from '../../scripts/lib/frontmatter.mjs';

describe('parseFrontmatter', () => {
  it('parses simple key-value pairs', () => {
    const content = `---
id: test-skill
problem_category: bug-fix
effectiveness_score: 75
read_count: 3
---
# Body content`;

    const { meta, body } = parseFrontmatter(content);
    expect(meta.id).toBe('test-skill');
    expect(meta.problem_category).toBe('bug-fix');
    expect(meta.effectiveness_score).toBe(75);
    expect(meta.read_count).toBe(3);
    expect(body).toBe('# Body content');
  });

  it('parses array values', () => {
    const content = `---
keywords:
  - css
  - debugging
  - layout
affected_files:
  - src/styles/main.scss
  - src/sheets/Sheet.ts
---
Body`;

    const { meta } = parseFrontmatter(content);
    expect(meta.keywords).toEqual(['css', 'debugging', 'layout']);
    expect(meta.affected_files).toEqual(['src/styles/main.scss', 'src/sheets/Sheet.ts']);
  });

  it('parses boolean values', () => {
    const content = `---
active: true
deprecated: false
---
Body`;

    const { meta } = parseFrontmatter(content);
    expect(meta.active).toBe(true);
    expect(meta.deprecated).toBe(false);
  });

  it('parses quoted strings', () => {
    const content = `---
repository: "porschiey-alt/better-character-sheet"
description: 'contains: colons'
---
Body`;

    const { meta } = parseFrontmatter(content);
    expect(meta.repository).toBe('porschiey-alt/better-character-sheet');
    expect(meta.description).toBe('contains: colons');
  });

  it('handles empty values', () => {
    const content = `---
last_used_at:
source_issue:
---
Body`;

    const { meta } = parseFrontmatter(content);
    expect(meta.last_used_at).toBe('');
    expect(meta.source_issue).toBe('');
  });

  it('handles empty arrays', () => {
    const content = `---
keywords: []
---
Body`;

    const { meta } = parseFrontmatter(content);
    expect(meta.keywords).toEqual([]);
  });

  it('returns empty meta when no frontmatter', () => {
    const content = '# Just a regular markdown file\n\nNo frontmatter here.';
    const { meta, body } = parseFrontmatter(content);
    expect(meta).toEqual({});
    expect(body).toBe(content);
  });

  it('handles Windows-style line endings', () => {
    const content = '---\r\nid: test\r\nscore: 50\r\n---\r\nBody';
    const { meta, body } = parseFrontmatter(content);
    expect(meta.id).toBe('test');
    expect(meta.score).toBe(50);
    expect(body).toBe('Body');
  });
});

describe('serializeFrontmatter', () => {
  it('serializes simple values', () => {
    const meta = { id: 'test', score: 50, active: true };
    const result = serializeFrontmatter(meta, '# Body\n');

    expect(result).toContain('id: test');
    expect(result).toContain('score: 50');
    expect(result).toContain('active: true');
    expect(result).toContain('# Body');
  });

  it('serializes arrays', () => {
    const meta = { keywords: ['css', 'layout', 'debug'] };
    const result = serializeFrontmatter(meta, 'Body');

    expect(result).toContain('keywords:');
    expect(result).toContain('  - css');
    expect(result).toContain('  - layout');
    expect(result).toContain('  - debug');
  });

  it('serializes empty arrays', () => {
    const meta = { keywords: [] };
    const result = serializeFrontmatter(meta, 'Body');
    expect(result).toContain('keywords: []');
  });

  it('quotes strings with special characters', () => {
    const meta = { repo: 'owner/repo:name' };
    const result = serializeFrontmatter(meta, 'Body');
    expect(result).toContain('repo: "owner/repo:name"');
  });

  it('handles empty string values', () => {
    const meta = { last_used_at: '' };
    const result = serializeFrontmatter(meta, 'Body');
    expect(result).toContain('last_used_at:');
  });

  it('round-trips through parse and serialize', () => {
    const original = {
      id: 'test-roundtrip',
      problem_category: 'bug-fix',
      effectiveness_score: 75,
      read_count: 3,
      keywords: ['css', 'layout'],
      affected_files: ['src/main.ts'],
      active: true,
    };
    const body = '# Test\n\nBody content here.\n';

    const serialized = serializeFrontmatter(original, body);
    const { meta, body: parsedBody } = parseFrontmatter(serialized);

    expect(meta.id).toBe(original.id);
    expect(meta.problem_category).toBe(original.problem_category);
    expect(meta.effectiveness_score).toBe(original.effectiveness_score);
    expect(meta.read_count).toBe(original.read_count);
    expect(meta.keywords).toEqual(original.keywords);
    expect(meta.affected_files).toEqual(original.affected_files);
    expect(meta.active).toBe(original.active);
    expect(parsedBody).toBe(body);
  });
});
