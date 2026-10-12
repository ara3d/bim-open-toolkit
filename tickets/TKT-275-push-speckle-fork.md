---
id: TKT-275
title: Push bim-open-web-viewer (the offline Speckle viewer fork) to GitHub so the bench can pin it by URL
status: open
depends_on: []
owner:
fence: []
workflow: [W5]
related: [TKT-226, TKT-186]
created: 2026-10-11
kind: action
---

C:\Users\cdigg\git\bim-open-web-viewer (the fork of speckle-server's packages/viewer with the BOS loader, latest commit ddf4727 on 2026-10-11) has no remote. The bench's Speckle pane, tools/speckle/tool.json in ara3d/bim-open-web-viewer's consumer ara3d/bim-open-bench, pins it by local path, which only works on the owner's machine. Owner: create the GitHub repository (ara3d/bim-open-web-viewer, Apache-2.0 as the fork's LICENSE says), push main, then change the tool.json repo field to the URL and commit in the bench. Filed 2026-10-11 by the session that built the bench panes (TKT-226).
