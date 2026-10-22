---
id: TKT-463
title: The contract check misreports sliver elements as flipped or over the chordal bound
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/tools/step-corpus-harness/ContractCheck.cs]
workflow: [W5]
related: [TKT-455, TKT-323]
confidence: high
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] an element with 2*area/longest^2 below a stated threshold counts as degenerate, and is left out of the flipped test and of the distance samples
- [ ] RCB-F9T face 874 reports degenerate, not over chordal, and NEO, PAM and NORA-B100 report no flipped plane element

ContractCheck counts an element degenerate only when its cross product is exactly 0. A sliver with relative area 1e-16 then reads as flipped when the sign of its normal is rounding noise (every flipped plane element on NEO, PAM, NORA-B100/B101/B106), and as over chordal because Ericson's point-to-triangle distance is unstable on it: RCB-F9T face 874 reports 8.53 against a bound of 1.00 for a sample lying on the sliver itself, and the SARA planes 0.11 to 0.16. The mesher defect behind the slivers is the planar CDT ticket filed with this one.
