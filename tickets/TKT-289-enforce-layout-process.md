---
id: TKT-289
title: Enforce the layout process: close gates for sample and card-size tickets, positions only from the layout tool, card-size changes own the relayout and the pin
status: done
depends_on: []
owner: session 3777d13d
session: 3777d13d-6750-4d06-989e-0517bca2a2c7
fence: [tickets/close-gates.toml, scripts/check-pin.mjs, AGENTS.md, samples/**/*.json, bimopenflow/web/packages/studio-web/test/**, deps.json, deps/bim-open-flow/bimopenflow/web/packages/graph/scripts/**, deps/bim-open-flow/bimopenflow/web/packages/graph/src/layoutCheck.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/test/**, deps/bim-open-flow/samples/**/*.json]
workflow: [process]
related: [TKT-286]
confidence: high
created: 2026-10-12
claimed: 2026-10-12
closed: 2026-10-12
---

## Acceptance criteria

- [x] ticket.py close refuses while an acceptance box is unchecked (unless --waive records why) and runs the close gates a ticket's fence touches (platonic-coder bdf9ebb)
- [x] tickets/close-gates.toml gates a ticket touching samples, the graph package, or the node catalog on the toolkit's and bim-open-flow's sample tests, and a ticket touching deps/bim-open-flow on the pin matching the pushed checkout
- [x] A test fails when a sample's stored position differs from autoLayout's, in both repositories; every sample is at the tool's positions
- [x] AGENTS.md says positions come from relayout-samples and that a card-size change owns the relayout and the pin bump

Owner's request 2026-10-12 after TKT-286: gate closing on the sample tests with the output quoted, make ticket.py close refuse while boxes are unchecked, stop placing cards by hand, and give card-size changes their follow-through.

## Close gates

2026-10-12, toolkit sample graphs: `npx vitest run test/sampleCards.test.ts test/sampleLayout.test.ts` in `bimopenflow/web/packages/studio-web` passed.

```
 RUN  v3.2.7 C:/Users/cdigg/git/bim-open-toolkit/bimopenflow/web/packages/studio-web
 ✓ test/sampleLayout.test.ts (2 tests) 5ms
 ✓ test/sampleCards.test.ts (5 tests) 2246ms
   ✓ no text overflows its card > for every sample graph as shown and at least width  1456ms
   ✓ no text overflows its card > for every catalog kind with default and long values  660ms
 Test Files  2 passed (2)
      Tests  7 passed (7)
   Start at  21:03:08
   Duration  4.57s (transform 806ms, setup 0ms, collect 4.13s, tests 2.25s, environment 1ms, prepare 384ms)
```

2026-10-12, bim-open-flow sample graphs: `npx vitest run test/sampleLayout.test.ts test/sampleOverlap.test.ts test/textOverflow.test.ts` in `deps/bim-open-flow/bimopenflow/web/packages/graph` passed.

```
 RUN  v3.2.7 C:/Users/cdigg/git/bim-open-toolkit/deps/bim-open-flow/bimopenflow/web/packages/graph
 ✓ test/sampleOverlap.test.ts (3 tests) 137ms
 ✓ test/sampleLayout.test.ts (2 tests) 183ms
 ✓ test/textOverflow.test.ts (6 tests) 1128ms
   ✓ no text overflows its card > with hidden descriptions, for every catalog kind with default and long values  335ms
 Test Files  3 passed (3)
      Tests  11 passed (11)
   Start at  21:03:15
   Duration  2.83s (transform 1.17s, setup 0ms, collect 3.08s, tests 1.45s, environment 1ms, prepare 505ms)
```

2026-10-12, bim-open-flow pin: `node scripts/check-pin.mjs bim-open-flow` in `.` passed.

```
bim-open-flow: pinned at 48a568a, pushed
```
