---
id: TKT-469
title: STEP mesher: a face reported as a sliver (no area wider than the tolerance) is left unmeshed and opens its closed shell (SHO/c211_case_with_odin_v1.step faces 32, 82, 92, 94)
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-brep-mesh/08-pipeline/**]
workflow: [W3]
related: [TKT-323, TKT-461, TKT-412]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A law over a witness closed shell with one sliver face (its boundary encloses no area wider than the length tolerance) states that the assembled mesh has no boundary edge along the sliver's edges, and fails on the current library
- [ ] c211_case_with_odin_v1.step's faces 32, 82, 92 and 94 leave no boundary edge in their closed shell, or each carries a located diagnostic that the contract check counts as an open shell, not as covered

Found 2026-10-22 by track v1-edges while classifying the boundary edges of the corpus run of 2026-10-22 (library 43dd439b, bim-open-data b2cfaf3). c211_case_with_odin_v1.step has 2,171 boundary edges, all beside unmeshed faces of closed shells (6 of its 8 closed shells close). Its 12 unmeshed faces: B-spline faces 32, 82, 92 and 94 (3 to 5 edges) take the refined branch and end with 'This face's boundary encloses no area wider than the model's tolerance (a sliver or a strip); it is not meshed, and refining its edges would not change that.' The neighbours of a sliver mesh the sliver's edges each on their own side, so the shell is open along both. The version 1 contract wants the shell closed: a sliver can be meshed by its boundary alone (zero-area triangles are a quality matter, not a gap), or its two long sides identified so the neighbours meet. The other 8 faces (B-spline 45, 259, 260, 262, 263 and cylinders 81, 84, 88) are reported not simple after the refinement rounds, the class of TKT-412 and TKT-461.
