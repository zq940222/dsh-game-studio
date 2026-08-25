# Task 15 manual review log

Human-scale read of the ported content — the part a script cannot do. Every
fix below is a literal override in `tools/port/port.mjs` (`fixupClaudeDocResidue`)
or `tools/port/rules.mjs` (R14, `CLAUDE_CODE_MENTIONS`), applied to raw upstream
text and re-run through `port.mjs`. Nothing under `content/` was hand-edited.

## 1. The nine `Bash` sites (manifest.md)

All nine read in context against the upstream snapshot. Five name the bare
`Bash` **tool** in a generic "run the test suite" instruction and were
rewritten; four name **Git Bash**, the actual Windows shell program a human
installs alongside Git, and were left untouched.

**Fixed** (`fixupClaudeDocResidue`, each rewritten to
`the shell tool (`bash` on POSIX, `pwsh` on Windows)`):
- `skills/gs-bug-report/SKILL.md:99` — "run it via Bash and report pass/fail"
- `skills/gs-gate-check/SKILL.md:217` — "(run test suite via Bash)"
- `skills/gs-gate-check/SKILL.md:283` — "Run the test suite via `Bash`"
- `skills/gs-smoke-check/SKILL.md:79` — "Attempt to run the test suite via Bash"
- `skills/gs-story-done/SKILL.md:83` — "run it via `Bash`"

**Left as-is** (still listed in the regenerated manifest, 4 sites) — all four
are "Git Bash" the shell, not this harness's tool:
- `skills/gs-hotfix/SKILL.md:74` — `` `Bash: git rev-parse --is-inside-work-tree 2>/dev/null` `` —
  a transcript-style command label paired with `git`, in a file whose whole
  point is showing POSIX-flavored redirection syntax (`2>/dev/null`).
- `skills/gs-retrospective/SKILL.md:61` — "Use the Bash tool (which uses Git
  Bash on Windows — the `2>/dev/null` is bash syntax, not PowerShell)". Note
  for a later reader: this sentence explicitly asserts a fact about this
  harness's Windows tool behavior ("uses Git Bash on Windows") that is **not
  true here** — the `standard` preset ships `tool-pwsh` on win32, not a
  Bash-via-Git-Bash tool. It reads as a Git-Bash-the-shell mention (paired
  with the next line's `git log` example) and was kept per the brief's
  explicit instruction to leave the four Git Bash sites alone, but it was
  not overlooked — a future pass could reasonably decide this one crosses
  from "naming the shell" into "asserting untrue tool behavior" and rewrite
  it the same way as the five fixed sites above.
- `skills/gs-retrospective/SKILL.md:64` — `` `Bash: git log --oneline --since="4 weeks ago" 2>/dev/null || git log --oneline -20` `` —
  same transcript-label-on-a-git-command shape as gs-hotfix:74, directly
  below the sentence above.
- `pipeline/workflow-guide.md:39` — "**Git** with Git Bash (Windows) or
  standard terminal (Mac/Linux)" — a human prerequisites list, genuinely
  about the shell program, already deliberately preserved by
  `fixupClaudeDocResidue`'s `workflow-guide.md` block.

## 2. Delegation-idiom nits (plural meets the singular article)

Three sites named in the brief, plus two more of the identical shape found
while reading the required five-large-skills and ten-random-skills sample.
All fixed the same way: drop `via Task` from the raw upstream text before
`TASK_DELEGATION_PHRASES` turns it into `via a subagent`, so the shared rule
in `rules.mjs` is untouched and the other ~75 correctly-singular `via Task`
sites are unaffected.

- `content/skills/gs-gate-check/SKILL.md:317` — "spawn all four directors as
  **parallel subagents** via a subagent" → dropped `via Task`, kept "as
  **parallel subagents**".
- `content/skills/gs-brainstorm/SKILL.md:206` — "spawn BOTH `creative-director`
  AND `art-director` via a subagent in parallel" → "...as parallel subagents
  before moving to Phase 5."
- `content/handbook/director-gates.md:91` — "Spawn all [N] agents
  simultaneously via a subagent" → dropped `via Task`.
- **New, found in gs-design-system (one of the five required large skills),
  two identical occurrences** — `content/skills/gs-design-system/SKILL.md:468`
  and `:518` — "spawn specialist agents via a subagent in parallel" → dropped
  `via Task`, now "spawn specialist agents in parallel". One split/join in
  `fixupClaudeDocResidue` fixed both (verified 2 hits, both upstream-identical).
- **New, found in gs-code-review (one of the ten random skills)** —
  `content/skills/gs-code-review/SKILL.md:95` — "Spawn all applicable
  specialists simultaneously via a subagent" → dropped `via Task`.

### Recorded, not fixed — wider population of the same shape (out of sample)

A corpus grep for `via a subagent` preceded by a plural noun turned up a
further pattern, **"sub-agents spawned via a subagent"**, repeated verbatim
in 7 files outside this task's required/random sample. Not fixed — reading
each file in full context before touching it would exceed this task's
bounded scope ("not proofread 2.2 MB"), and per `rules.mjs`'s own note on
`TASK_DELEGATION_PHRASES`, the corpus hard-wraps mid-phrase elsewhere, so a
literal split/join is not safe to add sight-unseen for files never opened.
Recommendation for a future pass: add a targeted regex entry ahead of the
generic `via Task` entry in `TASK_DELEGATION_PHRASES`,
`/\bsub-agents\s+spawned\s+via\s+Task\b/` → `sub-agents, spawned through
this harness's delegation mechanism`, and verify no wrap-hazard site is
missed (the way the existing `Task\s+agents` entry documents its own).

Sites (file:line, upstream `via Task` line numbers, all read only via grep,
not opened in full):
- `content/skills/gs-dev-story/SKILL.md:301`
- `content/skills/gs-team-audio/SKILL.md:121`
- `content/skills/gs-team-combat/SKILL.md:130`
- `content/skills/gs-team-level/SKILL.md:167`
- `content/skills/gs-team-live-ops/SKILL.md:147`
- `content/skills/gs-team-narrative/SKILL.md:110`
- `content/skills/gs-team-polish/SKILL.md:130`

## 3. Five largest skills — full read

`gs-setup-engine` (34 KB), `gs-design-system` (41 KB), `gs-gate-check`
(30 KB), `gs-ux-design` (33 KB), `gs-prototype` (29 KB) — all five read end
to end. Checked in each: hook/`.claude/`/Claude-Code-agent-mechanics residue,
relative path resolution, `gs-` command prefixing, calls to nonexistent tools.

- `gs-setup-engine`: clean. All `../../engines/` and `../../handbook/` paths
  resolve. No hook/`.claude` residue.
- `gs-design-system`: two delegation nits fixed (§2 above). Otherwise clean —
  paths resolve (`../../handbook/director-gates.md`,
  `../../templates/game-design-document.md`), commands all `/gs-`-prefixed.
- `gs-gate-check`: one delegation nit fixed (§2, gate-check:317), plus two of
  the five R3 Bash-tool sites (§1). Otherwise clean.
- `gs-ux-design`: clean. All paths resolve, no stray tool/hook references.
- `gs-prototype`: clean. `isolation: worktree` in frontmatter is carried as
  advisory `metadata:` per `transformSkillFrontmatter`'s existing design
  (Task 14, not new to this pass) — not enforced, not misleading in context.

## 4. Ten random command skills — full read (`shuf`-selected)

`gs-vertical-slice`, `gs-skill-test`, `gs-scope-check`, `gs-balance-check`,
`gs-skill-improve`, `gs-security-audit`, `gs-qa-plan`, `gs-review-all-gdds`,
`gs-code-review`, `gs-bug-triage`.

- `gs-code-review`: one delegation nit fixed (§2). Otherwise clean.
- `gs-skill-test`: **fixed** — Check 1 ("Required Frontmatter Fields") and
  Check 4's FAIL condition both required an `allowed-tools:` frontmatter key.
  This harness's port drops `allowed-tools` outright (`SKILL_DROP` in
  `rules.mjs` — a per-skill tool allowlist has no meaning here), so every one
  of the 73 ported skills was **guaranteed** to fail this linter's own
  Check 1, and Check 4's FAIL branch could never trigger correctly either.
  Rewrote Check 1's required-field list to the fields this harness's skills
  actually carry (`name`, `description`, `disable-model-invocation`,
  `user-invocable`, with a note that `argument-hint`/`model`/etc. live in a
  nested `metadata:` block instead of top-level), and rewrote Check 4's FAIL
  condition to check the skill's body for write/edit instructions instead of
  a nonexistent field. Verified against `content/skills/gs-ping/SKILL.md`
  (first-party, hand-authored, never passes through
  `transformSkillFrontmatter`): it already carries the four required
  top-level keys, so the rewritten Check 1 holds for it too — no separate
  gs-ping carve-out needed.
- `gs-skill-improve`: **fixed** — its Phase 3 diagnosis table's "Check 4
  fail" bullet also named `allowed-tools`, same root cause as gs-skill-test
  above; rewritten to match.
- `gs-vertical-slice`, `gs-scope-check`, `gs-balance-check`,
  `gs-security-audit`, `gs-qa-plan`, `gs-review-all-gdds`, `gs-bug-triage`:
  clean — all relative paths resolve, all commands carry `/gs-`, no
  hook/`.claude`/nonexistent-tool references.

### Recorded, not fixed — pre-existing upstream Markdown defect

`content/skills/gs-vertical-slice/SKILL.md`, Phase 6 (around line 246 in the
shipped file, matching upstream `.claude/skills/vertical-slice/SKILL.md`
around the same line): a closing ` ``` ` with no matching opening fence,
present verbatim in the upstream source (confirmed via diff against the
`984023d` snapshot). Not a porting defect — a plain upstream authoring bug,
unrelated to the Claude-Code-to-harness migration this task's rules exist to
fix, so no `tools/port/` rule was added for it. Recommendation: the missing
opening fence most plausibly belongs right after "If the template file is
not found, use this fallback structure:" (before the `` `## Vertical Slice
Report...` `` bullet list), closing before "Ask: 'May I write this report
to...'" — but this is an editorial judgment call on upstream content, not
something a mechanical rule should guess at.

## 5. Ten random role briefs — full read (`shuf`-selected)

`sound-designer`, `ue-gas-specialist`, `analytics-engineer`,
`engine-programmer`, `godot-gdextension-specialist`, `qa-tester`,
`systems-designer`, `qa-lead`, `lead-programmer`, `security-engineer`.

All ten clean of harness-breaking issues (paths resolve — role files use
`../engines/`, one level up, correctly reflecting that `content/roles/*.md`
sits one directory below `content/`, not two like `content/skills/gs-*/`;
commands carry `/gs-`; no calls to a nonexistent tool). Two things noted and
explicitly **not** changed:

- **The bare `skills:` advisory list** (e.g. `qa-lead.md`: `` `skills`:
  bug-report, release-checklist ``; `lead-programmer.md`: `` `skills`:
  code-review, architecture-decision, tech-debt ``) quotes upstream's raw
  frontmatter values without the `gs-` prefix or the `/` command form. This
  is `transformRoleFrontmatter`'s existing, deliberate design (Task 14): the
  whole block is explicitly framed as "Upstream Claude Code granted this
  role the configuration below... not something this harness restricts or
  grants" and the values are read directly off upstream, never passed
  through R1/R2/R4. Reviewed and working as designed — not a new finding.
- **`- `disallowedTools`: Bash`** (e.g. `sound-designer.md:94`) is a literal
  bare "Bash" in body prose but is correctly excluded from the R3 manual
  ledger: `recordBashSites` for roles runs against the *raw upstream*
  frontmatter (where this is `disallowedTools: Bash`, matched and skipped by
  `FRONTMATTER_TOOL_KEY`), before `transformRoleFrontmatter` re-renders it as
  the bulleted advisory line shown in the shipped file. Same semantic
  category R3 already excludes (a tool-allowlist declaration, now historical
  prose), just reached via a different code path. Not a gap.

### Corpus-wide finding from this sample: "rules/hooks flag issues"

Found while reading the "Implement with transparency" step common to all 10
sampled implementer-template role briefs (present in all 10, since it's part
of the shared collaboration template these roles use). A corpus grep found
**35 total sites**: 34 role briefs sharing that template, plus
`content/templates/collaborative-protocols/implementation-agent-protocol.md`
— all byte-identical: *"If rules/hooks flag issues, fix them and explain
what was wrong."* "Rules" (`content/rules/*.md`) are real on this harness;
"hooks" are not (no pre-tool-use interception — see `NOTICE`), so a hook can
never flag anything here. Low severity (a conditional bullet that simply
never fires for its "hooks" half, not an affirmative false claim like the
ones `fixupClaudeDocResidue`'s `workflow-guide.md` block already fixes), but
squarely "still describes machinery this harness lacks" per this task's own
charter, and mechanically trivial to fix safely (one exact literal, 35
identical occurrences, zero false-positive population, no mid-phrase wrap
per a full-corpus grep). **Fixed** via a new `R14`/`CLAUDE_CODE_MENTIONS`
entry in `rules.mjs` rather than per-file `fixupClaudeDocResidue` blocks
(would have meant 35 near-duplicate `if` blocks) and rather than a new
pipeline rule (would need `rewriteBody` wiring, a new `ruleHits` key, a
manifest format change, and a fixture test — the largest structural
footprint for the lowest-severity finding in this review). New text: "If
rules flag issues, fix them and explain what was wrong."

### Companion fix, found via residual grep (not part of the sample)

After fixing the `allowed-tools` defect in gs-skill-test/gs-skill-improve
(§4), a residual `grep -rn "allowed-tools" content/` turned up one more site
sharing the exact same root cause: `content/templates/skill-test-spec.md:15`
— a spec-authoring template's Static Assertions checklist item, explicitly
labeled "Verified automatically by `/gs-skill-test static`", still listing
`allowed-tools` as a required field that gs-skill-test itself no longer
checks for after the §4 fix. Same root cause, same fix shape, one line.
**Fixed** — but via the R14 mechanism, not `fixupClaudeDocResidue`, because
templates never pass through `fixupClaudeDocResidue` (see the templates loop
in `port.mjs`) while `rewriteBody`/R14 already runs over every destination
including templates.

## 6. Verification

- Re-ran `port.mjs` against the pinned `984023d` snapshot twice after all
  fixes; `content/` is byte-identical across both runs (sha256 over every
  file, confirmed).
- `pnpm build`, `pnpm lint:content`, `pnpm vitest run` — all pass (137/137
  tests, both publish gates clean).
- Counts unchanged: skills 74, roles 49 + `_index.md` (50 files), templates
  40, rules 11, engines 46, handbook 12, pipeline 2, excluded 10.
- `content/orchestration/` and `content/skills/gs-ping/` — no diff in `git
  status`/`git diff --stat` for either path; untouched by this pass.
- Manifest's "Bash sites needing manual rewrite" count: 9 → 4 (the four Git
  Bash sites from §1, unchanged text).
- `grep -rn "rules/hooks" content/` → 0 hits.
- `grep -rn "allowed-tools" content/` → only the three new explanatory
  mentions this pass added (gs-skill-test ×2, skill-test-spec.md ×1), no
  stale requirement left anywhere.
