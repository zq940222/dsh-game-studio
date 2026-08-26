# Port manifest

Upstream: `984023d`

## Counts

- skills: 74
- roles: 49
- templates: 40
- rules: 11
- engines: 46
- handbook: 13
- pipeline: 2
- excluded: 10
- skills breakdown: 73 ported + 1 first-party

## Rule hits

| rule | hits |
|---|---|
| R1 | 410 |
| R2 | 178 |
| R3 | 1 |
| R4 | 1608 |
| R5 | 68 |
| R6/R8 | 192 |
| R7 | 28 |
| R9 | folded into R6/R8 — see rewritePaths' doc comment |
| R10 | 73 |
| R11 | 49 |
| R12 | structural invariant, not a text rewrite — see the skill-loop's name≡dir comment |
| R13 | 20 |
| R14 | 50 |

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

## Bash sites needing manual rewrite (1)

- pipeline/workflow-guide.md:39 — - **Git** with Git Bash (Windows) or standard terminal (Mac/Linux)
