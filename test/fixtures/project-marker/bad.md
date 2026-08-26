# Bad project template fixture

This fixture exists to prove `checkNoMarkersTree` still rejects a raw
`%%GS_` marker inside `content/project/`, even though that directory's
own placeholder convention is `{{...}}`, not `%%GS_`. Nothing substitutes
`%%GS_` markers here, so one reaching this file would leak straight into
a user's workspace unchanged.

See %%GS_CONTENT_DIR%%rules/gameplay-code.md for the leaked marker this
fixture is testing.
