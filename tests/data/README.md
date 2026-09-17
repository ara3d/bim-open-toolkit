# tests/data

NUnit projects for `src/data`, one per library where there is coverage, plus
two harnesses: `Ara3D.DoorClearance.Tests` (a rules-based compliance check
over IFC) and `Ara3D.IfcMeshingComparison` (the pure C# mesher against web-ifc,
not part of the default gate).

Fixtures resolve from the repository `data/` folder (populate it with
`data/get-test-data.ps1`); tests that need a file they cannot find are skipped
or marked inconclusive rather than failed.
