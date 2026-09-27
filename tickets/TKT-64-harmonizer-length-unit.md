---
id: TKT-64
title: Read the IFC length unit in the Harmonizer instead of assuming metres
status: open
depends_on: []
owner:
fence: [submodules/bim-open-schema/**, src/data/**, tests/data/**]
---

## Acceptance criteria

- [ ] `UnitConversion` reads `Ifc:LengthUnitToMetre` (TODO at `Harmonizer/UnitConversion.cs:19` gone)
- [ ] A test converts a millimetre IFC and gets the same lengths in metres as the metre version

Listed only as an extension point of `docs/plans/snowdon-federation-build.md:406`, but it is a correctness bug: any model authored in millimetres or feet gets lengths off by 1000 or 3.28. Raised by reviews/2026-09-27-status.md
