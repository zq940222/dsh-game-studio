---
name: gs-leak
description: A command skill whose body still carries an unsubstituted %%GS_ marker.
disable-model-invocation: true
user-invocable: true
---

This body still references %%GS_CONTENT_DIR%% and must never ship this way.
