# Snowdon frame performance investigation

September 7, 2026. F03 rendering / F27 measurement follow-up. This is local performance evidence, not release qualification.

Run `npm run demo` in `viewer`, then `node packages/visualization/scripts/snowdon-frame-benchmark.mjs`. The benchmark uses the existing local-only Snowdon endpoint; it never copies the model into the repository. It verifies the response bytes against the metadata hash. Raw samples are written to ignored `packages/visualization/artifacts/frame-benchmark/`. `BENCHMARK_NAME` selects the report filename; command arguments select variants. Do not run other GPU experiments at the same time.

The workload is the full normalized model, a fixed 1000 × 700 drawing buffer at DPR 1, standard lighting, antialiasing, and a reproducible 45-degree orbit around the model bounds. Each variant has five warm-up frames and 40 samples. It records CPU mirror synchronization, BatchedMesh preparation, total CPU submission, RAF intervals, submitted triangles and renderer calls. RAF intervals are scheduling observations, not proof of display completion; GPU execution time is not measured. Headless Edge uses hardware acceleration without software-renderer flags.

## Initial isolation

Source SHA256: `fc31c4463d9eb958ae8de3d853cfc8224b9469477b419857fbc929956c9cc51d`; 9,362,255 bytes. Normalized: 158,055 groups, 456,598 instances, 6,185,680 triangles. Local device: Intel Core Ultra 7 155H, Intel Arc through ANGLE D3D11, approximately 64 GiB RAM, Windows 10.0.26200, Edge 152.0.4191.66. WEBGL_multi_draw is available.

The original renderer creates 15 BatchedMesh objects, six of which contain fractional alpha and therefore use transparent sorting. Those 15 reported renderer calls contain hundreds of thousands of draw ranges. They are not equivalent to 15 ordinary mesh draws. Of the source instances, 390,066 have at most 24 vertices; 450,937 have at most 100 vertices. Only 88 groups contain at least 128 instances.

Initial measurements show roughly 350–420 ms median RAF intervals. Opaque sorting removal substantially reduces CPU preparation without a corresponding frame-rate improvement. Halving both drawing-buffer dimensions and replacing standard lighting with an unlit override also leaves intervals near this range. Bypassing mirror synchronization does not remove the main bottleneck. These experiments implicate the number of tiny draw ranges, with CPU sorting and synchronization as additional costs. They do not establish exact GPU execution time.

The initial exploratory run was interrupted by development-server hot reload after six variants. Its console observations motivated a repeated run with incremental report persistence. Keep benchmark code and build inputs stable during a run.

## Packed opaque geometry milestone

Pack meshes with at most 100 vertices into opaque draws, bounded at 262,144 expanded vertices per batch. Keep the existing BatchedMesh and logical instance mappings for picking and transparent rendering. Initial translucent groups have separate bins so a small amount of glass does not force a large opaque batch through sorting. Later fractional-alpha updates switch that batch to the existing sorted path without replacing its geometry. CPU-baked vertices use transformed normals and per-vertex RGBA; changed attribute ranges are uploaded on updates. All clipping/material state is shared by the two paths. Source geometry remains borrowed and unchanged.

Local measurements before the synchronization optimization:

| Profile | RAF interval p50 / p95 | CPU submission p50 / p95 |
|---|---:|---:|
| Original, clean confirmation | 316.7 / 471.0 ms | 201.9 / 375.9 ms |
| Packed, verified run | 21.0 / 62.1 ms | 18.9 / 54.9 ms |
| Packed, earlier repeat | 33.3 / 53.3 ms | 29.2 / 50.1 ms |
| Packed without mirror sync, diagnostic only | 8.4 / 25.5 ms | 7.5 / 34.9 ms |

The packed model has 26 material batches, 23 packed meshes, and two transparent batches. It submits 6,177,746 triangles on this orbit versus the original 6,161,044: packed geometry relies on GPU clipping rather than individual CPU frustum tests. This does not remove model detail. Reported renderer calls increase while actual draw-range processing falls substantially.

Memory tradeoff: packed position, normal, RGBA and index arrays total 269,071,352 bytes (about 257 MiB), with corresponding GPU buffers in addition to the retained fallback data. This is not total process/GPU memory. `new Viewer({ packedGeometry: false })` avoids packed allocation for memory-constrained hosts. The fast path does not promise fast whole-model transparency; those batches retain the original sorted cost.

`node packages/visualization/scripts/snowdon-frame-benchmark.mjs sorted --verify` compares offscreen rendered pixels with the native path at the identical camera, after color, hiding, transform and ghosting updates to 10,000 distinct represented objects, plus clipping. It uses a per-channel tolerance of 8/255 and a maximum differing-pixel fraction of 1%. The verified run differed at 89–557 of 700,000 pixels (at most 0.080%). A first comparison caught a missing neutral vertex-color attribute in the fallback; that error was fixed before accepting the optimization. CPU submission plus mirror synchronization for the individual 10,000-object checks was 299 ms color, 380 ms hiding, 853 ms transforms and 152 ms ghosting. These are single correctness-check samples, not p95 update qualification or display latency.

## Scene revision milestone

Group mutation notifications advance the owning scene's revision. A mirror whose revision is current returns immediately, avoiding the membership/version scans over 158,055 groups during camera-only frames. Changed scenes still use the established count/attribute checks; two mirrors independently observe the same changes. Membership removal, scene clearing and viewer disposal release subscriptions. Mutate attributes through the group methods, not by writing into the borrowed buffer views.

Two repeated packed/revision runs measured 12.6 ms median RAF intervals and 16.7 ms p95, corresponding to approximately 79 scheduled frames/second at the median. CPU submission was 5.5–5.7 ms p50 / 6.8–7.0 ms p95. Mirror sync measured 0 ms at browser timer resolution. The diagnostic bypass-sync variant was equivalent (12.9 / 16.8 ms), confirming the idle scan was removed. Pixel comparisons after all six cases still passed with the same 89–557 differing pixels. These are local headless hardware-accelerated results, not a guarantee for every device or a direct measurement of displayed FPS.
