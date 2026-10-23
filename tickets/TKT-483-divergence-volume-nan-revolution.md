---
id: TKT-483
title: Divergence volume oracle returns NaN on a surface of revolution or linear extrusion
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/07-validation/validation-oracles*.plato]
workflow: [W3]
related: [TKT-482]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] Oracle_DivergenceVolume(ShellIndex(0)) is finite and within DivergenceAllowance of the stated volume on Witness_ExtrudedFillet (23.845486), Witness_RevolvedBarrel (12.149046) and Witness_RevolvedCone (5.277876) of the staged gallery witnesses
- [ ] The NaN guard in Law_OperationWitnessVolumeMatchesOracle (sandbox/step-mesh-staging/gallery-witnesses/operation-witnesses.laws.plato) is removed and the law still passes

Found 2026-10-22 by the operation witnesses (TKT-482): the probe artifacts/scratch-probe printed, from the C# regenerated at 2ab7ea1a plus the staged witnesses, oracle NaN and allowance NaN on exactly the three witnesses whose curved face is BrepSurface.Revolution or BrepSurface.LinearExtrusion, while the same fillet on a BrepSurface.Cylinder (Witness_Fillet) and the torus band, sphere caps, cones and ellipse cut agree with their closed forms within the allowance (19 of 22). ShellOracleArea is finite on all three (51.33, 27.90, 17.46), so the area oracle handles the two surface kinds and the divergence integrand does not: likely the surface normal or the parameter-plane Jacobian of the two curve-founded surfaces in the divergence sum.
