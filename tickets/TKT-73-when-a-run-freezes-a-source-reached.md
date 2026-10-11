---
id: TKT-73
title: When a Run freezes a source reached through the registry, does it hash the resolved file or record the registry entry?
status: open
depends_on: []
owner:
fence: []
workflow: [W3]
kind: question
---

`docs/proposals/table-graph-migration.md:189`. `RunInputs.cs` handles only `ModelRef` and `FilePath`.

Options: hash the resolved file (exact, but a large file costs a full read); or record the registry entry and its version (cheap, but trusts the registry). TKT-53's evidence package depends on the answer.

No default in the source.

Raised by reviews/2026-09-27-status.md

Note 2026-10-11: TKT-202 makes a source node the one place a database is opened and gives its value a content hash, so for file-backed sources the answer is the first option, hash the resolved file, taken at the source node and cached by the source's own cache. The registry question stays open only for sources the registry resolves without a file.
