---
id: TKT-342
title: README review: correct and update the toolkit README and the stale statements it finds elsewhere
status: done
depends_on: []
owner:
fence: [README.md, docs/OVERVIEW.md, gates/README.md, samples/notebooks/README.md, site/index.html]
workflow: [W1]
confidence: high
created: 2026-10-18
closed: 2026-10-18
---

## Acceptance criteria

- [x] README.md's commands, counts, links and demos match the repository on 2026-10-18
- [x] The wrong statements the review found in other files are corrected or ticketed

The owner's request, 2026-10-18, word for word:

> In a background agent review and improve the README correcting any issues, and updating the information.

Done the same day: README.md by a review agent (478b1107: nine claims corrected, the week's features added, Build and run led by the tables profile); the stale statements it found in other files fixed by the session (47a4a6a6: node and pack counts in docs/OVERVIEW.md, the Node range in gates/README.md, the notebook count in samples/notebooks/README.md; dfafe778: the family page's notebook tile links the live NRC walkthrough). Not yet diagnosed: gates/host-smoke.mjs timed out twice while other sessions were building.

## Close gates

2026-10-18, toolkit sample graphs: `npx vitest run test/sampleCards.test.ts test/sampleLayout.test.ts` in `bimopenflow/web/packages/studio-web` passed.

```
 RUN  v3.2.7 C:/Users/cdigg/git/bim-open-toolkit/bimopenflow/web/packages/studio-web
 ✓ test/sampleLayout.test.ts (2 tests) 10ms
 ✓ test/sampleCards.test.ts (5 tests) 8884ms
   ✓ no sample graph has overlapping node cards  743ms
   ✓ no text overflows its card > for every sample graph as shown and at least width  5976ms
   ✓ no text overflows its card > for every catalog kind with default and long values  2152ms
 Test Files  2 passed (2)
      Tests  7 passed (7)
   Start at  21:07:44
   Duration  12.37s (transform 1.21s, setup 0ms, collect 8.55s, tests 8.89s, environment 1ms, prepare 461ms)
```
