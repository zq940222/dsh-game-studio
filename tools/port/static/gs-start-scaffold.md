
---

## Scaffolding this project for the harness

Upstream's onboarding above assumes the studio lives in the project. On
this harness it ships with the plugin, so the project needs one file and a
directory tree rather than a copy of the studio.

**Ask before writing anything.** This writes into the user's workspace.
Show the plan, get a yes, then write.

1. Read `../../project/directory-scaffold.md` and create the directories
   it lists that do not already exist. Never delete or overwrite an
   existing directory.
2. Read `../../project/AGENTS.md.template`. Fill its placeholders:
   - `{{PROJECT_NAME}}` — ask the user.
   - `{{ENGINE}}` — ask, or detect from the workspace (a `project.godot`,
     an `Assets/` directory, a `.uproject`).
   - `{{CONTENT_DIR}}` — the absolute path this skill was loaded from,
     minus the trailing `skills/gs-start/`. The resource base is given to
     you when this skill loads; do not guess it.
     <!-- This is safe to promise: design fact #20 — the filesystem provider
          injects `Base directory for this skill: <abs path>` for the command
          skills it serves too, observed in production on gs-ping (Phase 1
          record §2②), not only for runtime-registered skills. -->
3. Write the filled template to the workspace root as `AGENTS.md`. If one
   already exists, show the diff and ask before touching it.
4. Tell the user what you created and that `AGENTS.md` is now read into
   every session in this workspace.

Then load `gs-pipeline` and run `/gs-project-stage-detect` to find where
the project actually is.
