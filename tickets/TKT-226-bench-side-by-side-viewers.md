---
id: TKT-226
title: BIM Open Bench: a page that opens one model in six viewers at once (BIM Open Viewer, IFClite, Speckle fork, That Open, xeokit, Static glTF Viewer)
status: open
depends_on: []
owner:
fence: [../bim-open-bench/**]
workflow: [W5]
related: [TKT-186, TKT-65, TKT-144]
created: 2026-10-11
---

## Acceptance criteria

- [x] A corpus of three public models (Duplex, Schependomlaan, one large) fetched, verified, and converted to .bos, .frag, .xkt, and .glb (IfcConvert) by one command, with each conversion's time recorded
- [x] Six iframe pane pages under tools/<viewer>/, each pinned to an exact version and reporting fetching, parsing, first frame, done, or failed with elapsed time and bytes over postMessage; each loads the three models on its own
- [ ] site/side-by-side.html: BIM Open Viewer on the left half, the other five in a two-column, three-row grid on the right, one Load button starting all six, a per-pane status line that names the input form and its ahead-of-time conversion time; published on GitHub Pages
- [x] A failure in one pane (an unsupported model, no WebGPU) is shown in that pane and does not stop the others

The owner's first bench deliverable (2026-10-11): a person sees what loading the same model looks like in every viewer. The plan, the per-viewer input forms, the iframe isolation (three three.js versions, WebGPU, xeokit's own engine), and the open questions are in the bench repository's README under 'The side-by-side page' (ara3d/bim-open-bench, commits 670ab10 and bc190c0). The layout favours BIM Open Viewer by design; the status line says so in words. The pane pages become the automated view suite's Playwright adapters afterwards. The Speckle pane builds on the offline fork in bim-open-web-viewer (TKT-186's spike S2 showed it loads from memory with no server); BIM Open Viewer's pane uses @bim-open-viewer/loaders over BOS made by ifc_to_bos. Static glTF Viewer (EverseDevelopment/Static.glTF.Viewer, MIT, three.js 0.160, not on npm, pinned by commit) is the GLB baseline, added at the owner's request on 2026-10-11; it takes its model from ?file= and hides its header with ?kiosk=1. The fence is the bench repository; the toolkit never depends on the bench.

## Notes

- 2026-10-11: corpus (three models, .ifc and .glb forms, IfcConvert 0.9.0 pinned) and the Static glTF Viewer pane are built in ara3d/bim-open-bench up to commit 2e8463a; the Duplex reaches first frame in 0.56 s there. The other forms (.bos, .frag, .xkt) arrive with their panes, so the first criterion stays open. Build log: the bench README.
- 2026-10-12: the five other panes and the side-by-side page are in the bench (commits ab68263 to 4ad5091). Five panes load the Duplex together in the page; the xeokit pane fails with "offset is out of bounds" on its web-ifc path and its builder is still on it. Fourth criterion met (a failed pane stays in its slot). Not done: GitHub Pages (the converted forms have no public home, see the bench README open questions), and the .bos, .frag, .xkt conversion times need a rerun on a quiet machine.
- 2026-10-12, later: all six panes and all twelve converted forms exist; the page shows the Duplex in every viewer (bench tip 46a3900). Criteria 1, 2 and 4 met. Criterion 3 lacks only GitHub Pages. Follow-ups: TKT-284 (viewer paints models grey), TKT-275 (push the Speckle fork), the xeokit SDK defect to report upstream, and clean reruns of the conversion and load times on a quiet machine with a GPU (the bench plan's step 4).
