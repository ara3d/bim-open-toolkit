---
id: TKT-225
title: Compare Ara3D.Ifc.Mesher with four other IFC meshers (web-ifc DLL, web-ifc 0.0.78, IFClite, IfcOpenShell) from stored mesh dumps
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/bench/ifc-mesher/**, deps/bim-open-data/tests/data/Ara3D.IfcMeshingComparison/**, docs/plans/ifc-mesher-comparison.md]
workflow: [W3]
related: [TKT-216, TKT-65]
created: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [ ] Each of the five meshers has a backend in Ara3D.IfcMeshingComparison; the three external ones (web-ifc 0.0.78 through node, IFClite through ifclite-geom, IfcOpenShell through its Python iterator) run only on demand through one script that writes a mesh dump per model and records the tool version, the input hash, and the time taken
- [ ] The mesh dumps for the three quick files are committed under bench/ifc-mesher/, so the comparison runs on a fresh checkout with none of the external tools installed; dumps for other models stay under artifacts/
- [ ] A test in the default run compares every mesher pair on the quick files from the dumps in under 30 seconds, and is ignored, not failed, when a dump is missing
- [ ] bench/ifc-mesher/RESULTS.md carries a dated matrix: per file and per mesher, triangle count, instance count, bounds, time, and the parity of every mesher against every other

Asked by the owner on 2026-10-11 after the layout work (TKT-216). The five meshers: the pure C# Ara3D.Ifc.Mesher; the Ara3D C# wrapper around the older web-ifc C++ (the WebIfcDll backend that exists); the latest web-ifc (0.0.78 on npm, the engine under ThatOpen components); IFClite (ifclite-geom 4.15.0 on PyPI, Rust exact CSG); IfcOpenShell (0.8.5, installed here). The plan is docs/plans/ifc-mesher-comparison.md.
