---
id: TKT-226
title: BIM Open Bench: a page that opens one model in five viewers at once (BIM Open Viewer, IFClite, Speckle fork, That Open, xeokit)
status: open
depends_on: []
owner:
fence: [../bim-open-bench/**]
workflow: [W5]
related: [TKT-186, TKT-65, TKT-144]
created: 2026-10-11
---

## Acceptance criteria

- [ ] A corpus of three public models (Duplex, Schependomlaan, one large) fetched, verified, and converted to .bos, .frag, and .xkt by one command, with each conversion's time recorded
- [ ] Five iframe pane pages under tools/<viewer>/, each pinned to an exact version and reporting fetching, parsing, first frame, done, or failed with elapsed time and bytes over postMessage; each loads the three models on its own
- [ ] site/side-by-side.html: BIM Open Viewer on the left half, the other four in a two-by-two grid on the right, one Load button starting all five, a per-pane status line that names the input form and its ahead-of-time conversion time; published on GitHub Pages
- [ ] A failure in one pane (an unsupported model, no WebGPU) is shown in that pane and does not stop the others

The owner's first bench deliverable (2026-10-11): a person sees what loading the same model looks like in every viewer. The plan, the per-viewer input forms, the iframe isolation (three three.js versions, WebGPU, xeokit's own engine), and the open questions are in the bench repository's README under 'The side-by-side page' (ara3d/bim-open-bench, commit 670ab10). The layout favours BIM Open Viewer by design; the status line says so in words. The pane pages become the automated view suite's Playwright adapters afterwards. The Speckle pane builds on the offline fork in bim-open-web-viewer (TKT-186's spike S2 showed it loads from memory with no server); BIM Open Viewer's pane uses @bim-open-viewer/loaders over BOS made by ifc_to_bos. The fence is the bench repository; the toolkit never depends on the bench.
