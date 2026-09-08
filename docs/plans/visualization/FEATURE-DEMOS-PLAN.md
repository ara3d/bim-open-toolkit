# Feature demos wave

Date: 2026-09-08. Status: S3 verified; shared host landed; S4, FD1, FD2, FD3 running. Part of [V2-PLAN.md](V2-PLAN.md); rolling status in [V2-STATUS.md](V2-STATUS.md). A second session runs this wave beside the wave 2 supervisor ("V2 visualization plan prep"); the two coordinate through `.claude/wave.json`, the checkpoints, and session messages.

User basis (2026-09-08): add these features with tests and demos: show by level, room and category; separate the levels and the rooms side by side, and remove the ceilings and roofs (or cut away) to see inside; HUD examples: a 2D minimap, a 3D gumball, and FPS with CPU and GPU timing.

## 1. What already covers the request

Wave 2 (started 2026-09-08 by the other session) builds the feature side of all of it: V `createViewer`; FA `sets` and `appearance` (show by level, room and category is a derived-set question); FB `layouts` (separate levels and rooms), `clipping` (cutaway), `navigation-aids` (gumball and possibly minimap) and `hud` (frame timing). Its D track (the gallery) owns `demos/**` minus the slice and the server and is queued until V publishes `createViewer`.

Decision: this wave launches no track that overlaps those fences. Duplicating a feature that another agent is writing this hour is the waste the review named. What is unclaimed and needed:

| Gap | Track | Fence |
|---|---|---|
| The building has no roof and no ceilings, so "remove the ceilings and roofs" has nothing to remove | S3 | `viewer/packages/synthetic/**` |
| Demos of exactly the three requests, each a page with a browser test, built on `createViewer` and the FA and FB features | FD1, FD2, FD3 | `viewer/packages/demos/{src,test}/feature-demos/<id>/**`, `demos/feature-demos/<id>.html`, `demos/docs/CHECKPOINT-FD<n>.md` |
| The page frame the three demos share, the Vite config and the browser test helper | supervisor (`FD-shared` in the manifest) | `demos/src/feature-demos/_shared/**`, `demos/test/feature-demos/_shared/**`, `demos/vite.feature-demos.config.mjs`, `demos/docs/feature-demos.md` |

Anything a demo needs that a feature does not give is requested back to FA, FB or V through the checkpoint and a session message, with a local shim in the demo until it lands (GALLERY-PLAN rule "improve what you touch"). The gallery track may absorb these pages later; the ids and questions are chosen so they slot into its "Inspect" and "Cut and arrange" chapters.

## 2. The demos

| Id | Question | Fixture | Controls | Features used | Test |
|---|---|---|---|---|---|
| `show-by` | Show me only level 2, only this room, only the doors | building with roof and ceilings | three pickers (storey, room, category) and a mode (isolate, ghost, hide); a reset | FA sets and appearance; V pick for click-to-read | fake-session test of the derived sets and the dispatched commands; browser smoke reporting visible counts per mode |
| `separate` | Pull the levels apart, put them side by side, lift the lid | same | layout kind (stacked, spaced, side by side, rooms of one storey side by side), spacing slider, "ceilings and roof off", cutaway height | FB layouts and clipping; FA sets for the category hide | offsets and clip planes from a known state; browser smoke reporting the layout bounds |
| `hud-fps` | Is it keeping up, and where does the time go | stress fixture, building as the small case | a HUD panel with CPU frame median and p95, FPS, GPU reading or the reason there is none, scene counts; a "recolour everything" button to load it | FB hud, render timing, V's frame hook and GPU timer | percentiles from a fake clock; browser smoke reporting frames measured and the GPU state |
| `hud-minimap` | Where am I in the plan | building | a 2D top-down minimap in a corner: footprints per storey, the camera and its view cone; click to move | FB navigation-aids if it has one, else a pure drawing in the demo requested back to FB | footprint and cone geometry from a known view; browser smoke |
| `hud-gumball` | Turn me to the front, snap to the top | building | a 3D orientation widget (axis triad or cube) in a corner that follows the camera; click a face to look from it | FB navigation-aids, V look-from or fly-to | face-to-direction mapping and projection from a known view; browser smoke |

Every page: the viewport fills the page, DOM controls in a strip, a status line, `window.demo` for the browser test (`_shared/protocol.ts`), synthetic data stated as such. No Gratify: the HUD panels are Canvas2D overlays whose drawing is a pure function returning primitives, so the tests never touch a canvas.

## 3. Ready conditions and order

- S3: now.
- FD1: V exports `createViewer` and FA has committed its sets chunk (its checkpoint names the commit).
- FD2: FD1's ready condition plus FB's layouts and clipping chunks committed.
- FD3: V exports `createViewer` and its frame hook or GPU timer; FB's hud chunk committed.
- Revised 2026-09-08: V's `createViewer` is its chunk 3 and had not started when FA and FB were verified, so the supervisor wrote a thin host in `_shared/host.ts` over V's committed `createSession` and `featureHost`, and the FD tracks launched on it (`demos/docs/feature-demos.md`). The host is replaced by `createViewer` when it lands; its GPU timer is offered to V.
- S4 (room volumes, `viewer/packages/synthetic/**`) runs beside the FD tracks because a `Room` object is geometry-free and "show by room" would otherwise show only doors.

The gallery wave (third session, GALLERY-PLAN.md: UG, GAL, D1 to D4, ports 5190 to 5194) imports `_shared/protocol.ts` read-only so every browser smoke shares one page protocol; its exported names (`DemoReport`, `DemoWindow`, `demoReadyExpression`, `demoReportExpression`) are therefore a contract and any rename is announced here first. The FD pages may later register with the gallery through `demos/src/gallery/contracts.ts`: GAL discovers `demos/src/demos/<id>/index.ts` exporting `demo` by glob, so registration is one small index per page in that directory, added to this wave's fence by the gallery session on request before any is created. Follow-up after FD1 to FD3 land, not part of their briefs.

Ports: FD1 5181, FD2 5182, FD3 5183 (5176 slice, 5177 ambient occlusion, 5175 fixture server, 5173 alpha, 5174 MCP are taken). One browser process per track. Screenshots go to `viewer/artifacts/feature-demos/`.

## 4. Gates and rules

Per chunk, from `viewer/`: `npx tsc --noEmit -p packages/<name>/tsconfig.json`, `npx eslint packages/<name>`, `npm test -w @bim-open-toolkit/<name>`. Browser tests skip with a printed reason when no browser launches. Commit by pathspec, message from a file, never amend, never push (the supervisor pushes after integration). Checkpoints under 80 lines with a "Tooling" section. Zero escape hatches. Read-only: model, render, interact, formats, features, viewer, testing, alpha packages, `submodules/gratify`.

## 5. Acceptance

1. `buildingWithRoof` (or the option S3 chooses) produces `Roof` and `Ceiling` objects and the default building is unchanged.
2. Each of the five pages opens on its port, draws its fixture, and its browser test passes on this machine with a screenshot recorded.
3. `show-by` isolates, ghosts and hides by storey, room and category with the counts reported; `separate` shows the storeys spaced, in a row, and the rooms of one storey in a row, with the roof and ceilings hidden and a cutaway plane; the three HUD pages draw their panel and report their numbers.
4. Requests to V, FA and FB are recorded in the checkpoints with what was shimmed locally.
5. Combined gate green at integration; alpha suites unchanged.
