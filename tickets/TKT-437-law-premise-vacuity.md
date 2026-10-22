---
id: TKT-437
title: Plato law runner: a law's premise is counted, and a law whose premise held on no case is reported vacuous, a failing verdict
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/src/Plato.Interpreter/LawRunner.cs, C:/Users/cdigg/git/plato/src/Plato.Navigation/**]
workflow: [W3]
related: [TKT-434]
confidence: medium
created: 2026-10-22
---

## Acceptance criteria

- [ ] a Premise_<Law> companion with the law's parameters, like Measure_<Law>, is evaluated on every case; the result line gives cases and premise-held counts
- [ ] a law with a premise companion that held on no case is reported vacuous, and plato_laws.py counts it as a failure
- [ ] Law_PendingRequestIsInSomeOutcome and Law_RigidFrameIsOrthonormal report vacuous before a witness is added

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class A. A guarded law (p ? q : true) passes whether or not p ever held; Law_PendingRequestIsInSomeOutcome held on no witness with a pending request, and the proofs track flagged two more as vacuous by reading. The Plato repository is v1-compiler's fence.
