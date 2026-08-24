---
name: gs-ping
description: Studio install probe. Confirms the dsh-game-studio command skills reached the / menu; prints the studio content path and reads its own reference file.
disable-model-invocation: true
user-invocable: true
---

# Studio install probe

This skill exists to prove the installation works. Do these three things and
report the result as a short list:

1. State that the `dsh-game-studio` command skills are reachable.
2. Read `references/probe.md` beside this skill and quote its marker line.
3. Report the absolute directory this skill was loaded from.

If all three succeed, the command-skill half of the plugin is installed
correctly.
