---
id: TKT-197
title: BimOpenFlow.sln does not build inside the toolkit's deps/ folder: its project paths assume the standalone deps/ layout
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/BimOpenFlow.sln]
workflow: [kept]
created: 2026-10-10
kind: defect
---

## Acceptance criteria

- [ ] dotnet build BimOpenFlow.sln works both in a standalone clone and as deps/bim-open-flow, or the README says which projects to build in linked mode

From the BOS middle-layer wave review (docs/plans/bos-middle-layer.md, Review findings), 2026-10-10. Seen while running the wave's gate: MSB3202 for deps\ara3d-sdk and deps\bim-open-schema project paths under deps/bim-open-flow/deps/. Each test project builds on its own.
