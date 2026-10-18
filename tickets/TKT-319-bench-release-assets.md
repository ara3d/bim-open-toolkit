---
id: TKT-319
title: Publish the bench corpus's converted forms as release assets so the side-by-side page works on GitHub Pages
status: open
depends_on: []
owner:
fence: []
workflow: [W1, W5]
related: [TKT-142, TKT-144, TKT-226, TKT-275]
created: 2026-10-17
kind: action
---

The side-by-side page in ara3d/bim-open-bench (`site/side-by-side.html`) loads each model in the form each viewer reads: `.ifc`, `.glb`, `.bos`, `.frag`, `.xkt`, with a `.json` conversion record beside each. Served from a checkout it reads `models/cache/`, which is git-ignored and built by `npm run fetch` and `npm run convert`. On GitHub Pages (workflow `.github/workflows/pages.yml`, added 2026-10-18) there is no cache, so the page falls back to `release.baseUrl` in `models/manifest.json`: `https://github.com/ara3d/bim-open-bench/releases/download/models-2026-10-11`. That release does not exist yet. Since 2026-10-18 the Duplex is bundled with the site (`models/bundled/`, commit 80f94ba in the bench), so the published page loads and all six panes work on it; what the release is still needed for is Schependomlaan and Sixty5, which fail on the published page until it exists. The Duplex files need not be uploaded; the other two models, with their forms, are about 775 MB.

Owner, from a checkout whose cache is complete (`node scripts/fetch.mjs --check` passes and every `models/cache/<id>.<form>.json` exists), signed in with `gh`:

```
cd bim-open-bench
gh release create models-2026-10-11 --title "Model corpus, converted 2026-10-11" --notes "The three public IFC models of models/manifest.json (CC BY 4.0, attribution in models/NOTICE.md) and their converted forms, with the conversion record beside each. Pinned by SHA-256 in the manifest and the records." models/cache/*.ifc models/cache/*.glb models/cache/*.bos models/cache/*.frag models/cache/*.xkt models/cache/*.json
```

That is 27 files, about 780 MB; the largest, `sixty5.ifc`, is 343 MB, under GitHub's 2 GB limit per asset. If redistributing the `.ifc` files themselves is not wanted until TKT-144 is decided, leave them out and change the page to read the `ifc` form from each model's `source.url` instead (the manifest already has them; buildingSMART's media URLs and Hugging Face send permissive CORS headers, not yet checked from a browser). The release assets are served from `objects.githubusercontent.com` with `Access-Control-Allow-Origin: *`, which the panes need because the page runs on `ara3d.github.io`.

After uploading, open `https://ara3d.github.io/bim-open-bench/site/side-by-side.html?model=duplex&autoload=1` and check that every built pane reaches `done`. Panes that need cross-origin isolation (IFClite's WebGPU path, threaded web-ifc) may not work on Pages, which sends no such headers; record what happens in the bench README. Pages itself must be switched on with source "GitHub Actions" in the repository settings (TKT-142).

When the corpus changes, make a new release tag and move `release.baseUrl`; the old tag keeps old pages reproducible.
