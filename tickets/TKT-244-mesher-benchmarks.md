---
id: TKT-244
title: Warm mesher timings under BenchmarkDotNet
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/bench/ifc-mesher/Ara3D.Ifc.Mesher.Benchmarks/**, deps/bim-open-data/bench/ifc-mesher/timing.md, deps/bim-open-data/bench/ifc-mesher/timing.json]
workflow: [W3, W5]
related: [TKT-65, TKT-190]
created: 2026-10-11
---

## Acceptance criteria

- [ ] A BenchmarkDotNet project meshes the three quick files and duplex.ifc warm, with the web-ifc DLL beside it, and writes timing.md and timing.json in bench/ifc-mesher
- [ ] The committed table holds a warm number per file per mesher from one run on the owner's machine

Track D1 of docs/plans/ifc-mesher-roadmap.md. The 371 ms against 13 ms on IfcOpenHouse in RESULTS.md includes JIT warm-up and is not a measurement.
