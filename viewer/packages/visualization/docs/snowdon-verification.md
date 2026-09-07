# Actual Snowdon normalization gate

This read-only integration gate tests the complete BOS normalization path with the private Snowdon architectural fixture. It never copies the model into the repository. The SHA-256 is pinned to `fc31c4463d9eb958ae8de3d853cfc8224b9469477b419857fbc929956c9cc51d`; a changed fixture fails explicitly rather than silently updating expected geometry.

After the coordinator builds the loader/core/visualization packages against stable sources, run one of these alternatives from the visualization package:

```powershell
node scripts/check-normalized-snowdon.mjs 'C:/Users/cdigg/Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos'
```

```powershell
$env:BIM_SNOWDON_FIXTURE = 'C:/Users/cdigg/Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos'
../../node_modules/.bin/vitest.cmd run test/snowdon.integration.test.ts --maxWorkers=1 --cache=false
Remove-Item Env:BIM_SNOWDON_FIXTURE
```

The ordinary test suite skips this test when the environment variable is absent. Do not run both alternatives just to duplicate the same large parse. The script dynamically imports the built normalization API and prints a JSON report; tests run no fixture discovery or download.

Assertions cover actual model revision and every source LocalId mapping, 51,139 unique logical identities, 456,598 complete representation bindings, 158,055 groups and 6,185,680 instanced triangles. They verify geometry positions/normals/indices, transforms/colors, normalized alpha, source-up-converted bounds and geometry-free identities. Names are not treated as identity. Each representation must have one binding, an existing logical reference, and a local transform matching its submitted Float32 matrix.

The gate first reads only expected IDs from a baseline parse, tests real malformed ZIP/HTML bytes, and executes an actual full-fixture load with a timer queued during conversion. It requires normalization to yield and observe cancellation before publishing any value or completed progress. A subsequent load must normalize successfully. The report distinguishes cancelled-load time, complete normalized-load time and total verification time. These are CPU checks, not display latency, GPU memory or frame-rate measurements.

## Track checkpoint

- State: verified; script syntax check passes, opt-in test confirms default skip (one skipped test, no fixture parse).
- Owned paths: `scripts/check-normalized-snowdon.mjs`, `test/snowdon.integration.test.ts`, this document. Loader/core sources and package build outputs are coordinator-owned.
- Actual script gate passed September 7, 2026, against the coordinator's successful stable workspace build: 51,139 objects, 28,976 objects without normalized bindings, 456,598 bindings, 158,055 groups, 6,185,680 triangles. Objects without bindings include geometry-free rows and source-hidden representations skipped by the existing converter; this is not a count of source entities that never had geometry.
- Every source ID, finite geometry/index, local/submitted transform, color factor, revision and bound assertion passed. Actual queued cancellation returned no partial value or completed progress.
- Measured on Windows 10.0.26200 / Intel Core Ultra 7 155H / Node 22.13.1: aborted load 5,519.91 ms, complete normalized load 8,515.38 ms, full verification 20,942.28 ms. Other development work was concurrent; these are one-sample CPU timings, not an isolated performance benchmark.
- Normalized bounds min `[-244.280197, -58.666599, -195.444504]`, max `[240.934296, 85.069901, 274.774181]`.
- No running processes, builds, installs, downloads, generated output or private-fixture writes. The heavy test was not redundantly rerun after the successful standalone script. A later report-field rename from geometryFreeObjects to objectsWithoutBindings changes only the label; assertions and measured inputs are unchanged. Commit turn requested; hash reported after commit.
