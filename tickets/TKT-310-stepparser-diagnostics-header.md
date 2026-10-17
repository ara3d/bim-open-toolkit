---
id: TKT-310
title: Ara3D.IO.StepParser reports a malformed or truncated file as a diagnostic with its byte position and keeps the parsed prefix, and StepHeader keeps every header field
status: open
depends_on: []
owner:
fence: [deps/ara3d-sdk/src/Ara3D.IO.StepParser/**, deps/ara3d-sdk/tests/Ara3D.SDK.Tests/**, deps.json]
workflow: [W3, W4]
related: [TKT-302, TKT-299, TKT-305]
confidence: medium
created: 2026-10-17
---

## Acceptance criteria

- [ ] a file cut mid-definition (sandbox/step-brep-mesh/adapter/fixtures/unit-cube-truncated.stp) opens: StepDocument holds every complete definition before the cut and one error naming the byte offset; no exception
- [ ] StepHeader keeps all FILE_DESCRIPTION, FILE_NAME and FILE_SCHEMA fields as written, including originating_system and preprocessor_version, and the schema name unchanged
- [ ] IFC loading is unchanged: Ara3D.Ifc.Tests passes in the toolkit

Asked for 2026-10-17 by the Plato STEP library session (TKT-299) in its adapter spec, sandbox/step-brep-mesh/adapter/ADAPTER-SPEC.md (bim-open-toolkit b93f6da0): ParsedFile.Ok=false with the parsed prefix lets a defective file still mesh its good faces, and exporter-specific repairs key on originating_system and preprocessor_version, which StepHeader.Parse drops today. The C# STEP mesher (TKT-305) wants the same: diagnostics, never exceptions. The spec accepts, as a first step, an adapter that catches the exception and reports a single error with an empty prefix.
