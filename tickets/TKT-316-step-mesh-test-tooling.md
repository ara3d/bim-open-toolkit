---
id: TKT-316
title: Test tooling for the STEP B-rep mesh library: generators, diffs that name the first difference, and visual dumps
status: open
depends_on: [TKT-299]
owner:
fence: [sandbox/step-brep-mesh/09-tooling/**, sandbox/step-brep-mesh/TASKS.md]
workflow: [W3, W4]
confidence: high
created: 2026-10-17
---

## Acceptance criteria

- [ ] generators: every Witness_* family of layer 7 has a parameter-space generator (ranges, seeds, deterministic), plus perturbation generators (rigid motion, power-of-two scale, vertex jitter within tolerance, face reversal, edge reversal) and a corpus loader that reads RawDecodedModel values produced by the C# decoder (TKT-312) once it exists
- [ ] diffs: ModelDiff, DiscretizationDiff, MeshDiff and ReportDiff name the first difference (which table, which index, which field, both values, the tolerance used) instead of a Boolean; the existing IsSameModel, SameDiscretization, SameFaceMesh, SameConnectivity and IsSameFile are restated as 'the diff is empty' so there is one definition
- [ ] visual dumps, through existing tools, no new viewer: a mesh or a face mesh writes glTF/OBJ for the toolkit's 3D pane (deps/bim-open-viewer) with per-face colour and provenance in vertex attributes; a UV region, its loops, seams, poles and triangulation write an SVG; a Report writes a table the notebook can show; one command dumps every stage of MeshModel for one witness so a failing law can be looked at
- [ ] the tooling is its own layer folder 09-tooling with a README, gate-clean, and no lower layer references it; TASKS.md names which chunk first uses each tool

Owner concern 2026-10-17: starting with only small, trivial data is risky; tools to generate test data, compare results, and see what is happening are needed when debugging operations, provided building them does not slow the main line. So: a parallel track, reusing the toolkit's viewer and the stdlib's mesh exports rather than building a viewer; each tool is a Plato function with a small host shim where a file must be written. Design signatures first (an afternoon), then bodies as chunks A and B need them.
