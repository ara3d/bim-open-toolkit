---
id: TKT-228
title: bim.bounds reads the model's geometry box when a BOS has no Rvt:Element:Bounds, shared with bim.orientation
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.BimAnalysis/**]
workflow: [W3]
related: [TKT-219]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] bim.bounds on samples/nrc/duplex-enriched.bos returns one row per element with geometry (0 rows today)
- [ ] The world-box-of-visible-geometry fallback lives in BimModel, cached per file, and both bim.bounds and bim.orientation (BimOrientationNode.cs) call it; the copy in BimOrientationNode.cs is deleted
- [ ] A test covers a BOS with Rvt:Element:Bounds and one without

Found building the visualization demo graphs (docs/plans/viz-demos.md). bim.bounds returns 0 rows on duplex-enriched.bos because it reads only Rvt:Element:Bounds. bim.orientation already falls back to the world box of visible geometry. Move that fallback into BimModel so the two nodes share one implementation. TKT-219 reports the same symptom (0 rows on the public .bos samples) and asks for a root cause; this ticket is the cause found for the enriched duplex file and the fix, so whoever takes one should check the other.
