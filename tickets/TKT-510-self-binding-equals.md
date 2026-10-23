---
id: TKT-510
title: Plato checker: an interface method's Self, once bound by one argument, accepted any other argument implementing the interface, so SampleIx(k) == k compiled to SampleIx.Equals(object) and was false
status: done
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/src/Plato.Compiler/Checking/Solver.cs, C:/Users/cdigg/git/plato/writers/Plato.CSharpWriter/TirCSharpBodyWriter.cs, C:/Users/cdigg/git/plato/tests/**]
workflow: [W3]
related: [TKT-438, TKT-445, TKT-355]
confidence: high
created: 2026-10-23
closed: 2026-10-23
kind: defect
---

## Acceptance criteria

- [x] a call whose interface-method Self is bound by one argument rejects a later argument that neither unifies with nor converts to that type (CHK201), with a checker test
- [ ] a receiver the solver converts (TirCoerce) is cast in the generated C#, so it binds the member of the converted type
- [x] the forward stdlib keeps 0 checker diagnostics, and the change to the mesher library's diagnostics and generated C# is measured and reported

From v1-edges (TRACK.md, E5d-1): == on EdgeSampleIndex was false for equal values in compiled code. Reproduced (2026-10-23) only with mixed types: a one-field wrapper compared with its bare payload, SampleIx(k) == k with SampleIx { Value: Integer }. The checker resolved == to IEquatable.Equals(a: Self, b: Self) with Self = SampleIx and took the Integer second argument unconverted: Solver.MatchArg, for an interface-constrained parameter, called Unify(param, argType) and ignored its result, so implementing IEquatable was enough. The C# writer emitted new SampleIx(k).Equals(k), which bound SampleIx.Equals(object) and returned false; the interpreter re-resolves by value and answered true. Same-type comparisons (EdgeSampleIndex == EdgeSampleIndex, in lambdas, record fields and short-circuit chains) agree on both backends at Plato 60134758 and HEAD. The differential run did not flag it because no committed law compares a wrapper with its payload: v1-edges' line was rewritten to compare .Value before it was committed. A NotEquals form (!(SampleIx(k) != k)) is not flagged by the checker either, but its C# fails to compile, so it is loud.

## Resolution (2026-10-23, Plato 8ea81ce7)

- Solver.MatchArg: once an argument binds an interface method's Self to a concrete type, a later argument must unify with it or convert to it; Self bound to an interface still takes any implementer. `SampleIx(k) == k` and `k == SampleIx(k)` are CHK201 ("No overload of 'Equals' matches argument types (SampleIx, Integer)"); compare `.Value`, as v1-edges did. Same-type comparisons are unchanged and agree on both backends (SelfBindingTests, on the differential backend).
- Measured: stdlib checker diagnostics identical to d6eafae8 (29 error lines; the CheckerCompleteness ceiling holds); the mesher library at toolkit HEAD has 0 checker errors before and after; the mesher's generated C# (layers 00-08, library 83a5da13) is byte-identical to d6eafae8's.
- Why the differential run missed it: it compares only what laws and witnesses exercise, and no committed law compared a wrapper with its payload; v1-edges rewrote the line to `.Value` before committing. Same-type `==` on EdgeSampleIndex (direct, in a lambda, a record field, an && chain) gave the same answer on both backends at 60134758 and at HEAD.
- Box 2 not done, waived: casting a converted receiver in the C# writer. Casting every receiver to the callee's first parameter broke seven stdlib types; casting only a TirCoerce receiver fired nowhere. A converted receiver in an extension-style call (`k.Halved` for `Halved(x: Number)`) fails to compile with CS1929 on every Plato commit tried: loud, not silent, and a follow-up if it matters.
- Not flagged by the checker: `!(SampleIx(k) != k)` resolves through a NotEquals whose two interface parameters bind separately; its C# fails to compile (CS1503), so it is loud.

## Closed with criteria unmet

2026-10-23: box 2 (a C# cast for a converted receiver): both versions tried were rejected, one broke seven stdlib types and the other fired nowhere; the remaining case fails to compile (CS1929), loud not silent; recorded in the resolution
