---
id: TKT-310
title: Ara3D.IO.StepParser reports a malformed or truncated file as a diagnostic with its byte position and keeps the parsed prefix, and StepHeader keeps every header field
status: done
depends_on: []
owner: session 10b9c9c6
session: 10b9c9c6-0052-40f3-a1c2-c12f2f8861d7
fence: [deps/ara3d-sdk/src/Ara3D.IO.StepParser/**, deps/ara3d-sdk/tests/Ara3D.SDK.Tests/**, deps.json]
workflow: [W3, W4]
related: [TKT-302, TKT-299, TKT-305]
confidence: medium
created: 2026-10-17
claimed: 2026-10-17
closed: 2026-10-17
---

## Acceptance criteria

- [x] a file cut mid-definition (sandbox/step-brep-mesh/adapter/fixtures/unit-cube-truncated.stp) opens: StepDocument holds every complete definition before the cut and one error naming the byte offset; no exception
- [x] StepHeader keeps all FILE_DESCRIPTION, FILE_NAME and FILE_SCHEMA fields as written, including originating_system and preprocessor_version, and the schema name unchanged
- [x] IFC loading is unchanged: Ara3D.Ifc.Tests passes in the toolkit

Asked for 2026-10-17 by the Plato STEP library session (TKT-299) in its adapter spec, sandbox/step-brep-mesh/adapter/ADAPTER-SPEC.md (bim-open-toolkit b93f6da0): ParsedFile.Ok=false with the parsed prefix lets a defective file still mesh its good faces, and exporter-specific repairs key on originating_system and preprocessor_version, which StepHeader.Parse drops today. The C# STEP mesher (TKT-305) wants the same: diagnostics, never exceptions. The spec accepts, as a first step, an adapter that catches the exception and reports a single error with an empty prefix.

## Work log

- 2026-10-17, ara3d-sdk 002784d (pin moved in deps.json). `StepDocument.Diagnostics: IReadOnlyList<StepDiagnostic>`, where `StepDiagnostic(StepSeverity Severity, StepDiagnosticCode Code, long Offset, string Expected, int DefinitionId = 0, long DefinitionOffset = -1)`; codes `NotStepFile`, `HeaderIncomplete` (a Warning: an absent FILE_DESCRIPTION, FILE_NAME or FILE_SCHEMA), `Syntax`. An Error means parsing stopped there and `Definitions` holds what came before. unit-cube-truncated.stp gives #1 to #124 and `Error Syntax at byte 4232 in #125 (starting at byte 4198): expected ')' closing the list`. `StepHeader` adds `Description`, `ImplementationLevel`, `Name`, `TimeStamp`, `Author`, `Organization`, `PreprocessorVersion`, `OriginatingSystem`, `Authorization`, `SchemaIdentifiers`, strings raw between their quotes (`''` and `\X2\` left as written). Tests: ara3d-sdk StepParser and StepHeader tests 17 passed (whole project 30); Ara3D.Ifc.Tests 38 passed, 11 skipped; the 88 u-blox STEP files open with zero diagnostics and the same 5,708,101 definitions as before.
