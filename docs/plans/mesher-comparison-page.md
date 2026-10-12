# Four-pane mesher comparison page

Plan started 2026-10-11 for TKT-276. Workflows served: 5 (a claim needs another tool's number beside it) and 3 (a picture of the model). The owner asked for a web page that shows the same IFC file meshed by the four meshers in four panes on the BIM Open Viewer, with the cameras locked together, over several sample files converted to GLB.

## Acceptance criteria

- Four panes, one per mesher (Ara3D.Ifc.Mesher, web-ifc, IFClite, IfcOpenShell), each a BIM Open Viewer over that mesher's GLB of the selected file.
- One camera: orbit, pan, or zoom in any pane and the other three follow, with no feedback loop. A lock toggle releases them.
- A file selector lists every sample in the manifest; the three quick files and duplex.ifc at least.
- Each pane's header shows the mesher, its version, triangle and instance counts, and the mesh time from the manifest.
- The page lives in `deps/bim-open-data/site-src` beside the BOS explorer, builds into `site/` for GitHub Pages, and has a smoke test.

## Where things go

- GLBs and manifest: `deps/bim-open-data/bench/ifc-mesher/glb/<Mesher>/<file>.glb` and `bench/ifc-mesher/glb/manifest.json`, committed. Mesher folder names: `Ara3D.Ifc.Mesher`, `WebIfc` (the DLL build the comparison already runs in process), `IfcLite`, `IfcOpenShell`.
- Writer: `tests/data/Ara3D.IfcMeshingComparison/Harness/GlbExport.cs` turns a `Model3D` into a Y-up GLB through the SDK's `Ara3D.IO.GltfExporter` (`IModel3D.WriteGlb`), applying the Z-up to Y-up rotation to every instance transform first (the viewer's glTF adapter treats glTF as Y-up metres), and `Tests/Comparison/GlbExportTests.cs` writes the set from the committed dumps, the in-process meshers, and any dumps under `artifacts/ifc-mesher/dumps/`.
- Page: `site-src/compare.html`, `site-src/src/compare/*.ts` (small files: manifest loading, one pane, camera link, the page), served by `site-src`'s Vite dev server (port 5280) and built into `site/compare/` (or `site/explorer/compare.html`, whichever the Vite multi-page setup makes simplest; say which in the build log).

## Contract: `manifest.json`

```json
{
  "generatedUtc": "2026-10-11T18:00:00Z",
  "meshers": [
    { "name": "Ara3D.Ifc.Mesher", "version": "bim-open-data <commit>" },
    { "name": "WebIfc", "version": "<dll version or 'in process'>" },
    { "name": "IfcLite", "version": "4.15.0" },
    { "name": "IfcOpenShell", "version": "0.8.5" }
  ],
  "files": [
    {
      "name": "example.ifc",
      "glbs": {
        "Ara3D.Ifc.Mesher": { "path": "Ara3D.Ifc.Mesher/example.glb", "triangles": 12494, "instances": 120, "meshes": 99, "bytes": 123456, "elapsedMs": 78 }
      }
    }
  ]
}
```

`path` is relative to the `glb/` folder. A mesher missing for a file is simply absent from `glbs`, and the page shows "no output" in that pane. `elapsedMs` is the dump header's time for external meshers and a warm in-process stopwatch for the two in-process ones.

## Chunks

| Chunk | Fence (under `deps/bim-open-data/`) | Test | Done |
|---|---|---|---|
| G1 | `tests/data/Ara3D.IfcMeshingComparison/Harness/GlbExport*.cs`, `Tests/Comparison/GlbExportTests.cs`, `bench/ifc-mesher/glb/**`, `artifacts/**` (git-ignored) | `GlbExportTests` | GLBs and manifest committed for the quick files and duplex; a GLB opens in the viewer (G2 confirms) |
| G2 | `site-src/**` | `site-src/scripts/smoke.mjs` extended | four panes draw the manifest's first file; cameras follow one another; selector switches files |
| G3 (supervisor) | `.github/workflows/pages.yml`, `site/index.html` link, `.claude/launch.json` in the toolkit, `docs/DEMOS.md` | the built page | Pages deploys the page; the toolkit lists the dev server |

G1 and G2 run in parallel against the manifest contract; G2 may use a hand-written manifest and the committed `.meshdump` files converted locally until G1 lands, but its final smoke runs on G1's output.

## Considered and rejected

- **Several views over one viewer session (`viewer.addView`, `view.link`).** Every view draws every model in the session, so four different GLBs cannot be shown one per pane. Would change if the viewer gains per-view model visibility.
- **Loading `.meshdump` in the browser instead of GLB.** A dozen lines of JavaScript, no conversion step, but the owner asked for GLB and GLB is what the viewer and other tools open.
- **Committing GLBs for every corpus file.** Size: the quick files and duplex are small; AC20-FZK-Haus and larger ones go under git-ignored `artifacts/` and show up in a local manifest only.

## Build log

| Chunk | Commit | Result |
|---|---|---|
| G1 | bim-open-data 94e10bf | 16 GLBs (4 files x 4 meshers, 4.4 MB) and manifest.json; Y-up by right-multiplying ZUpToYUp; in-process elapsedMs noisy (other builds running) |
| G2 | bim-open-data 23aef91 | compare.html, four panes over the alpha viewer, linkCameraViews from the first pane, lock toggle, compare-smoke.mjs; verified in the browser: sync and selector work; models stood on end (Y-up GLB in a Z-up viewer), fix requested |
