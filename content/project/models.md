# Model tiers

Role briefs under `roles/` (and some pipeline skills) carry a
`model-tier` hint — Haiku / Sonnet / Opus — suggesting how much
reasoning a task needs. Treat it as advice, not a mechanism: this
harness does not act on it.

## Why there is no mechanism

Delegation in this harness goes through a single `subagent` tool, and
that tool's model-facing schema exposes exactly three parameters:
`description`, `prompt`, and an optional `run_in_background`. There is
no per-call `model` parameter, so nothing a delegating skill writes can
choose which model a subagent runs on. A subagent's model is fixed by
this plugin's own Cordis configuration for the whole delegation
provider, set once, not per call — so every subagent a session spawns
simply inherits the parent session's model.

## What this means in practice

- A role brief's `model-tier: opus` does not put that role's subagent on
  Opus. It is a note for whoever chooses what model the *parent* session
  runs under, or for a future tiering layer — not something `/gs-start`
  or any shipped skill enforces today.
- Do not write project rules, workflow steps, or automation in this
  workspace that assume a tier is actually enforced. None of the shipped
  studio content does this, and this project's `AGENTS.md` should not
  introduce it either.

## Later

Real per-tier model selection is a `modelTiers` configuration layer
deferred to a later phase of this port — it is not one of the keys this
release implements (see the plugin's own README for the exact list of
what `Configuration` currently covers).
