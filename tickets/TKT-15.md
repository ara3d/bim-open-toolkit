---
id: TKT-15
title: A coarse first frame for Snowdon under 2 s warm
status: open
depends_on: []
owner:
fence: [deps/bim-open-viewer/packages/**, bimopenflow/web/packages/panes/src/viewerDeps.ts, bimopenflow/web/packages/panes/src/viewPane3D.ts, bimopenflow/web/packages/panes/test/viewPane3D.test.ts, scripts/profile-bim-flow-startup.mjs, docs/bim-flow-startup.md, docs/bim-flow-3d.md, docs/plans/coarse-first-frame.md]
workflow: [W3]
---

## Acceptance criteria

- [ ] /3d.html?analysis=snowdon-toolkit shows a coarse rendering (bounding boxes or decimated instances) under 2 s warm, as scripts/profile-bim-flow-startup.mjs measures it (navigation to the first model frame), and refines to the full 456,598 instances without a reload
- [ ] The pane distinguishes coarse readiness from full readiness in its status line
- [ ] First-frame and full-load times are measured by the walkthrough and logged against the 2 s target in docs/bim-flow-startup.md

Serves W4. docs/bim-flow-startup.md 'Remaining opportunities' and docs/bim-flow-3d.md 'Limits': 5.2 to 5.8 s to first frame with no level of detail; the 43-second silent converter start is a separate item. The blank canvas is the roughness a reviewer feels first.

## Notes

- 2026-10-03: claim released; the session that held it (small-job-builder) had stopped. Checked against the code that day. Done: the coarse preview pipeline, chunks C1 to C5, C7 and P1 (903d9d8 to defb89e). Left: C6, the real-browser measurement, and C8, three warm runs of `scripts/profile-bim-flow-startup.mjs` logged in `docs/bim-flow-startup.md`. Nobody has measured the first frame yet; it needs the Snowdon BFAST and a browser.
- 2026-10-03: the viewer workspace `viz/` moved to the `bim-open-viewer` repository and reaches the toolkit as `deps/bim-open-viewer`; the fence now names that path. Work in that path belongs to `bim-open-viewer`: a change there is committed in that repository and then pinned in the toolkit's `deps.json`.
