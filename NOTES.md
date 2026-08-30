# Notes — findings that must feed back into the design

Agents: append findings here (contract friction, surprises, perf numbers).

## Contract changes
(record any edits to supervisor-owned files here)

## Findings

### Track C (tiers 3-4)
- BLOCKER: tests/Ara3D.BimOpenSchema.Tests references `..\..\src\Ara3D.IO.SharpGLTF\Ara3D.IO.SharpGLTF.csproj` (used by GltfMaterialFactory.cs / GltfDemo.cs). Ara3D.IO.SharpGLTF is not in any track's fence and is missing from src/ — build fails with CS0246 until it is copied (source: ara3d-sdk/src/Ara3D.IO.SharpGLTF).
- data/get-test-data.ps1 clobbers data/README.md: `Copy-Item IFC-Test-Kit\* data\` overwrites the repo's data/README.md with the test kit's README. Restored via git checkout; script should exclude README.md.
- get-test-data.ps1 fetches only the IFC Test Kit. Harmonizer/Mcp/BimOpenSchema tests additionally need (from ara3d-sdk/data): AC20-FZK-Haus.ifc, AC20-Institute-Var-2.ifc, model_0.ifc, schependomlaan.ifc, rac_basic_sample_project-2025.bos. Copied locally (gitignored) to verify; script should be extended.
- Ara3D.Ifc.Editing shipped IfcStepText.cs and IfcGuid.cs in addition to the six promoted files; deleted the test-side copies/links to avoid CS0436 duplicates.
