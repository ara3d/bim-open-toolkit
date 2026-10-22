---
id: TKT-446
title: Plato law runner: draw a type's values through its Witness_ or generator function when one exists, so a tolerance is never 0 or negative
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/src/Plato.Laws/**, C:/Users/cdigg/git/plato/src/Plato.Interpreter/LawRunner.cs, C:/Users/cdigg/git/plato/tests/**, C:/Users/cdigg/git/plato/docs/**]
workflow: [W3]
related: [TKT-423, TKT-435]
confidence: medium
created: 2026-10-22
---

## Acceptance criteria

- [ ] When a library declares a generator for a type (a Generate_ or Witness_ function with that return type, by a rule written in the runner's docs), the runner draws that type's law arguments from it and never builds the type field by field
- [ ] A test law over LengthTolerance-like type with a generator receives no value with Value <= 0
- [ ] Rerunning the 23 model-validity laws of TKT-423 under the runner with the STEP mesher's tolerance generators shows which still fail, recorded in that ticket

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). The runner constructs LengthTolerance and AngleTolerance field by field, so it draws 0 and -0.5 and at least 25 STEP mesher laws fail on values no constructor would make (TKT-423; math review F12; FINDINGS F-58 placement laws). Refinement types would remove this at the source; a generator rule in the runner is the cheap step. Can start now: Plato repository only.
