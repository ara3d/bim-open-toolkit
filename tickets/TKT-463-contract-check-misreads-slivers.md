---
id: TKT-463
title: The contract check misreports sliver elements as flipped or over the chordal bound
status: done
depends_on: []
owner: v1-proof
fence: [deps/bim-open-data/tools/step-corpus-harness/ContractCheck.cs]
workflow: [W5]
related: [TKT-455, TKT-323]
confidence: high
created: 2026-10-22
closed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] an element with 2*area/longest^2 below a stated threshold counts as degenerate, and is left out of the flipped test and of the distance samples
- [x] RCB-F9T face 874 reports degenerate, not over chordal, and NEO, PAM and NORA-B100 report no flipped plane element

ContractCheck counts an element degenerate only when its cross product is exactly 0. A sliver with relative area 1e-16 then reads as flipped when the sign of its normal is rounding noise (every flipped plane element on NEO, PAM, NORA-B100/B101/B106), and as over chordal because Ericson's point-to-triangle distance is unstable on it: RCB-F9T face 874 reports 8.53 against a bound of 1.00 for a sample lying on the sliver itself, and the SARA planes 0.11 to 0.16. The mesher defect behind the slivers is the planar CDT ticket filed with this one.

Owner: v1-proof fixes the contract check's classification (supervisor, 2026-10-22).

## Log

- 2026-10-22, v1-proof (P7), bim-open-data dee6ce4. An element with 2*area/longest^2 at or below 1e-9
  (`ContractCheck.SliverRatio`) is degenerate and is left out of the flip test, the mesh-to-surface samples and a
  quad split's surface-to-mesh distance. Corpus, 88 files, `--path host --parallel`: RCB-F9T face 874 reports 3
  degenerate and deviation 7.3e-9 (was 8.53 over chordal); NEO face 680, PAM face 1406 and NORA-B100/B101/B106 report
  no flipped element (degenerate 2, 7 and 22); every plane deviation is 1e-8 or less. Remaining flips are real (JODY
  TKT-465, NINA-B222 TKT-465, ANN-MB2 TKT-466); the one over-chordal face is c211 face 339 (TKT-464). Degenerate on
  20 files, 8 of them newly caught (TOBY-L4, LARA, LEXI, LEA x3, MIA-M10Q, M2-MAYA-W271): the mesher half is TKT-462.
