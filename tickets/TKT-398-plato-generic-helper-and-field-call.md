---
id: TKT-398
title: Plato: a generic helper with a concrete first parameter is not monomorphized by the C# writer, and a record field of function type cannot be called with arguments in the interpreter
status: open
depends_on: []
owner:
fence: [../plato/src/**, ../plato/writers/**, ../plato/tests/**]
workflow: [W3]
related: [TKT-354, TKT-355, TKT-357]
confidence: high
created: 2026-10-21
kind: defect
---

## Acceptance criteria

- [ ] a generic library function whose first parameter is concrete and whose second is a type variable (CountedFlips(n: Integer, value: $T): Counted<$T>) is monomorphized by the C# writer and runs on the compiled backend; a differential test covers it
- [ ] a call with arguments on a record field of function type (c.WorkAt(n) where WorkAt: Function1<Integer, WorkBudget>) resolves in the interpreter as it does in the checker and the C# backend, and a local bound to such a field type-checks (CHK101 today)

Found 2026-10-21 building chunk W0 of docs/plans/step-mesher-complexity.md (TKT-357). (1) Compiled backend, Plato e37c032f: 'NotImplementedException: plato: no ground TIR for moved member BrepFoundationWork.CountedFlips [recv Integer] (not monomorphized)' for a generic helper with a concrete first parameter and a type-variable second; the interpreter ran it. Worked around by constructing Counted(value, work) directly. (2) Interpreter: 'cannot resolve WorkAt for (WorkClaim, Integer)': Dispatch.cs projects a PlatoRecord field only when args.Length == 1, so a field call with arguments falls through to function resolution; the stdlib's deformations use the same form (self.Mapping(p)) and so would fail interpreted. Binding the field to a local (var f = c.WorkAt; f(n)) runs interpreted but fails the checker with CHK101 'Cannot unify Any with Function1<Integer,$Apply1>'. Worked around by projecting the field alone and applying it through a function-typed parameter (MeasureAt(n, c.WorkAt)).
