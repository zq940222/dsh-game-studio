---
name: gs-templates
description: The studio's document templates and how to choose one. Load when producing a GDD, an ADR, a test plan, a post-mortem, or any other studio document, so the output matches the house shape.
---

# Templates

The studio ships document templates for the artifacts each pipeline phase
produces. Do not invent a document shape when one exists — a template
carries the sections a later phase's gate will look for.

The index, one row per template with its purpose, is generated at
`%%GS_CONTENT_DIR%%templates/_index.md`. Read that first and pick from it;
it is regenerated with the content, so it cannot drift from what actually
ships.

## Choosing

Match the template to the deliverable, not to the phase. A design document
written during Architecture is still a design document. If two templates
seem to fit, pick the more specific one and delete the sections that do
not apply rather than starting from the generic one.

## Filling one in

Copy the template into the project's own tree — never edit the shipped
copy, which is regenerated from the upstream snapshot and will overwrite
your changes. Ask the user where it should live before writing it.
