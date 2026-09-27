---
id: TKT-59
title: Finish the flow-demos leftovers: a rel.rename node, RunReplay effect hashes, and a {TABLES} placeholder
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.Relations/**, src/flow/BimOpenFlow.Host/**, samples/**, tests/flow/**]
---

## Acceptance criteria

- [ ] A `rel.rename` node exposes the existing Rename plan operator (`Operators.cs:25`), and the DC-W1 and storey-walk graphs use it instead of source column spellings
- [ ] `RunReplay` re-derives effect output hashes, or the limitation at `submodules/ara3d-dataflow/README.md:566` is kept with a reason
- [ ] Showcase graphs name their tables folder through a `{TABLES}` placeholder in `SampleSeeding.ShowcaseAnalyses`

Listed as still open in `docs/plans/flow-demos/PLAN.md:174` after the 2026-09-18 follow-through; `track-t.md:107` defers the placeholder. Raised by reviews/2026-09-27-status.md
