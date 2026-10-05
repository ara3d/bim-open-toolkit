---
id: TKT-78
title: Retire bos.query now that sql.query covers it?
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
kind: question
---

`docs/proposals/core-node-sets.md:380`. `BosQueryNode.cs` still ships and no sample uses it.

Options: delete it; or keep it as a deprecated alias for one release.

No default in the source.

Raised by reviews/2026-09-27-status.md
