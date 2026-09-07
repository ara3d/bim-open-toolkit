# Snowdon frame performance investigation

September 7, 2026. F03 rendering / F27 measurement follow-up. This is local performance evidence, not release qualification.

Run `npm run demo` in `viewer`, then `node packages/visualization/scripts/snowdon-frame-benchmark.mjs`. The benchmark uses the existing local-only Snowdon endpoint; it never copies the model into the repository. It verifies the response bytes against the metadata hash. Raw samples are written to ignored `packages/visualization/artifacts/frame-benchmark/`. `BENCHMARK_NAME` selects the report filename; command arguments select variants. Do not run other GPU experiments at the same time.

The workload is the full normalized model, a fixed 1000 × 700 drawing buffer at DPR 1, standard lighting, antialiasing, and a reproducible 45-degree orbit around the model bounds. Each variant has five warm-up frames and 40 samples. It records CPU mirror synchronization, BatchedMesh preparation, total CPU submission, RAF intervals, submitted triangles and renderer calls. RAF intervals are scheduling observations, not proof of display completion; GPU execution time is not measured. Headless Edge uses hardware acceleration without software-renderer flags.

## Initial isolation

Source SHA256: `fc31c4463d9eb958ae8de3d853cfc8224b9469477b419857fbc929956c9cc51d`; 9,362,255 bytes. Normalized: 158,055 groups, 456,598 instances, 6,185,680 triangles. Local device: Intel Core Ultra 7 155H, Intel Arc through ANGLE D3D11, approximately 64 GiB RAM, Windows 10.0.26200, Edge 152.0.4191.66. WEBGL_multi_draw is available.

The original renderer creates 15 BatchedMesh objects, six of which contain fractional alpha and therefore use transparent sorting. Those 15 reported renderer calls contain hundreds of thousands of draw ranges. They are not equivalent to 15 ordinary mesh draws. Of the source instances, 390,066 have at most 24 vertices; 450,937 have at most 100 vertices. Only 88 groups contain at least 128 instances.

Initial measurements show roughly 350–420 ms median RAF intervals. Opaque sorting removal substantially reduces CPU preparation without a corresponding frame-rate improvement. Halving both drawing-buffer dimensions and replacing standard lighting with an unlit override also leaves intervals near this range. Bypassing mirror synchronization does not remove the main bottleneck. These experiments implicate the number of tiny draw ranges, with CPU sorting and synchronization as additional costs. They do not establish exact GPU execution time.

The initial exploratory run was interrupted by development-server hot reload after six variants. Its console observations motivated a repeated run with incremental report persistence. Keep benchmark code and build inputs stable during a run.
