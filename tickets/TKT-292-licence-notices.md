---
id: TKT-292
title: Licence files for the toolkit and the Duplex sample
status: done
depends_on: []
owner:
fence: [LICENSE, samples/nrc/NOTICE.md]
workflow: [W1]
related: [TKT-144]
confidence: high
created: 2026-10-12
closed: 2026-10-12
---

## Acceptance criteria

- [x] The repository root has a LICENSE file (MIT, Ara 3D, matching the README's License section and the deps/ repositories' files)
- [x] samples/nrc/NOTICE.md credits the Duplex Apartment files as TKT-144 records: BSI (2020) Duplex Apartment Test Files, buildingSMART International, CC BY 4.0, from github.com/buildingsmart-community/Community-Sample-Test-Files, and states which committed files derive from it (duplex-base.ifc byte-identical, duplex-enriched.ifc adds property sets)

TKT-144 settled the terms on 2026-10-03 (Duplex CC BY 4.0 with attribution; Schependomlaan CC BY 4.0, owner confirmed) but samples/nrc still has no NOTICE, and the toolkit root has no LICENSE file although the README has a License section. Raised again 2026-10-12 by the Studio 2.5 colleague.

## Notes

- 2026-10-12: Added LICENSE (copy of deps/bim-open-flow/LICENSE, MIT, 2026 Ara 3D) and samples/nrc/NOTICE.md. The README (not in this fence) could link the NOTICE from samples/nrc/README.md or its License section. I did not check duplex-base.ifc against the buildingSMART file; samples/nrc/README.md records it as identical to the paper repository's duplex.ifc.

## Close gates

2026-10-12, toolkit sample graphs: `npx vitest run test/sampleCards.test.ts test/sampleLayout.test.ts` in `bimopenflow/web/packages/studio-web` passed.

```
 RUN  v3.2.7 C:/Users/cdigg/git/bim-open-toolkit/bimopenflow/web/packages/studio-web
 ✓ test/sampleLayout.test.ts (2 tests) 3ms
 ✓ test/sampleCards.test.ts (5 tests) 1964ms
   ✓ no text overflows its card > for every sample graph as shown and at least width  1306ms
   ✓ no text overflows its card > for every catalog kind with default and long values  532ms
 Test Files  2 passed (2)
      Tests  7 passed (7)
   Start at  21:54:49
   Duration  4.34s (transform 776ms, setup 0ms, collect 4.08s, tests 1.97s, environment 0ms, prepare 333ms)
```
