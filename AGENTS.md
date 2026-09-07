# Repository guidance

## Visualization planning

For visualization work, read `viewer/packages/visualization/docs/PLAN.md` and `STATUS.md`, then the relevant original feature sections in `docs/plans/visualization/PRODUCT-BRIEF.md`. Read applicable owned checkpoints before resuming implementation, including after context compaction.

- Preserve the original product brief and `docs/plans/visualization/history/` snapshots. They are requirements and historical evidence, not rolling summaries.
- Keep original feature IDs, priorities, rationale, dependencies, acceptance criteria and unresolved requirements accessible from the durable plan. Put rolling progress, assignments and measurements in status/checkpoint/evidence documents.
- Updating a plan must not replace its original context with the latest wave or compress away requirements. Record changed scope or deferral in a dated decision with the previous requirement, new choice, rationale and user basis. A deferred requirement remains visible and is not complete.
- Before committing plan edits, inspect deleted text and verify source links. Archive any materially superseded plan before replacement. Do not rely on chat history as the only copy of decisions.
- Run `node docs/plans/visualization/check-baselines.mjs` after visualization planning edits. It checks immutable source/history bytes and the original feature-priority index; review acceptance/rationale changes separately because the script cannot judge meaning.
- Distinguish feature implementation, local verification, combined verification and release qualification. Use the original feature acceptance cases when deciding completion.
- During authorized parallel work, keep bounded ready tasks tied to unmet acceptance criteria and promptly reuse available workers. Respect actual concurrency limits, stable test inputs and exclusive file/resource owners. Do not invent work just to occupy slots.
- Snowdon is the primary integration fixture. Verify actual model bytes and rendered behavior early; make loading/runtime failures visible. Keep each feature demo small, with focused tests and cleanup.

The repository-root `PLAN.md` is the separate initial population plan. Do not overwrite it with visualization progress.
