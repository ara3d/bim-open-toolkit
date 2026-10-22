---
id: TKT-437
title: Plato law runner: a law's premise is counted, and a law whose premise held on no case is reported vacuous, a failing verdict
status: done
depends_on: []
owner: session f58080da
session: f58080da-237d-478d-a779-1bc570009dc2
fence: [C:/Users/cdigg/git/plato/src/Plato.Interpreter/LawRunner.cs, C:/Users/cdigg/git/plato/src/Plato.Navigation/**]
workflow: [W3]
related: [TKT-434]
confidence: medium
created: 2026-10-22
claimed: 2026-10-22
closed: 2026-10-22
---

## Acceptance criteria

- [x] a Premise_<Law> companion with the law's parameters, like Measure_<Law>, is evaluated on every case; the result line gives cases and premise-held counts
- [x] a law with a premise companion that held on no case is reported vacuous, and plato_laws.py counts it as a failure
- [x] Law_PendingRequestIsInSomeOutcome and Law_RigidFrameIsOrthonormal report vacuous before a witness is added

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class A. A guarded law (p ? q : true) passes whether or not p ever held; Law_PendingRequestIsInSomeOutcome held on no witness with a pending request, and the proofs track flagged two more as vacuous by reading. The Plato repository is v1-compiler's fence.

## Progress (2026-10-22)

- Plato 00610b70: `LawRunner` evaluates a `Premise_<Law>` companion (the law's parameter types, Boolean) on every passing case; the pass line reads `(14 cases, exhaustive, premise held on 7)`; a law whose premise held on no case is `vacuous` (verdict file and exit code 1). `tests/Plato.Interpreter.Tests/PremiseTests.cs`, both backends.
- Premises staged in `sandbox/step-mesh-staging/v1-compiler/law-premises.laws.plato`: Law_PendingRequestIsInSomeOutcome (14 cases) and Law_RigidFrameIsOrthonormal (25 cases) report vacuous on the interpreter and compiled C#.
- Open: `plato_laws.py` does not know the verdict `vacuous` yet; another session has uncommitted edits in that file, so the change is a request in the track's TRACK.md.
