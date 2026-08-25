# Task 15 manual review log

Human-scale read of the ported content — the part a script cannot do. Every
fix below is a literal override in `tools/port/port.mjs`
(`fixupClaudeDocResidue`) or `tools/port/rules.mjs` (R14 `CLAUDE_CODE_MENTIONS`,
or R2 `TASK_DELEGATION_PHRASES`), applied to raw upstream text and re-run
through `port.mjs`. Nothing under `content/` was hand-edited.

This log has two rounds: the initial pass (§1–§5) and the coordinator's
review response (§6), which corrected one misclassification, closed two
Important findings, and fixed the follow-through items the first pass
recorded but did not act on. Sections below are updated in place where the
review changed a conclusion, so this file reflects the final state, not the
history of getting there — the "before" state is in git history if needed.

## 1. The nine `Bash` sites (manifest.md)

All nine read in context against the upstream snapshot. **Final
classification: eight name the AGENT'S tool and are fixed; one names the
shell a human types into and is left alone.** (The initial pass classified
this 5-fixed/4-left; the coordinator caught that three of the four "left"
sites were misclassified — see §6.1.)

**Fixed** (`fixupClaudeDocResidue`, each rewritten to
`the shell tool (`bash` on POSIX, `pwsh` on Windows)` or an equivalent
tool-naming phrase):
- `skills/gs-bug-report/SKILL.md:99` — "run it via Bash and report pass/fail"
- `skills/gs-gate-check/SKILL.md:217` — "(run test suite via Bash)"
- `skills/gs-gate-check/SKILL.md:283` — "Run the test suite via `Bash`"
- `skills/gs-smoke-check/SKILL.md:79` — "Attempt to run the test suite via Bash"
- `skills/gs-story-done/SKILL.md:83` — "run it via `Bash`"
- `skills/gs-hotfix/SKILL.md:74` — `` `Bash: git rev-parse --is-inside-work-tree 2>/dev/null` ``
  → "Check whether this is a git repository, using the shell tool (`bash` on
  POSIX, `pwsh` on Windows): `git rev-parse --is-inside-work-tree`". The
  `2>/dev/null` (POSIX-only redirection, invalid under `pwsh`) is dropped
  rather than given a platform-conditional pair — the check's "fails or
  returns empty" logic does not depend on stderr being suppressed.
- `skills/gs-retrospective/SKILL.md:61` — "Use the Bash tool (which uses Git
  Bash on Windows...)" → "Use the shell tool (`bash` on POSIX, `pwsh` on
  Windows):"
- `skills/gs-retrospective/SKILL.md:64` — `` `Bash: git log --oneline --since="4 weeks ago" 2>/dev/null || git log --oneline -20` ``
  → the "Bash:" transcript label dropped, `2>/dev/null` dropped for the same
  reason as gs-hotfix (this fallback's `||` does not depend on it).

**Left as-is** (the manifest's regenerated ledger, 1 site):
- `pipeline/workflow-guide.md:39` — "**Git** with Git Bash (Windows) or
  standard terminal (Mac/Linux)" — a human prerequisites list, genuinely
  about the shell program a developer installs, already deliberately
  preserved by `fixupClaudeDocResidue`'s `workflow-guide.md` block.

## 2. Delegation-idiom nits (plural meets the singular article)

Three sites named in the brief, two more of the identical shape found while
reading the required five-large-skills and ten-random-skills sample, and
eight more found in the coordinator's own scan and fixed in round 2 (§6.3).
**All 13 are now fixed**, either as a `fixupClaudeDocResidue` literal
(drops `via Task` from the raw upstream text before `TASK_DELEGATION_PHRASES`
turns it into `via a subagent`) or, for the 7-site corpus-wide repeat, a new
`TASK_DELEGATION_PHRASES` regex entry (§6.3). The shared rule's generic
`via\s+Task` -> `via a subagent` behavior is untouched; the other ~68
correctly-singular `via Task` sites are unaffected.

- `content/skills/gs-gate-check/SKILL.md:317` — "spawn all four directors as
  **parallel subagents** via a subagent" → dropped `via Task`, kept "as
  **parallel subagents**".
- `content/skills/gs-brainstorm/SKILL.md:206` — "spawn BOTH `creative-director`
  AND `art-director` via a subagent in parallel" → "...as parallel subagents
  before moving to Phase 5."
- `content/handbook/director-gates.md:91` — "Spawn all [N] agents
  simultaneously via a subagent" → dropped `via Task`.
- `content/skills/gs-design-system/SKILL.md:468` and `:518` (found in one of
  the five required large skills) — "spawn specialist agents via a subagent
  in parallel" → dropped `via Task`. One split/join fixed both (verified 2
  hits, both upstream-identical).
- `content/skills/gs-code-review/SKILL.md:95` (found in the ten random
  skills) — "Spawn all applicable specialists simultaneously via a subagent"
  → dropped `via Task`.
- **Round 2, corpus-wide (7 sites, one regex in `TASK_DELEGATION_PHRASES`)**:
  `content/skills/gs-dev-story/SKILL.md:300`,
  `content/skills/gs-team-audio/SKILL.md:120`,
  `content/skills/gs-team-combat/SKILL.md:129`,
  `content/skills/gs-team-level/SKILL.md:166`,
  `content/skills/gs-team-live-ops/SKILL.md:146`,
  `content/skills/gs-team-narrative/SKILL.md:109`,
  `content/skills/gs-team-polish/SKILL.md:129` — all byte-identical:
  "sub-agents spawned via a subagent. Each sub-agent enforces...". Fixed via
  `/\bsub-agents\s+spawned\s+via\s+Task\b/` → `sub-agents`, placed before the
  generic `via\s+Task` entry in `TASK_DELEGATION_PHRASES` so it consumes the
  phrase first. See §6.3 for why the initial pass's "unsafe to fix
  sight-unseen, corpus wraps mid-phrase" reasoning did not hold up.
- **Round 2, one more site of a different shape**:
  `content/skills/gs-dev-story/SKILL.md:178` — "Spawn the chosen programmer
  agent(s) via a subagent with the full context package" → dropped
  `via Task` (a `fixupClaudeDocResidue` literal — this shape occurs once,
  not worth a second corpus-wide regex).

## 3. Five largest skills — full read

`gs-setup-engine` (34 KB), `gs-design-system` (41 KB), `gs-gate-check`
(30 KB), `gs-ux-design` (33 KB), `gs-prototype` (29 KB) — all five read end
to end. Checked in each: hook/`.claude/`/Claude-Code-agent-mechanics residue,
relative path resolution, `gs-` command prefixing, calls to nonexistent tools.

- `gs-setup-engine`: clean. All `../../engines/` and `../../handbook/` paths
  resolve. No hook/`.claude` residue.
- `gs-design-system`: two delegation nits fixed (§2). Otherwise clean —
  paths resolve (`../../handbook/director-gates.md`,
  `../../templates/game-design-document.md`), commands all `/gs-`-prefixed.
- `gs-gate-check`: one delegation nit fixed (§2, gate-check:317), plus two of
  the eight R3 Bash-tool sites (§1). Otherwise clean.
- `gs-ux-design`: clean. All paths resolve, no stray tool/hook references.
- `gs-prototype`: clean. `isolation: worktree` in frontmatter is carried as
  advisory `metadata:` per `transformSkillFrontmatter`'s existing design
  (Task 14, not new to this pass) — not enforced, not misleading in context.

## 4. Ten random command skills — full read (`shuf`-selected)

`gs-vertical-slice`, `gs-skill-test`, `gs-scope-check`, `gs-balance-check`,
`gs-skill-improve`, `gs-security-audit`, `gs-qa-plan`, `gs-review-all-gdds`,
`gs-code-review`, `gs-bug-triage`.

- `gs-code-review`: one delegation nit fixed (§2). Otherwise clean.
- `gs-skill-test`: **fixed, three separate defects, all the same underlying
  cause** — this linter's own required-frontmatter/warn checks describe
  upstream's frontmatter shape, not what this port actually emits:
  - Check 1 ("Required Frontmatter Fields") and Check 4's FAIL condition
    both required an `allowed-tools:` frontmatter key. This harness's port
    drops `allowed-tools` outright (`SKILL_DROP` in `rules.mjs` — a
    per-skill tool allowlist has no meaning here), so every one of the 73
    ported skills was **guaranteed** to fail this linter's own Check 1, and
    Check 4's FAIL branch could never trigger correctly either. Rewrote
    Check 1's required-field list to the fields this harness's skills
    actually carry (`name`, `description`, `disable-model-invocation`,
    `user-invocable`, noting `argument-hint`/`model`/etc. live in a nested
    `metadata:` block instead of top-level), and rewrote Check 4's FAIL
    condition to check the skill's body for write/edit instructions instead
    of a nonexistent field. Verified against `content/skills/gs-ping/SKILL.md`
    (first-party, hand-authored, never passes through
    `transformSkillFrontmatter`): it already carries the four required
    top-level keys, so the rewritten Check 1 holds for it too.
  - **Round 2 follow-through**: Check 6 ("Fork Context Complexity") and
    Check 7 ("Argument Hint Plausibility") have the identical root cause,
    silent until the review round only because both are WARN paths that
    simply never fire (vs. Check 1/4's always-FAIL). Check 6 checked
    top-level frontmatter for `context: fork`; the field would live under
    `metadata:` now if any skill carried it (none currently do, upstream or
    ported — this is a dormant check either way, fixed for the day one
    does). Check 7 required `argument-hint` be non-empty without noting it
    is nested under `metadata:`, not top-level, contradicting the Check 1
    parenthetical two checks above it. Both clarified in place.
  - **Round 2, Important 2**: line 15's own description — "runs entirely
    within the existing skill/hook/template architecture" — named "hook" as
    live machinery, the identical residual-machinery problem this file's
    Check 1/6/7 fixes address, just in prose instead of a checklist item.
    Fixed to "skill/template architecture".
- `gs-skill-improve`: **fixed, mirroring gs-skill-test** — its Phase 3
  diagnosis table repeats Check 4, Check 6, and Check 7 verbatim as
  one-line "if this check fails/warns, here's the gap" bullets; all three
  carried the same defects as gs-skill-test's own checks and were rewritten
  to match (Check 4's `allowed-tools` reference in the initial pass; Check
  6/7's `metadata:`-nesting gap in round 2).
- `gs-vertical-slice`, `gs-scope-check`, `gs-balance-check`,
  `gs-security-audit`, `gs-qa-plan`, `gs-review-all-gdds`, `gs-bug-triage`:
  clean — all relative paths resolve, all commands carry `/gs-`, no
  hook/`.claude`/nonexistent-tool references.

### Recorded, not fixed — pre-existing upstream Markdown defect

`content/skills/gs-vertical-slice/SKILL.md`: a closing ` ``` ` at line 246
with no matching opening fence, present verbatim in the upstream source
(confirmed via diff against the `984023d` snapshot). Not a porting defect —
a plain upstream authoring bug, unrelated to the Claude-Code-to-harness
migration this task's rules exist to fix, so no `tools/port/` rule was added
for it.

**Full blast radius** (the review round asked for this — a CommonMark
parser does not stop at the first stray fence, it toggles state at every
```` ``` ```` line found, so the damage compounds):
- Lines 114/118 are a real, balanced pair (the "VERTICAL SLICE - NOT FOR
  PRODUCTION" header comment) — fine on their own.
- Line 246 is the first fence after that balanced pair, so it **opens** a
  code block (there is no unmatched fence before it to make it a closer).
- Everything from line 247 to line 331 — the rest of Phase 6's fallback
  report structure, all of Phase 7 (Creative Director Review), all of
  Phase 8 (Summary and Next Steps), and the PROCEED/PIVOT sections through
  "Ask: 'May I append this to `prototypes/GRAVEYARD.md`?' If yes, add one
  entry:" — renders as **literal, unformatted code text**, not markdown:
  headings, bold, and links in that whole span all render as plain
  characters, not structure.
- Line 332 closes that block.
- Lines 333–337 (the actual intended fenced block — the GRAVEYARD entry
  template) then render as **ordinary prose**, ironically, since we are
  "outside" a fence at that point.
- Line 338 (the fence meant to close that template) instead **opens** a
  final block that is never closed — no further ` ``` ` exists in the file
  — so everything from line 338 to EOF (line 364: the rest of the KILL
  section, Important Constraints, and the final "Usually executed by the
  `prototyper` role" line) also renders as literal code text.

Net effect: roughly half the file (lines 247–331 and 338–364, i.e.
everything past the mid-point of Phase 6 except a five-line island at
333–337) renders as an undifferentiated code block to any CommonMark
renderer, though the raw instructions remain readable to a model reading
the file as plain text (which is why this was not caught by the publish
gates — G1–G4 check structural/referential properties, not rendered
Markdown fidelity).

Recommendation, still not applied (editorial judgment on upstream content,
not something a mechanical rule should guess at): the missing opening fence
most plausibly belongs right after "If the template file is not found, use
this fallback structure:" (before the `` `## Vertical Slice Report...` ``
bullet list), which would make 246 a closer instead of an opener and
collapse the whole cascade back to the single, contained, clearly-broken
block the initial pass assumed this was.

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
sampled implementer-template role briefs. A corpus grep found **35 total
sites**: 34 role briefs sharing that template, plus
`content/templates/collaborative-protocols/implementation-agent-protocol.md`
— all byte-identical: *"If rules/hooks flag issues, fix them and explain
what was wrong."* "Rules" (`content/rules/*.md`) are real on this harness;
"hooks" are not (no pre-tool-use interception — see `NOTICE`), so a hook can
never flag anything here. **Fixed** via a new `R14`/`CLAUDE_CODE_MENTIONS`
entry in `rules.mjs` rather than per-file `fixupClaudeDocResidue` blocks
(would have meant 35 near-duplicate `if` blocks) and rather than a new
pipeline rule (would need `rewriteBody` wiring, a new `ruleHits` key, a
manifest format change, and a fixture test). New text: "If rules flag
issues, fix them and explain what was wrong."

### Companion fix, found via residual grep (not part of the sample)

After fixing the `allowed-tools` defect in gs-skill-test/gs-skill-improve
(§4), a residual `grep -rn "allowed-tools" content/` turned up one more site
sharing the exact same root cause: `content/templates/skill-test-spec.md:15`
— a spec-authoring template's Static Assertions checklist item, explicitly
labeled "Verified automatically by `/gs-skill-test static`", still listing
`allowed-tools` as a required field that gs-skill-test itself no longer
checks for after the §4 fix. **Fixed** via the R14 mechanism, not
`fixupClaudeDocResidue`, because templates never pass through
`fixupClaudeDocResidue` while `rewriteBody`/R14 already runs over every
destination including templates.

### Important 1 (review round): `gs-story-done` made an affirmative false automation claim

`content/skills/gs-story-done/SKILL.md:378` — *"The `validate-commit.sh`
hook will verify design doc references and check for hardcoded values
automatically."* Unlike the "rules/hooks" bullet above (a conditional that
just never fires), this is an **affirmative claim of active enforcement**,
the exact defect class already fixed throughout `workflow-guide.md`.
`validate-commit.sh` is one of the 12 upstream PreToolUse hooks (its own
reference doc is in `EXCLUDED_DOCS`); `NOTICE` says none of the 12 execute
here. It is the only `.sh` reference in shipped content outside `engines/`,
so a single-site `fixupClaudeDocResidue` literal. **Fixed**: "There is no
commit-validation hook on this harness to do this automatically (see
`NOTICE`) — verify design doc references and check for hardcoded values
yourself before running this commit."

### Important 2 (review round): the report's "everything else was clean" claim overreached

The prior version of this task's report said everything outside the noted
findings "was clean" of hook/`.claude`/nonexistent-tool references. That
summary sentence was wrong — three sites within the reviewed material
weren't clean, two of which are recorded above (gs-skill-test:15,
gs-story-done:378). The third:

- `content/handbook/agent-coordination-map.md:173` — a Pattern 5 workflow
  diagram: "6. producer -- Sprint retrospective with post-sprint hook". The
  other five steps in the same diagram each name a real `/command` instead
  of prose (e.g. "1. producer -- Plans sprint with `/sprint-plan new`"), so
  rather than just deleting the dead hook reference, it was replaced with
  the harness's actual command for this exact job: `/retrospective` (a real,
  whitelisted command, R4-prefixed to `/gs-retrospective` on port), matching
  the diagram's own established pattern. **Fixed.**

The task report has been corrected to name the actual scope of "clean"
accurately rather than repeat the overreaching sentence.

## 6. Round 2 — coordinator review response

The coordinator's review confirmed the round-1 work sound (reproducibility,
the `allowed-tools` finding, the 35-site R14 rewrite) and raised two
Important findings (folded into §4/§5 above) plus several follow-through
items, addressed here.

### 6.1 — `gs-retrospective:61` misclassification, and re-testing the other three

The brief told this pass that 4 of the 9 R3 sites were "Git Bash the shell,"
including `gs-retrospective:61`. The coordinator identified that as wrong:
that sentence names the **tool** ("Use the Bash tool...") and asserts a
specific, false claim about this harness's Windows behavior, not a
human-facing shell mention. Re-testing the other three "left" sites against
the coordinator's stated criterion — *does the sentence name the tool, or
the shell a human is typing into?* — found two more misclassifications:

- `gs-hotfix:74` and `gs-retrospective:64` are both instructions **from the
  skill to the model** ("Check whether this is a git repository: `Bash: git
  rev-parse ...`"), formatted as a transcript-style tool invocation, not a
  human prerequisites list. Reclassified as tool references and fixed the
  same way as the original five (§1).
- `pipeline/workflow-guide.md:39` re-tested and confirmed correctly
  classified: it is a "Before you start, make sure you have:" prerequisites
  list for a human setting up their own machine, unrelated to any agent
  tool. Left as-is.

Final ledger: 8 of 9 original sites are tool references and are fixed; 1 is
genuinely the shell and stays.

### 6.2 — Important 1 and Important 2

Both addressed in place in §4 and §5 above (gs-story-done's affirmative hook
claim; gs-skill-test:15 and agent-coordination-map.md:173 folded into the
"clean" claim's correction).

### 6.3 — The 7 deferred "sub-agents spawned via Task" sites, plus an 8th

The initial pass recorded these as "not fixed, out of sample, corpus
hard-wraps mid-phrase elsewhere so unsafe to fix sight-unseen" — but did not
actually check whether THESE SPECIFIC 7 sites wrap. They do not: all 7
occurrences of "sub-agents spawned via Task" are contiguous on a single
line (verified by grep against the raw upstream tree, the identical check
already run for the 35-site R14 fix), so the stated reason for deferring
did not hold up on inspection. Fixed via a new `TASK_DELEGATION_PHRASES`
regex entry, placed before the generic `via\s+Task` entry so it consumes
the phrase first (see the code comment in `rules.mjs` for the full
reasoning) — see §2 for the site list.

The coordinator's own scan additionally found an 8th site of a related but
differently-shaped problem, `gs-dev-story:178` ("Spawn the chosen programmer
agent(s) via Task..."), which the 7-site regex does not match (no "sub-agents
spawned" text). Fixed as a separate one-line `fixupClaudeDocResidue` literal
— see §2.

A scan of every remaining `via a subagent` context after these fixes shows
these 8 were the complete remaining population of this defect class; the
other ~68 correctly-singular sites read fine and were not touched.

### 6.4 — `allowed-tools` root cause: two sibling checks, not just the symptom

Round 1 fixed Check 1 and Check 4 in `gs-skill-test`/`gs-skill-improve` but
stopped at the `allowed-tools` string sweep. Two more checks in the same
file have the identical shape (validating frontmatter this port does not
emit at top level) and were silent only because they are WARN paths that
simply never fire, rather than an always-FAIL: Check 6 (`context: fork`,
which lives under `metadata:` if present at all, and is currently absent
from the whole corpus) and Check 7 (`argument-hint`, real and present on
every skill, but nested under `metadata:`, not top-level — the exact
nesting note Check 1's own parenthetical already states two checks above
it, just not carried across). Both fixed in `gs-skill-test` and mirrored in
`gs-skill-improve`'s diagnosis table — see §4.

### 6.5 — The R2 manifest delta, explained and verified

The manifest's R2 (`rewriteStructuredTools`) file-hit count moved 94 → 93
between the pristine port and this task's first commit. Verified directly,
not just accepted on the coordinator's say-so: `grep` for every R2-triggering
pattern (bare-backticked `` `Read`/`Write`/`Edit` ``, an "X tool" phrase, or
any `TASK_DELEGATION_PHRASES` idiom — `via Task`, `Task calls`, `Task agents`,
`Task prompt`, `Task in this skill`) against `gs-skill-test`'s raw upstream
text finds exactly **one** match: line 77, `` **FAIL** if `allowed-tools`
includes `Write` or `Edit` but no ask-before-write language is found. ``.
That is precisely the line the round-1 `fixupClaudeDocResidue` fix rewrites
(dropping the backticked `Write`/`Edit`) *before* R2 ever sees the text, so
after the fix `gs-skill-test` has zero remaining R2 triggers and drops out
of the file-hit count — 94 → 93, exactly one file, exactly this one.

Separately verified for round 2: the new `TASK_DELEGATION_PHRASES` entry
(§6.3) does **not** move the R2 count again. Isolated with
`git stash push -- tools/port/rules.mjs`, re-running the port without the
new entry, and comparing — both with and without it, R2 reads 93. All 7
"sub-agents spawned via Task" sites were already R2-hit files (via other,
unrelated `via Task`/`Task calls` sites elsewhere in the same bodies from
prior work), so the new regex adds matched text within already-counted
files rather than adding new files to the count.

## 7. Verification (final, after round 2)

- Re-ran `port.mjs` against the pinned `984023d` snapshot twice after all
  fixes; `content/` is byte-identical across both runs (sha256 over every
  file, confirmed).
- `pnpm build`, `pnpm lint:content`, `pnpm vitest run` — all pass (137/137
  tests, both publish gates clean).
- Counts unchanged: skills 74, roles 49 + `_index.md` (50 files), templates
  40, rules 11, engines 46, handbook 12, pipeline 2, excluded 10.
- `content/orchestration/` and `content/skills/gs-ping/` — no diff in `git
  status`/`git diff --stat` for either path; untouched by this pass.
- Manifest's "Bash sites needing manual rewrite" count: 9 → 1 (only
  `pipeline/workflow-guide.md:39`).
- Manifest's rule-hit table (final): R1 85, R2 93, R4 135, R5 15, R6 68,
  R7 16, R14 49. R2's 94→93 delta and R14's 13→49 jump are both explained
  and verified in §6.5 and §5 respectively; neither moved again in round 2
  except as accounted for.
- `grep -rn "rules/hooks" content/` → 0 hits.
- `grep -rn "allowed-tools" content/` → only this pass's own explanatory
  mentions (gs-skill-test ×2, skill-test-spec.md ×1), no stale requirement
  left anywhere.
- `grep -rn "sub-agents spawned via" content/` → 0 hits (all 7 fixed to
  read "sub-agents", confirmed each still reads correctly in context).
- `grep -n "validate-commit.sh\|post-sprint hook" content/` → 0 hits.
