# Command → pipeline phase

Which of the seven pipeline phases each studio command belongs to. The
panel groups the command list by this file; `gs-pipeline.md` owns the
phase definitions themselves.

Hand-maintained, and therefore guarded: `test/command-phases-truth.test.ts`
asserts that every shipped command appears exactly once and that every
phase name here matches `gs-pipeline.md`'s table. A command added upstream
turns that test red rather than quietly vanishing from the panel.

| Command | Phase |
|---|---|
| gs-adopt | Concept |
| gs-architecture-decision | Architecture |
| gs-architecture-review | Architecture |
| gs-art-bible | Design |
| gs-asset-audit | QA |
| gs-asset-spec | Design |
| gs-balance-check | QA |
| gs-brainstorm | Concept |
| gs-bug-report | QA |
| gs-bug-triage | QA |
| gs-changelog | Release |
| gs-code-review | Sprint |
| gs-consistency-check | Design |
| gs-content-audit | QA |
| gs-create-architecture | Architecture |
| gs-create-control-manifest | Architecture |
| gs-create-epics | Sprint |
| gs-create-stories | Sprint |
| gs-day-one-patch | Release |
| gs-design-review | Design |
| gs-design-system | Design |
| gs-dev-story | Sprint |
| gs-estimate | Sprint |
| gs-gate-check | QA |
| gs-help | Concept |
| gs-hotfix | Release |
| gs-launch-checklist | Release |
| gs-localize | Polish |
| gs-map-systems | Design |
| gs-milestone-review | Sprint |
| gs-onboard | Concept |
| gs-patch-notes | Release |
| gs-perf-profile | Polish |
| gs-ping | Concept |
| gs-playtest-report | QA |
| gs-project-stage-detect | Concept |
| gs-propagate-design-change | Architecture |
| gs-prototype | Concept |
| gs-qa-plan | QA |
| gs-quick-design | Design |
| gs-regression-suite | QA |
| gs-release-checklist | Release |
| gs-retrospective | Sprint |
| gs-reverse-document | Design |
| gs-review-all-gdds | Design |
| gs-scope-check | Sprint |
| gs-security-audit | QA |
| gs-setup-engine | Architecture |
| gs-skill-improve | QA |
| gs-skill-test | QA |
| gs-smoke-check | QA |
| gs-soak-test | Polish |
| gs-sprint-plan | Sprint |
| gs-sprint-status | Sprint |
| gs-start | Concept |
| gs-story-done | Sprint |
| gs-story-readiness | Sprint |
| gs-team-audio | Sprint |
| gs-team-combat | Sprint |
| gs-team-level | Sprint |
| gs-team-live-ops | Release |
| gs-team-narrative | Sprint |
| gs-team-polish | Polish |
| gs-team-qa | QA |
| gs-team-release | Release |
| gs-team-ui | Design |
| gs-tech-debt | Sprint |
| gs-test-evidence-review | QA |
| gs-test-flakiness | Polish |
| gs-test-helpers | QA |
| gs-test-setup | Architecture |
| gs-ux-design | Design |
| gs-ux-review | Design |
| gs-vertical-slice | Architecture |
