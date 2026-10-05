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
