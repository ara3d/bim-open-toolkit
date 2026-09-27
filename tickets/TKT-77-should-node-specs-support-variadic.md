---
id: TKT-77
title: Should node specs support variadic input ports?
status: open
depends_on: []
owner:
fence: []
kind: question
---

`docs/proposals/core-node-sets.md:359` and `data-node-sets.md:769`. Optional ports shipped (`Ports.cs:19`); `check.union` and `table.concat` still take exactly two inputs (`CheckUnionNode.cs:9`).

Options: a spec and engine change for variadic ports; or keep chaining binary nodes.

No default in the source.

Raised by reviews/2026-09-27-status.md
