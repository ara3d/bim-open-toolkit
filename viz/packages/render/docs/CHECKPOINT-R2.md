# Track R2 checkpoint — meshes in whichever form a geometry carries

State **verified**, contract M1 with the **M1.2 additions**, unedited. Fence `render/**` less its config files, plus `testing/src/headless/**` and `test/headless/**`. Sub-agents 0, escape hatches added 0, blockers none, remaining work none.
Answers F2's one request: BFAST fills `Geometry.meshTable` and leaves `meshes` empty, so the three readers in `instance-table.ts` and the four in the headless scene bound zero meshes for the default format.

| # | Chunk | Commit |
|---|---|---|
| 1 | `render/src/geometry-meshes.ts`, the only mesh reader; 7 tests, 236 to 243 | `7615d30` |
| 2 | `testing/src/headless/scene.ts` on model's `meshAt`/`meshCount`; 3 tests, 133 to 136 | `b059d36` |
| 3 | This file, one line in `docs/render.md` | this commit |

## Delivered
- `geometryMeshCount`, `geometryMeshAt`, `geometryMeshTriangles`: table preferred when both forms are present, records the fallback, neither form binds zero meshes rather than throwing. `instance-table.ts` reads meshes through nothing else; the headless scene does the same through model's own helpers, with no cross-package import, resolving its count once before the two per-row loops.
- Tests: the standard render scene and the two-box headless scene, converted with `meshTableFrom` and their `meshes` cleared, give identical groups, group and mesh buffers, bounds, rendered triangles, row mappings and `resolveHit` results; neither form, and an empty table, bind nothing without throwing.
- Allocation: `meshAt` builds one object and up to three views per call, no vertex copied. Every call site runs **once per group**, never per instance. `renderedTriangles` may run per frame over every group, so it reads the table's `indexCount` and builds no `Mesh` at all.

## Tooling
From `viewer/`, all six exit 0, run with other tracks compiling; the two render times are inflated by that load.

| Check | Runs | Wall | Real defects | Friction | Verdict |
|---|---:|---:|---|---|---|
| `tsc -p packages/render` | 3 | 35 s | 1, real: `MeshBuffers.indices` is optional, so a test's spread of it was unsound | none | helpful |
| `eslint packages/render` | 2 | 68 s | 0 | slowest gate by seventeen times, fired nothing | hindrance at this size |
| `npm test -w render` | 3 | 4 s | 0 new; the 7 added tests are the evidence | none | helpful |
| `tsc -p packages/testing` | 2 | 6 s | 0 | none | cheap, keep |
| `eslint packages/testing` | 2 | 9 s | 0 | none | neutral |
| `npm test -w testing` | 2 | 27 s | 0 new | 20 s of it is fixture building | helpful |

## Findings
1. A green downstream type check is no evidence a downstream reader works: `meshes` stayed a well-typed empty array and every gate passed while the default format drew nothing. A track adding an optional second form of an existing field should also write the test that carries only the new form.
2. **To the supervisor**: `testing/src/fixtures/scene-fixture.ts` (its fingerprint hashes `geometry.meshes`) and `testing/src/bindings/synthetic-model.ts` still read records only — outside this fence, correct today since every fixture builds records, wrong the day one is loaded from BFAST.
