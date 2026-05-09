# Skill Document Schema

Skills are structured knowledge documents that capture reusable problem-solving patterns.
They are stored as Markdown files with YAML frontmatter in `.github/skills/`.

## Directory Structure

```
.github/skills/
├── SCHEMA.md               # This file
├── css-debugging.md        # Manually-created skill
├── foundry-module-dev.md
├── playwright-testing.md
└── auto/                   # Auto-generated skills from merged PRs
    └── pr-18-escape-user-strings.md
```

## Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique kebab-case identifier |
| `problem_category` | string | yes | Classification (see categories below) |
| `source` | string | yes | `manual` or `pr-merge` |
| `source_pr` | number | no | PR number (if source is `pr-merge`) |
| `source_issue` | number | no | Linked issue number |
| `affected_files` | string[] | yes | File paths/patterns this skill applies to |
| `keywords` | string[] | yes | Search terms for retrieval |
| `effectiveness_score` | number | yes | 0-100, default 50. Higher = more effective |
| `read_count` | number | yes | Times this skill has been retrieved |
| `created_at` | string | yes | ISO date (YYYY-MM-DD) |
| `last_used_at` | string | no | ISO date of last retrieval |
| `repository` | string | no | Repo scope, or omit for cross-repo skills |

## Problem Categories

- `bug-fix` — Fixing broken behavior
- `feature` — New functionality
- `refactoring` — Code restructuring
- `performance` — Speed/memory optimization
- `styling` — CSS/visual changes
- `testing` — Test infrastructure
- `security` — Security fixes
- `ci-cd` — CI/CD pipeline changes
- `templates` — Handlebars template work
- `typescript` — TypeScript-specific patterns
- `general` — Uncategorized

## Body Sections

Each skill document should include these sections:

1. **When to Use** — Trigger conditions for this skill
2. **Problem** (optional) — What problem this skill addresses
3. **Solution Pattern** — Step-by-step approach or key knowledge
4. **Affected Files** (optional) — Which files are typically involved
5. **Pitfalls** — Known gotchas and mistakes to avoid
6. **Verification** — How to verify the solution works

## Lifecycle

1. **Creation**: Skills are created either manually or auto-generated from merged PRs
2. **Retrieval**: At task start, relevant skills are queried and injected into context (max 2-3 per session)
3. **Feedback**: After PR outcomes, skills are upranked (successful merge) or downranked (rejected/reverted)
4. **Expiry**: Skills unused for 90+ days with low effectiveness scores are candidates for removal

## Scripts

```bash
node scripts/skill-capture.mjs <pr-number>              # Generate skill from merged PR
node scripts/skill-retrieve.mjs --keywords <kw>          # Find relevant skills
node scripts/skill-manage.mjs list                        # List all skills
node scripts/skill-manage.mjs uprank <id> --amount 10     # Boost effectiveness
node scripts/skill-manage.mjs downrank <id> --amount 10   # Reduce effectiveness
node scripts/skill-manage.mjs expire --days 90             # Find stale skills
```
