# Independent feature viewers

Four G1 feature modules mount in the coordinator's Snowdon harness, each with its own viewer and state. They import public visualization APIs, declare their source and focused test references, and return cleanup callbacks. The harness owns picking, scene lifetime, control-button removal and route teardown.

- `selectionDemo`: linked table capped at 100 rows, full match/selection counts, name/ID filtering, Ctrl/Cmd toggle and isolate selection. Filtering affects the table only.
- `appearanceDemo`: synthetic object-index categories and numeric colors, plus ghost opacity. Labels explicitly distinguish these values from BIM metadata.
- `editsDemo`: hide/move selected objects, transaction undo/redo and reset. Moving adds one scene coordinate on X; it makes no claim about physical units.
- `persistenceDemo`: editable schema-v1 JSON holding camera and selection, restored with the current loaded model as a host resolver. Its session reference is not an authoritative source revision. This example does not reopen models or save to browser storage; copy the JSON to retain it. Unsupported projection, edit layers and style rules are rejected in this narrow UI. Saved JSON survives the current-view reset.

The selection, edit and persistence modules unsubscribe when unmounted. Persistence cancels pending restore before teardown. Selection, appearance and edit reset delegate to harness remount; persistence's current-view reset clears selection and fits the camera while retaining its JSON. Appearance removes its owned legend on cleanup. The supervisor owns browser verification and integration; these modules do not add renderer behavior.

## Checkpoint

- Contract: G1 and V1 acknowledged; both required skills reread.
- State: verified by isolated strict TypeScript check of the four feature modules (`tsc --noEmit`, ES2022/bundler, strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, skipLibCheck). Browser behavior awaits supervisor verification.
- Owned files: the four feature modules above and this document.
- Processes: none.
- Outstanding: coordinated commit and integrated browser verification.
- Blockers: none.
