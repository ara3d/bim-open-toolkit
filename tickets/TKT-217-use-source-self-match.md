---
id: TKT-217
title: A source node's own path box offers 'use <itself>' because the path-match control compares against every source, including the node it sits on
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-138]
created: 2026-10-11
kind: defect
---

Seen in the browser on 2026-10-11 on the generic host (bim-open-flow at ee050c0), analysis schependomlaan-spaces-per-storey: the duck.source node 'db' shows a 'use source' button on its own Path row (accessibility name 'db path use source'). The match in sourceGestures.ts / filePathControl.ts must skip the node that owns the control. Also noted there: the hover highlight on a chip is too faint to see at the browser pane's resolution, so check its contrast against docs/BRANDING.md.
