---
id: TKT-509
title: STEP mesher: mesh.ElementFace.Take(1) reads index 0 of an empty mesh; Plato's Take requires n <= Count by design
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/07-validation/validation-checks-mesh.library.plato]
workflow: [W3]
confidence: medium
created: 2026-10-23
kind: defect
---

## Acceptance criteria

- [ ] every library call of Take(n) with a constant n > 0 either has a reason the array holds at least n elements or uses a clamped prefix; validation-checks-mesh.library.plato lines 403 and 409 handle a mesh with no elements
- [x] the owner decides whether Plato's stdlib gains a clamping TakeAtMost(xs, n) = Take(xs, n.Min(Count)); until then no caller relies on Take clamping

From v1-faces via the supervisor (2026-10-23): Take(1) on an empty array reads index 0, and Take(n) past the end reads out of range. That is Take's stated contract, not a stdlib defect: stdlib/foundation/primitives.library.plato's sub-range section says every sub-range is a window onto the source, none validates, and the preconditions are the caller's; Take reads 'The first n elements. Precondition: 0 <= n <= Count.' (Skip, TakeLast and SubArray state theirs the same way). Making Take clamp would change the generated C# of every caller and hide caller bugs like this one. The library has 11 calls of Take with a constant n > 0 and 236 of Take(0) (the empty-array idiom, always in range). The two at validation-checks-mesh.library.plato:403 and :409 pass mesh.ElementFace.Take(1) to a law over a restriction, which reads index 0 when the mesh has no elements.

## Decision (supervisor, 2026-10-23)

No TakeAtMost. Take keeps its stated precondition (0 <= n <= Count), and callers are fixed. The 11 constant-n call sites go to v1-faces to audit; F7 has already rebuilt the two at validation-checks-mesh.library.plato 403 and 409. The ticket stays open for the audit (box 1).
