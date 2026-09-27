---
id: TKT-66
title: Add GLB and BOS export sinks to the Effects pack
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.Effects/**, tests/flow/BimOpenFlow.Nodes.Effects.Tests/**, tests/BimOpenToolkit.Layering.Tests/**]
---

## Acceptance criteria

- [ ] `sink.exportGlb` and `sink.exportBos` write files on a Run and record them like the other sinks
- [ ] The layering tests allow the dependency the sinks need, or the sinks live in a project that already has it

`src/flow/BimOpenFlow.Nodes.Effects/README.md:40` defers them until the project may reference the Mesher and BimOpenSchema.IO; `docs/bimopenflow-structure.md:154` still promises GLB export. The first chunk is deciding which project holds them. Raised by reviews/2026-09-27-status.md
