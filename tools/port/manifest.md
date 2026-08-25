# Port manifest

Upstream: `984023d`

## Counts

- skills: 74
- roles: 49
- templates: 40
- rules: 11
- engines: 46
- handbook: 12
- pipeline: 2
- excluded: 10
- skills breakdown: 73 ported + 1 first-party

## Rule hits

| rule | hits |
|---|---|
| R1 | 85 |
| R2 | 93 |
| R4 | 135 |
| R5 | 15 |
| R6 | 68 |
| R7 | 16 |
| R14 | 49 |

## Excluded (10)

- CLAUDE-local-template.md
- hooks-reference.md
- hooks-reference/hook-input-schemas.md
- hooks-reference/post-merge-asset-validation.md
- hooks-reference/post-sprint-retrospective.md
- hooks-reference/pre-commit-code-quality.md
- hooks-reference/pre-commit-design-check.md
- hooks-reference/pre-push-test-gate.md
- settings-local-template.md
- setup-requirements.md

## Bash sites needing manual rewrite (4)

- skills/gs-hotfix/SKILL.md:74 — `Bash: git rev-parse --is-inside-work-tree 2>/dev/null`
- skills/gs-retrospective/SKILL.md:61 — Run git log for the sprint period to understand what was actually committed and when. Use the Bash tool (which uses Git Bash on Windows — the `2>/dev/null` is bash syntax, not PowerShell):
- skills/gs-retrospective/SKILL.md:64 — Bash: git log --oneline --since="4 weeks ago" 2>/dev/null || git log --oneline -20
- pipeline/workflow-guide.md:39 — - **Git** with Git Bash (Windows) or standard terminal (Mac/Linux)
