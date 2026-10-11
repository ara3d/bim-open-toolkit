---
id: TKT-186
title: Run the Speckle viewer locally in the studio: a speckle.html page and a View3DDeps rig fed by a host endpoint
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/pane-3d-speckle/**, bimopenflow/web/packages/studio-web/**, src/studio/BimOpenFlow.Studio/SpeckleEndpoint.cs, src/studio/BimOpenFlow.Studio/Program.cs, gates/speckle-smoke.mjs, .claude/launch.json]
workflow: [W3]
related: [TKT-185, TKT-28, TKT-15]
created: 2026-10-10
---

## Acceptance criteria

- [ ] speckle.html lists the host's models and opens any in @speckle/viewer from GET /api/models/{id}/speckle, converted once and cached by BOS content hash, with no Speckle server or account
- [ ] With ?viewer=speckle the 3D pane runs on the Speckle rig: colour, isolate and hide tables apply through the filtering extension, picks select the entity, transforms are refused with a visible notice
- [ ] A web smoke loads the Duplex and checks LoadComplete and a non-zero object count; first-frame time and memory for the Duplex and Schependomlaan are recorded for both renderers

Plan: docs/plans/speckle-converter-and-viewer.md, spikes S1 and S2 first (three.js 0.140 against the workspace's 0.185; loading from in-memory objects through ObjectLoader2Factory.createFromObjects). If S2 fails the viewer cannot run without a server and this ticket becomes a question.
