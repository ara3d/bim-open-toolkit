# Bulk update measurement

For measured Snowdon navigation costs, packed rendering, memory tradeoffs and the repeatable browser experiment, see [Snowdon frame performance](snowdon-performance.md). This September 7 follow-up includes hardware-accelerated measurements; the original track checkpoint below is retained as historical evidence.

`measureOperation(operation, options)` runs the requested warmups and samples serially, awaiting each operation's completion. It returns measured milliseconds in original order and nearest-rank p50/p95, with caller-supplied name and workload counts. A supplied monotonic clock makes pure tests deterministic. Invalid options/clocks and cancellation throw `MeasurementError`; operation/progress errors propagate unchanged. Cancellation returns promptly for pending operations, but the host must honor the signal to stop its own resources. The utility does not infer GPU or display completion.

`performanceDemo` scans source bindings once for up to 10,000 distinct represented objects, then patches only their records. The complete loaded scene remains present (Snowdon: expected 6,185,680 source triangles; actual scene counts displayed). Color, visibility and transform actions alternate values so measured work is not an unchanged update. Each action uses 5 warmups and 20 samples and disables its controls while running; cancel remains available. A failed/cancelled/completed run restores original affected records when the viewer remains mounted. Route reset/disposal belongs to the harness.

Two timings are displayed separately:

- CPU patch submission: validation and CPU writes inside `RenderBinding.update`, excluding patch construction and rendering.
- Command to next animation frame: patch construction, CPU submission, explicit `viewer.renderFrame()` and the following animation-frame callback. This is a scheduling observation, **not proof of GPU execution or display presentation**.

Viewport, drawing-buffer resolution, device DPR, user agent and actual scene workload accompany results. GPU/CPU model, RAM, driver and GPU/presentation timing are explicitly uncollected. The demo does not certify the product's display-latency or FPS targets, and no benchmark result is claimed before a browser run. The screenshot/overlay and other feature modules remain independent.

## Checkpoint

- Contract: G1/V1 and wave4 fence acknowledged; required skills applied.
- State: verified by 10 deterministic focused tests (`test/benchmarks.test.ts --maxWorkers=1 --cache=false`) and isolated strict TypeScript check of source/demo (`--noEmit`, ES2022/bundler, strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes). No browser measurements performed by this track.
- Owned: `src/benchmarks.ts`, `test/benchmarks.test.ts`, `examples/features/performance.ts`, this document.
- Processes: none.
- Outstanding: focused checks, coordinated commit, supervisor browser workload verification.
