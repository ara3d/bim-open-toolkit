# BIM Flow startup profile — 2026-09-08

The earlier BFAST comparison stopped at the pane's loaded status. It did not
include the expensive first render. Use `node scripts/profile-bim-flow-startup.mjs`
for the complete CPU path through the first model render submission. The script
opens a fresh page, blocks graph mutations, records User Timing spans, samples
CPU stacks, and reports the actual graphics backend. Add `?profileStartup=1` to
the graph URL to expose the same spans in DevTools. Profiling is opt-in.

## Measured breakdown

Local Vite server, fresh Edge pages, 1440×1000. WebGL reports Intel Arc through
ANGLE/D3D11; enabling the SwiftShader flag does not force software rendering.
The host and OS file caches were warm. CPU profiling itself adds overhead, and
these small samples are not release qualification or GPU presentation timings.

| Phase | Before this pass | After this pass |
|---|---:|---:|
| Page/modules, graph startup, model resolution | 987 ms | 725 ms |
| Model fetch, verification, transfer and byte assembly | 993 ms | 528 ms |
| BFAST parse | 97 ms | 112 ms |
| BIM metadata | 232 ms | 233 ms |
| Normalized model conversion | 59 ms | 74 ms |
| Visibility preparation and scene binding | 730 ms | 1,047 ms |
| Fit, source colors, recipe setup, legacy adapter, styling and scheduling | 589 ms | 527 ms |
| First model render submission | 2,149 ms | 1,966 ms |
| **Navigation to first model frame submitted** | **5,836 ms** | **5,212 ms** |

Another complete after-profile was 5,304 ms. Binding became slower in these
runs; the samples do not establish a fivefold startup improvement. The phases
are chronological wall-clock spans, not all exclusive CPU costs. First render
includes scene mirror construction, normals, buffer allocation, shader setup,
GPU uploads and drawing submission. It does not wait for monitor presentation.

The next frame submission changed from 174 ms before to 4–9 ms after in the
recorded profiles. This is a useful opaque-rendering improvement, not a
steady-state FPS benchmark or a promise about whole-model ghosting.

## Implemented changes

- Removed the V2 opacity-0.999 workaround. Core already handles instance alpha;
  the workaround forced opaque batches into transparency sorting and disabled
  their packed drawing path. Transparency transitions also invalidate the
  material program. Ghosting remains supported.
- Share computed normals between packed and instanced mirrors instead of
  computing them twice.
- Cache geometric group bounds by transform/count versions. Appearance changes
  reuse them; moved/replaced groups invalidate them. Avoid the extra initial fit
  before the BIM adapter sets its coordinate convention.
- Cache host model content hashes by path, size, modification and creation time.
  A normal same-size edit refreshes the hash. Concurrent cache misses are
  serialized. Directory discovery still runs, so additions/removals stay visible.
  Deliberately changing bytes while preserving all file metadata requires a host
  restart to invalidate this cache. The prepared-model endpoint still verifies
  the selected source bytes independently on every request.

The catalog previously hashed every model on every scan, including the scan
performed while serving model bytes. After restarting the same host with only
its catalog DLL updated, the first catalog request took 549 ms; subsequent
requests took 12 and 7 ms. Browser profiles measured 17 ms versus the earlier
489 ms. Existing store/cache/model arguments were retained; the original DLL is
backed up under `artifacts/bim-flow/host-palettes/`.

## Remaining opportunities

The current demo loads the full 111.6 MB prepared file and creates the full-detail
scene before displaying it. There is no startup LOD. A fivefold reduction from
5.8 seconds means about 1.2 seconds; the first full scene submission alone still
exceeds that budget. More concurrent HTTP requests will not remove that cost.

The next substantial changes should separate preparation from presentation:

1. Prepare normals and rendering batch data ahead of time, and lazily construct
   the alternate transparency/picking representation. Both representations are
   currently built before the first frame even when one is unused.
2. Prepare a small LOD or coarse geometric preview alongside the full BFAST.
   Fetch and display it first, then refine in the background. Preserve source
   object IDs, selection, camera and active graph recipe across replacement, and
   clearly distinguish coarse preview readiness from full-detail readiness.
   Decimating after downloading the full model would not fix the initial delay.
3. Move independent metadata decoding and geometry/normal preparation to workers
   using transferable typed arrays. Graph/module work can overlap model I/O;
   main-thread scene construction and WebGL uploads remain dependencies unless
   the rendering architecture changes. Worker startup and transfer cost need
   measurement before claiming a benefit.

These are identified opportunities, not implemented LOD or worker support.

## Verification

- Core focused rendering tests: 22 passed; core build passed.
- Render/viewer integration tests: 47 passed.
- Catalog scan tests: 9 passed, including cached reads under an exclusive file
  lock and same-length content changes.
- Pane TypeScript check passed.
- Fresh Snowdon browser profiles have no page errors and draw the actual model.
- `node scripts/check-bim-flow-render-restore.mjs` checks ghost, clipping and
  exploded branches with API writes blocked. Opaque restoration permits fewer
  than 0.1% pixels differing by more than 8/255 per color channel, matching the
  need to tolerate a few coplanar depth ties across rendering paths. Exact PNG
  equality failed: 12 of 489,936 pixels differ on the captured ghost round trip.
  This is documented rather than presented as exact pixel restoration.

No private model bytes are committed. Existing unrelated DuckDB edits remain
outside these changes. This work addresses F02/F03/F04/F08/F27 locally and does
not close the original performance or release acceptance gates.
