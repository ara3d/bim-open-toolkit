# Source-backed door review

`adaptDoorSchedule(projection, { modelId, contentFingerprint, availableObjects? })` consumes the relevant fields of the existing `ara3d.building-workflow-projection` version 1 envelope. It has no rendering, fetching or domain calculation dependency. A SHA256 fingerprint mismatch fails before any geometry references are emitted; hash hex case is normalized. Door snapshot identity must agree with the projection snapshot.

Identity follows `Door.Element.ObjectId → Objects.SourceIdentities → SourceObjects(Table=Entities, Row) → bos:Row`. There must be exactly one source locator in the matching delivery. Ambiguous, missing or unavailable mappings remain inspectable rows with diagnostics and no guessed reference. Providing all model records as `availableObjects` retains geometry-free rows without requiring rendered bindings.

Nominal and clear widths remain separate facts measured in metres. Known values retain assurance and evidence IDs. Missing facts retain NotObserved, NotExported, NotApplicable, Invalid or Conflicting plus explanations. Missing values never become zero and nominal width never substitutes for clear width. Coverage is recomputed from supplied door facts. Evidence records include their IDs, source IDs, method, explanation and versioned external locators as data; unavailable evidence IDs remain visible with diagnostics. The adapter validates only fields it consumes, rather than implementing every BuildingModel schema table.

The `doorsDemo` fetches the host's local-only `/__fixtures/snowdon-workflows.json` endpoint and verifies it against G1.1 `context.model.ref.revision`. It presents sortable/filterable door rows, nominal-width coverage colors, linked selection, evidence details and saved selected references through the public scene persistence API. Exceptions mean unavailable observations, not failed compliance. Errors remain in an alert before any stale-source styling is applied. Reset cancels fetching/restoring and removes subscriptions; no per-frame metadata scans run.

Actual private artifact checked: `artifacts/building-model-workflows/snowdon/projection.json`. Expected source SHA256: `FC31C4463D9EB958AE8DE3D853CFC8224B9469477B419857FBC929956C9CC51D`. Its 142 doors map to exact source rows; nominal widths are 141 known and 1 conflicting, while all 142 clear widths are NotObserved. This file is read only when present by the optional corpus test and is not copied or distributed. The small deterministic test fixture is controlled data.

## Checkpoint

- Contract: G1.1/V1 acknowledged; both required skills applied.
- State: verified. Focused Vitest (`test/building-model.test.ts --maxWorkers=1 --cache=false`) passed 13 tests including the actual private 142-door projection (not skipped). Isolated strict source/demo TypeScript check passed (`--noEmit`, ES2022/bundler, strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes).
- Owned: `src/building-model.ts`, `test/building-model.test.ts`, `examples/features/doors.ts`, this document.
- Processes: none.
- Outstanding: focused/corpus verification, coordinated commit, supervisor browser check.
