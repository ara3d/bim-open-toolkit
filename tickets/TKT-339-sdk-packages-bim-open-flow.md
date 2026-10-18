---
id: TKT-339
title: Extend the prebuilt Ara3D SDK packages to bim-open-flow and move the bim-open-data pin
status: done
depends_on: []
owner: session c4298a2b
session: c4298a2b-52b5-4c66-abfe-c7b982524e14
fence: [deps/bim-open-flow/Directory.Build.targets, deps.json]
workflow: [process]
related: [TKT-321]
created: 2026-10-18
claimed: 2026-10-18
closed: 2026-10-18
---

## Acceptance criteria

- [x] deps/bim-open-flow's Directory.Build.targets keeps the Ara3D SDK ids as package references when the local feed from scripts/pack-ara3d-sdk.ps1 exists, as the toolkit's and bim-open-data's do since TKT-321, with ARA3D_SDK_FROM_SOURCE=true still forcing source
- [x] a cold build of src/studio/BimOpenFlow.Studio compiles no Ara3D SDK project, measured before and after in docs/plans/build-times.md
- [x] node gates/e2e-smoke.mjs and node gates/host-smoke.mjs print PASS
- [x] deps.json pins bim-open-data at 508ddff (or later) and bim-open-flow at the pushed commit

TKT-321 made the toolkit and bim-open-data consume the pinned SDK as packages from a local feed, which cut a cold test-project build from about 25 s to 11 s; the studio still compiles the SDK from source because deps/bim-open-flow's Directory.Build.targets was outside that ticket's fence, and the bim-open-data pin in deps.json was not moved to the commit carrying the change.

## Close gates

2026-10-18, bim-open-flow pin: `node scripts/check-pin.mjs bim-open-flow` in `.` passed.

```
bim-open-flow: pinned at 8b9a466, pushed
```
