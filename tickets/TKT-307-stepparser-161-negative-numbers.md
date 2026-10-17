---
id: TKT-307
title: The published Ara3D.IO.StepParser 1.6.1 reads negative numbers as positive; standalone clones and NuGet users get sign-flipped coordinates and directions
status: open
depends_on: []
owner:
fence: [deps/ara3d-sdk/Directory.Build.props, deps/bim-open-data/Directory.Build.props, deps/bim-open-flow/Directory.Build.props, deps/ara3d-dataflow/Directory.Build.props, deps.json]
workflow: [W3]
related: [TKT-302]
confidence: medium
created: 2026-10-17
kind: defect
---

## Acceptance criteria

- [ ] a released Ara3D SDK package version contains ara3d-sdk bbf28de (the '-' number case) and f48f62b (complex instances, TKT-302)
- [ ] bim-open-data, bim-open-flow and ara3d-dataflow set Ara3DSdkVersion to it, and their tests pass
- [ ] a test in bim-open-data reads IFCDIRECTION((0.,0.,-1.)) from duplex.ifc (#10) as (0, 0, -1)

Found 2026-10-17 during TKT-302. Evidence: a console program referencing the NuGet package Ara3D.IO.StepParser 1.6.1 (tag v1.6.1, b103235, 2026-07-03) reads duplex.ifc #10=IFCDIRECTION((0.,0.,-1.)) as tokens '0.' '0.' '1.' and AsNumber() returns 1; the ara3d-sdk source at HEAD returns -1 because bbf28de added a '-' case to StepTokenizer.ParseToken after the tag. On four IFC files the two versions differ only in minus signs. bim-open-data (Ara3D.Ifc.Mesher, Ara3D.Ifc.Entities, Ara3D.IfcLoader; obj/project.assets.json resolves 1.6.1), bim-open-flow and ara3d-dataflow all pin Ara3DSdkVersion 1.6.1, and MeshHelpers.ReadNumberByIndex uses token.AsNumber(). Not yet run: the IFC mesher on a model with negative directions under 1.6.1, to see the effect on its output; a 1.6.2-local package exists in the NuGet cache, so a local build may have hidden it. Publishing to nuget.org is the owner's step.

Correction, 2026-10-17 (same session): inside the toolkit the IFC tools are not affected. bim-open-data's Directory.Build.targets rewrites every SDK PackageReference into a ProjectReference to deps/ara3d-sdk when that folder exists, so toolkit builds compile the parser from source, which has had the '-' case since bbf28de; the "1.6.1" in obj/project.assets.json was the project's version label, not the package. NegativeNumberTests in Ara3D.Ifc.Tests passes in the toolkit checkout. Affected: standalone clones of bim-open-data, bim-open-flow and ara3d-dataflow without deps/ara3d-sdk, and anyone consuming the 1.6.1 packages from nuget.org. Confidence lowered to medium on impact; the fix is the 1.6.2 release.
