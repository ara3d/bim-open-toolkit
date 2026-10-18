---
id: TKT-147
title: IfcRoundTripTests.DiffDetectsTypeChangeAsDeleteAndAdd fails: it rewrites a file it still holds open
status: done
depends_on: []
owner: session c4298a2b
session: c4298a2b-52b5-4c66-abfe-c7b982524e14
fence: [deps/bim-open-data/tests/data/Ara3D.Ifc.Tests/IfcRoundTripTests.cs]
workflow: [kept]
claimed: 2026-10-18
closed: 2026-10-18
kind: defect
---

## Acceptance criteria

- [x] Ara3D.Ifc.Tests passes 20 of 20 in bim-open-data with the test kit present

Seen 2026-10-04 in bim-open-data (tests/data/Ara3D.Ifc.Tests, 19 of 20): IOException, 'duplex-typechange.ifc' is being used by another process, at IfcRoundTripTests.cs line 71. The test loads tempPath into `removedFile` (IfcSourceFile.Load, a using variable still in scope) and then File.WriteAllBytes to the same path. Unrelated to the TKT-145 changes, which do not touch IfcSourceFile or IfcPatcher. Writing the appended file to a second path would fix it.
