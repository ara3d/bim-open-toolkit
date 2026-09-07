# Integration review and targeted performance checkpoint

Read-only review of gallery host, loading, persistence, annotations, capture, formats, performance and source rendering found the following concrete follow-ups. No browser session or port was used by this track. Shared demo sources may continue changing; references describe the inspected state.

1. Gallery `mountViewer` registers a `window.pagehide` handler but returned `dispose` does not remove it. Repeated programmatic mount/unmount retains each old viewer closure until navigation. Remove the handler during dispose; anonymous picking handlers should likewise use a disposable listener signal if the canvas is retained.
2. Cancelling during Snowdon fingerprint fetch rejects into the outer catch and labels the operation MODEL LOAD FAILED, overriding the earlier cancellation message. The outer catch should check the aborted/disposed state before calling `fail`.
3. `showError` adds the error class/alert role, but later successful `status` calls never restore status styling. A corrected action can leave the UI red despite a successful outcome.
4. Host picked-name lookup uses only objectId from the baseline model. Asset preview IDs belong to another model; use a model-aware lookup/host registry or avoid baseline name lookup for a different modelId.

Existing deliberate limitations: source preparation/parse remains partly synchronous; replacement owns source state until undone; orthographic uses its own Fit; GPU/display completion is not inferred from RAF. The performance demo correctly labels CPU patch time separately from explicit render-plus-next-RAF timing. No new release-blocking issue was found in its measurement math or cancellation path.

## Targeted performance work

Coordinator supplied the pre-change Snowdon observation: 10,000 distinct color updates, 5 warmups/20 samples, Chrome 152 Windows 64, viewport 980×658 DPR1; CPU patch p50 297.5 ms/p95 434.4 ms; command-to-next-RAF p50 955.4 ms/p95 1095.4 ms. This track did not measure those values and does not claim GPU/display latency.

With an explicit ownership transfer, changed only visualization `src/render.ts`/`test/render.test.ts` and core `src/batch-object.ts`/`test/batch-object.test.ts`: identity logical matrices skip unnecessary representation matrix multiplication; matrix comparisons use indexed loops; group buffer views are cached within a submission; Float32-equivalent colors and already-hidden snapshot colors no longer increment versions; batches obtain transform/color buffer views only when needed. Physical buffers are still compared on every update, so external group changes are repaired rather than hidden by stale cross-call caches.

State: verified by focused tests, source writes stopped. Parallel package-local Vitest (`--maxWorkers=1 --cache=false`) passed visualization render+replacement 13 tests in 1.97 s and core batch 8 tests in 1.12 s on September 7, 2026. Existing tests retain nonidentity composition, identity picking, geometry reuse and disposal coverage; new checks cover unchanged versions, Float32 rounding, external mutation repair and avoiding unused buffer reads. No shared builds or browser measurements run by this track. Coordinator must rebuild core and repeat comparable browser measurements before quantifying improvement. Commit pending.
