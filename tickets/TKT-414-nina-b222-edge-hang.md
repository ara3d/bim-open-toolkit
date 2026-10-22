---
id: TKT-414
title: STEP mesher: SHO/NINA-B222-W1x2.STEP does not finish edge discretization in 600 s; it stops with 32 of its 2,132 edges outstanding
status: claimed
depends_on: []
owner: session 53a578f9
session: 53a578f9-98e0-45c4-bc66-a8c1cacb3bae
fence: [sandbox/step-brep-mesh/04-discretization/**]
workflow: [W3]
related: [TKT-313, TKT-346, TKT-410]
created: 2026-10-21
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] The edge (or edges) that does not return is named with its curve kind and the surfaces it lies on, and discretizes or gets a located diagnostic within the per-edge budget
- [ ] The corpus rerun reports no file over 120 s

Found by the corpus rerun of 2026-10-21 (library 8984df4b, bim-open-data 3245cb7): the only file over the 120 s limit, killed at 'stage edges 2100/2132' (rows on every core, so the 32 outstanding edges are not the last 32 by index); rerun alone with a 600 s limit and no warm-up it was killed again with nothing written, so at least one edge runs over 8 minutes or does not terminate. In October (docs/plans/step-mesher-corpus-2026-10-19.md) the file failed in PrepareModel like the other B-spline files, and its census noted that 21 of its 2,131 SURFACE_CURVE edges threw on the closure test, the only such edges outside ELLA-W1; ELLA-W1's 20,684 surface-curve edges now all throw the stub of TKT-410 in 0.4 ms each and do not hang, so the hang is in an edge that gets past that point. Next step: a probe that discretizes each edge of the file in its own time box and names the one that does not return; the harness's time mode writes nothing until every row is done. TKT-346 bounded the raise loops for termination on the kinds it had witnesses for; this edge is a new witness.
