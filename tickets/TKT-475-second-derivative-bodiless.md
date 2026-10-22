---
id: TKT-475
title: STEP mesher library: SecondDerivative of a surface curve or pcurve is declared without a body, so layer 7's derivative checks throw on SHO/ELLA-W1 and NINA-B222
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/01-geometry/**]
workflow: [W3]
related: [TKT-441, TKT-369]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] SecondDerivativeMatchesCentralDifference and PcurveSecondDerivativeMatchesCentralDifference (and their Hoisted forms) give a verdict, not NotImplementedException, on the prepared models of SHO/ELLA-W1.STEP and SHO/NINA-B222-W1x2.STEP

Found by layer 7's checks on every corpus file (TKT-441; docs/plans/step-mesher-reliability-2026-10-22.md (TKT-441 section); run: step-corpus-harness all <corpus> <out> 300 --child laws, bim-open-data 97495d8): 'NotImplementedException: plato: SecondDerivative is declared without a body', raw and prepared, the two files with SURFACE_CURVE edges. TKT-369 recorded the same bodiless SecondDerivative(g, p: PcurveIndex, t) as a host obligation. No mesh path calls it today, but any curvature-based criterion on a surface curve would throw.
