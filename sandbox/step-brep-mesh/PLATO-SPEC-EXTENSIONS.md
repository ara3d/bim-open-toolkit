# Plato language extensions for specification: proposal

Written 2026-10-17 for TKT-299 (the STEP B-rep to mesh design in this folder). It proposes the
additions and changes to the Plato language that let a pure-functional library carry its own
specification: invariants on types, contracts on functions, laws, theorems, witnesses and
generators, all parsed, bound and type-checked by the same front end as code. It is distilled from
[SPEC-EXECUTION.md](SPEC-EXECUTION.md) (second version), whose argument, prior art and verifier
design it does not repeat; where this proposal departs from that document, section 8 says so and
why. Every example is a statement the library already makes, in the invented DSL of
[SPEC-DSL.md](SPEC-DSL.md), rewritten in the proposed syntax.

Scope: the language. The verifier, the evaluator and the checked builds appear only where a
construct's meaning depends on them. Plato is read at commit `f6e02cf0`; the sandbox at 14:20 on
2026-10-17, with all seven layers 0 to 6 written (the counts in SPEC-EXECUTION.md 9.1 were taken
earlier, with four layers unfinished).

## 0. The features at a glance

| Where | Feature | Replaces in the sandbox today |
|---|---|---|
| expressions | `&&`, `\|\|` short-circuit on `Boolean` | 394 guard tails `pre ? claim : true`; three dummy-array guards |
| expressions | `a implies b` | the same guards, where the claim is one expression |
| expressions | `all x in D: e`, `any x in D: e` | 450 `forall` and 15 `exists` in spec files, 14 of them over an undeclared `UpTo` |
| expressions | `a === b`, derived identity | `Identical` (19 uses), `SameDiscretization`, 25 comments "exact by construction" |
| expressions | tolerance comparisons typed by `ITolerance<M>` | `measure <= tol.Value`, `LawEq`, literal epsilons |
| types | `invariant e` | 78 `invariant` clauses in spec files, plus `IsWellFormed` predicates |
| types | `sealed by F, G` | 19 `constructor` lines and a comment on `Check` |
| types | derived `CanConstruct` and `IsWellFormed` | hand-written `IsWellFormed` on nine foundation types |
| functions | `requires e`, `ensures e` with `result` | 97 `requires` and 240 `ensures` in spec files that repeat 68 signatures |
| functions | `decreases e` | `measure` on recursive functions; theorem `DiscretizeTerminates` |
| functions | `deferred "<family>"` | 68 bodiless functions read as "not yet written", indistinguishable from intrinsics |
| functions | `reference => e` body | nothing: layers above a deferred function cannot run today |
| interfaces | contracts and laws on members | 27 generic laws in `stdlib/tests/foundation.laws.plato` |
| declarations | `law` with parameter domains `in` and `from` | 376 `Law_` functions, of which about a third are predicates over data |
| declarations | `theorem`, `conjecture` with `because`, `tested by`, `by` | 41 `theorem` blocks in spec files |
| declarations | `witness`, with `violates` | 8 `Witness_` functions |
| declarations | `generator` with `draw` | nothing: constrained inputs are hand-built witnesses only |

Counts are by `grep` over the layer folders at the time stated above.

## 1. Expressions

### 1.1 Short-circuit `&&` and `||` on `Boolean`

**What.** On `Boolean` operands the elaborator lowers `a && b` to `a ? b : false` and `a || b` to
`a ? true : b`. On any other `IBooleanAlgebra` type they stay calls to `And` and `Or`, as today
(SEMANTICS.md section 6), since only a `Boolean` can be branched on.

**Why.** Today both operands are evaluated, so a guard cannot protect the index after it. The
sandbox's laws files carry 394 tails of the form `pre ? claim : true`, and three laws in layer 4
build an empty array so that an unguarded index cannot fault:

```plato
// 04-discretization/discretization.laws.plato, today
var uvs = ok ? m.ImagePoints(d, img) : 0.MapRange(j => UvCoordinate(0.0, 0.0));
```

In a pure language the only observable difference between strict and short-circuit evaluation is a
fault or the time taken; short-circuit evaluation is defined on strictly more programs. Every
target language, GLSL included, short-circuits its native `&&`.

**Use.** `d.Points.IsValidIndex(i) && d.Points[i].IsFinite` is total. The guard-dominance rule of
section 5 treats the left operand of `&&` as a guard for the right.

### 1.2 `implies`

**What.** `a implies b` is `a ? b : true`, with the lowest precedence of the binary operators.

**Why.** It names the pattern behind the guard tails, and a reader sees hypothesis and claim in
the order a mathematician writes them.

**Use.**

```plato
ensures m.IsDegenerateEdge(e) implies result.SegmentCount == 1
ensures m.IsClosedEdge(e) implies result.SegmentCount >= c.ClosedEdgeMinimum
invariant self.Worst.IsNaN implies !self.Holds      // type Check
```

### 1.3 Bounded quantifiers `all` and `any`

**What.** `all x in D: e` and `any x in D: e`, where `D` is an array, an integer range (`n.Range`),
or any value of a type implementing a finite-collection interface. They short-circuit, lowering to
a loop that stops at the first decisive element; no new TIR node, as `match` has none. Over a
continuous domain (`NumberInterval`, an angle interval, a box in parameter space) a quantifier is
permitted only in the body of a `law`, `theorem` or `conjecture`, where the verifier owns the
sampling and may bound it soundly by interval subdivision. In an `invariant`, `requires`, `ensures`
or ordinary code a continuous domain is a compile error. Unbounded quantification is not an
expression: it is a law's parameter list.

**Why.** The spec files write 450 `forall`; 110 have no domain and rely on a cited law's guard to
bound an index, 24 lines nest one quantifier inside another, and 14 range over `0.UpTo(n)`, which
no layer declares. An explicit, finite domain is what makes a quantified clause checkable in a
checked build and a quantified law exhaustible by the verifier. Continuous domains stay out of
contracts because a contract's meaning must not depend on a sampling plan the author did not
write; the sandbox's `SamplePlan` parameter is the explicit form, and stays.

**Use.**

```plato
// Discretize, two of its ensures
ensures all i in result.Points.Count.Range: PointLiesOnCurve(m, result, i)
ensures all img in m.EdgeImages(e): all i in result.SegmentCount.Range:
    ImageChordWithinChordal(m, result, c, img, SamplePlan.DiscretizationPlan, i)

// type Report
invariant all k in self.Checks.Count.Range:
    self.Checks[k].Holds || any d in self.Diagnostics: d.Code == self.Checks[k].Law
```

The sandbox's `Sagitta` contract, `forall (f: Number) in NumberInterval(0.0, 1.0) : ...`, is
restated as a law over `f: Number in NumberInterval(0.0, 1.0)` (section 4.1), where the interval
profile can bound it on the whole span.

### 1.4 Identity `===`

**What.** `a === b` is derived for every type: bitwise on `Number` (a NaN is identical to a NaN
with the same bits; `+0` and `-0` differ), tag and payload on sums, element by element on arrays,
field by field on products. It is not an operator name a library can redefine. On a type with an
interface-typed (existential) field it compares the dynamic types first, then the values.

**Why.** The design copies many values rather than computing them (a discretization's first
parameter is the domain's start; `Reversed` copies arrays without arithmetic), and the sharing
principle that makes meshes watertight rests on those copies being bit-identical. Today such
claims use `==` with the comment "exact by construction" (25 times), a hand-written `Identical`
(19 uses) and layer 4's `SameDiscretization`; `==` on arrays is CHK201 and generated record
equality compares arrays by reference (PLATO-PRIMER.md D.6). In specifications, `==` on a
`Number`-bearing type becomes a warning that asks for `===` (a copy) or a tolerance (a computation).

**Use.**

```plato
ensures result.Parameters.First === m.EdgeDomain(e).Range.Start   // Discretize
ensures result.Worst === worst                                      // CheckWithin

law ReversedIsInvolution(d: EdgeDiscretization)
    => d.Reversed.Reversed === d
    by smt;
```

### 1.5 Tolerance comparisons

**What.** A stdlib interface `ITolerance<M>` with one member, `Value(t: Self): M`, discharged by a
field named `Value`. A comparison `m <= tol` or `m < tol` in which `tol: ITolerance<M>` and
`m: M` resolves through ordinary overloads of `LessThanOrEquals` and `LessThan` that the stdlib
declares once; `a.Within(b, tol)` is `Distance(a, b) <= tol` through `IMetricSpace`. No new
operator. What the compiler adds is recognition: the elaborator marks such a comparison with a
TIR node recording measure, bound and the tolerance's type, so that verification builds log every
evaluation (margins, worst-case search, the three-valued verdict of SPEC-EXECUTION.md 2.9). A
numeric literal as the bound of a comparison in a specification is an error.

**Why.** Every approximate statement in the library names its tolerance, by the owner's rule, and
the tolerances have dimensions: `LengthTolerance` and `ParameterTolerance` over `Number`,
`AngleTolerance` over `Angle`. Typing them makes a `Number` measured against an `AngleTolerance` a
type error. A new stdlib type `RoundingTolerance`, built by `Rounding(magnitude)`, marks bounds
that absorb rounding only; the verifier judges those in the primary profile and every other
tolerance comparison against a re-evaluation in the reference profile, so the distinction must be
in the type. The stdlib's own `LawEq` (`|a - b| <= max(|a|, |b|) 1e-4 + 1e-4`) is the pattern
this removes.

**Use.**

```plato
PointLiesOnCurve(m: BrepModel, d: EdgeDiscretization, i: Integer): Boolean
    requires m.IsEvaluable(d)
    requires d.Points.IsValidIndex(i)
    => d.Points[i].Within(m.PointOnEdge(d.Edge, d.Parameters[i]), m.Tolerances.Length);

ensures PeriodicDistance(result, t, period) <= Rounding(t.Abs + period)     // Wrap
```

Layer 4's criteria fields (`Chordal`, `Angular`, `MaxLength`) become tolerance-typed so their
comparisons are recognized and reported apart from the model's tolerances.

## 2. Types

### 2.1 `invariant`

**What.** Clauses after the `implements` list and before the body, on products and sums alike,
each a `Boolean` expression over `self`. Clauses are read in order; a later one may assume the
earlier. An invariant may not construct a value of its own type, directly or through calls.
Interfaces have no invariants: an interface is a constraint, not a set of values.

**Meaning.** Every value of the type satisfies every invariant. Values never change, so the
obligation is exactly: at each construction site (the derived constructor, a tuple converted at a
typed boundary, a sum-case factory, a derived setter, host code) the new value satisfies them. The
checked build checks there; the verifier discharges statically what it can.

**Why.** The design's first move is "tolerances as types", and the laws that say a tolerance is
positive and finite are the most repeated statements in layer 0: four `Law_*Positive` functions,
cited by 11 invariant blocks and as `requires` on most contracts. On the type, the promise is
stated once and every contract that took `tol.IsWellFormed` as a guard drops it.

**Use.**

```plato
// The largest distance, in the model's length unit, at which two points count as the same
// point: the STEP file's uncertainty_measure_with_unit for length.
type LengthTolerance
    implements IValue, ITolerance<Number>
    invariant self.Value.IsFinite
    invariant self.Value >= Number.SmallestNormal
{
    Value: Number;
}

type EdgeDiscretization
    sealed by Discretize, RefineEdge, Reversed, AlongCoedge
    invariant self.Parameters.Count == self.Points.Count
    invariant self.Parameters.Count >= 2
    invariant all i in (self.Parameters.Count - 1).Range: self.ParametersStrictlyMonotone(i)
{
    Edge: BrepEdgeIndex;
    Parameters: Array<Number>;
    Points: Array<Point3D>;
    RunsAlongCurve: Boolean;
}
```

**A rule for data from files.** A type whose values the STEP decoder builds from the file
(`Tolerances`, `SegmentFloors`, every Part 21 record) carries no invariant: its well-formedness is
a predicate and a validator check, reported as a diagnostic. An invariant is a promise the library
keeps, not a hope about input. This keeps "diagnostics, never exceptions" (README) without a guard
at every decoder site.

### 2.2 `sealed by`

**What.** `sealed by F, G` names the only functions whose bodies may construct the type. Every
overload of a named function returning the type counts. Anywhere else, a construction, tuple
conversion, derived setter or `default` of the type is a compile error. Opt-in; a type without it
is constructed freely, as today.

**Why.** Three things an invariant cannot give. First, properties relating a value to the arguments
it was built from: `Check.Holds` is exactly `Worst <= bound`, but `bound` is not a field, so no
invariant can say it; sealing plus the constructors' `ensures` can. Second, induction: if each
sealed constructor establishes a property given it of any argument of the same type, every value
has it, which turns layer 0's three "convention laws" into theorems and the README's open question
8 (does every `Check_` build through `CheckWithin`, `CheckExact` or `WorseOf`?) into a compile
error. Third, a generator for free: random compositions of the constructors yield only values the
library could build (section 4.4).

**Use.**

```plato
type Check
    sealed by CheckWithin, CheckExact, WorseOf
    invariant self.Worst.IsNaN implies !self.Holds
{
    Law: String;
    Holds: Boolean;
    Worst: Number;
    Where: Provenance;
}

type Report
    sealed by Empty, Merge, ReportOf
    invariant all k in self.Checks.Count.Range:
        self.Checks[k].Holds || any d in self.Diagnostics: d.Code == self.Checks[k].Law
{
    Checks: Array<Check>;
    Diagnostics: Array<Diagnostic>;
}
```

A sealed constructor that is still `deferred` (`Discretize`, `RefineEdge`) contributes nothing to
the derived generator until it has a body or a `reference` body; the verifier says so.

### 2.3 Derived `CanConstruct` and `IsWellFormed`

**What.** For a type with invariants the compiler derives a static `T.CanConstruct(fields...)`,
which evaluates the invariants on would-be fields, and `IsWellFormed(self: T)`, the conjunction
over an existing value. Both are ordinary functions, callable from code.

**Why.** `CanConstruct` makes official the stdlib's convention for partial operations (`CanInvert`
beside `Invert`, SEMANTICS.md section 8) and gives the decoder its guard:
`LengthTolerance.CanConstruct(v) ? ... : <diagnostic>` yields a diagnostic for a malformed file and
discharges the construction obligation syntactically. `IsWellFormed` replaces the nine hand-written
predicates in layer 0 that restate what the invariants now say, and is what a validator calls on
plain data.

**New promises are new nominal types.** Layer 4 had to weaken `EdgeDiscretization`'s invariant
from "strictly increasing" to "strictly monotone" because `Reversed` builds the other direction,
and then repeat "canonical" as an `ensures` on four functions. In a nominal language the stronger
promise is its own type, `CanonicalDiscretization { Value: EdgeDiscretization; }` with
`invariant self.Value.RunsAlongCurve`, returned by `Discretize` and stored by
`EdgeDiscretizations`. No feature is needed for this; the invariant clause makes it cheap.

## 3. Functions

### 3.1 `requires` and `ensures`

**What.** Clauses after the return type and any `where` bound, before the body: the same slot the
grammar already reserves for bounds (`MethodDeclaration` is signature, `ConstraintList`, body).
`requires e` is the caller's obligation; `ensures e` is the function's, whenever every `requires`
held, and may name `result`. Clauses are read in order and each may assume the earlier ones.
Clauses are evaluated with contract checking off, so a clause that calls a function under contract
does not recurse into that function's clauses.

**Why.** The sandbox's contracts live in spec files that repeat 68 signatures; a contract that
drifts from its declaration is caught only by a reader, and the spec files must be excluded from
every front-end run. On the declaration the reviewer reads the promise beside the signature, and
an agent editing a body sees what it must keep. Purity makes the clauses cheap to mean: no
`old()`, no frame condition, no aliasing. The evaluation rule matters for the library:
`EdgeSeeds`' postcondition compares against `m.WithEdgeReversed(e).EdgeSeeds(e)`, and with
checking on inside clauses that check would never end.

**Use.**

```plato
// The representative of t modulo period in [0, period).
Wrap(t: Number, period: Number): Number
    requires t.CanWrap(period)
    ensures result >= 0.0 && result < period
    ensures PeriodicDistance(result, t, period) <= Rounding(t.Abs + period)
{
    var r = t - period * (t / period).Floor;
    var s = r < 0.0 ? r + period : r;
    return s >= period ? s - period : s;
}

CheckWithin(law: String, worst: Number, bound: Number, where: Provenance): Check
    ensures result.Holds == (worst <= bound)
    ensures result.Law == law
    ensures result.Worst === worst
    => Check(law, worst <= bound, worst, where);
```

A checked build checks `requires` at entry, blaming the caller, and `ensures` at exit, blaming the
function. A release build checks nothing. A failure is a defect of the program, reported through
the host; bad data stays a diagnostic.

### 3.2 `decreases`

**What.** On a recursive function or a `while` loop, `decreases e`: a non-negative quantity that
strictly decreases at each recursive call or iteration. Checked per call or iteration in checked
builds; translated to `termination_by` for Lean.

**Why.** Theorem `DiscretizeTerminates` is today a paragraph of prose whose claim no test can
establish, because it assumes a bound over every discretization of the edge. The bisection loop
inside `Discretize` and `RefineEdge` has a measure the implementer knows: the number of segments
still longer than the effective minimum length. Naming it turns a hang into a located failure.

**Use.**

```plato
RefineEdge(m: BrepModel, d: EdgeDiscretization, c: DiscretizationCriteria, segments: Integer): EdgeDiscretization
    requires m.CanDiscretize(d.Edge, c)
    requires d.RunsAlongCurve
    decreases segments - d.SegmentCount
    ...
```

The sandbox's `measure` clause (39 uses) becomes `decreases` where the function recurses or loops,
and otherwise a comment (section 8).

### 3.3 `deferred`

**What.** `deferred "<algorithm family>"` in place of a body. A release build that reaches a
deferred function is an error naming it. In checked and verification builds, every statement whose
closure reaches a deferred function is reported "blocked by" it, and the function traps when called
unless it has a `reference` body.

**Why.** Today a bodiless function is an intrinsic obligation the host fulfils (SEMANTICS.md
section 3). The sandbox has 68 of them meaning "not written yet", and they pass every gate and
degrade at code generation into a throwing member or a self-calling stub (PLATO-PRIMER.md D.7).
Separating the two makes "blocked by `Discretize`: 31 statements" a progress meter for TASKS.md.

**Use.**

```plato
// Constrained Delaunay triangulation of a simple polygon with holes, boundary fixed.
TriangulateRegion(r: UvRegion, interior: Array<UvCoordinate>): UvTriangulation
    ensures result.BoundarySegmentsUsedOnce(r)
    ensures result.InteriorEdgesUsedTwice
    deferred "constrained Delaunay by Ruppert's algorithm, boundary fixed";
```

### 3.4 `reference` bodies

**What.** A function may carry, beside its body or instead of it, a slow and evidently correct
`reference => e` body, checked against the same contract. Before the real body exists the
reference stands in for it; once both exist the verifier compares them on every case where the
contract fixes a unique result.

**Why.** Layers 5 and 6 cannot be tested until layer 4's `Discretize` exists, unless something
stands in for it. A reference body is Kani's "stub by a verified contract" with a body instead of
a contract. Where the result is unique it is also a differential oracle without an external kernel,
which matters since OpenCascade is excluded (PLAN.md).

**Use.**

```plato
// The exact sagitta of the arc between two parameters: its Hausdorff distance from its chord.
Sagitta(m: BrepModel, e: BrepEdgeIndex, t0: Number, t1: Number): Number
    requires m.IsEdgeEvaluable(e)
    ensures result >= 0.0
    reference => m.DenselySampledSagitta(e, t0, t1, 4096)
    deferred "closed form for line, circle and ellipse; control-hull bound per Bezier span";
```

### 3.5 Contracts and laws on interface members

**What.** A member of an `interface` may carry `requires` and `ensures`; an `interface` may declare
`law`s (section 4.1). Both are stamped onto every implementing type and checked on each
monomorphized instance. An implementation's own `requires` must follow from the interface's.

**Why.** The stdlib already writes generic laws over interfaces, but in a separate file that is not
a tier (`stdlib/tests/foundation.laws.plato`, 27 of them). Inside the interface the law travels
with the obligation it constrains, and a new implementer inherits it.

**Use.**

```plato
interface IMetricSpace
{
    Distance(a: Self, b: Self): Number
        ensures result >= 0.0 || result.IsNaN;

    // The order of the arguments does not change the distance, bit for bit.
    law DistanceIsSymmetric(a: Self, b: Self)
        => Distance(a, b) === Distance(b, a);
}
```

For `Point3D`, `a - b` and `b - a` differ only in sign, so the law holds exactly and layer 0's
`Law_CoincidentIsSymmetric` becomes a consequence.

## 4. Declarations

All four live inside `library` blocks (laws also inside `interface` blocks), so STY005, one kind of
declaration per file, still holds: a `*.laws.plato` file is a library of laws, theorems,
conjectures, witnesses and generators. Laws, theorems and conjectures are not callable from code
and have their own name space; witnesses and generators are callable (a witness is a static
constant) and share the function name space.

### 4.1 `law`

**What.** Shaped like a function: parameters are universally quantified, `requires` clauses are
the guards, the body is the claim. A parameter may name a domain, `p: T in e`, evaluated after the
earlier parameters, or a generator or witness, `p: T from G`. Without an annotation a parameter is
drawn from `T`'s pool: every witness and generator declared for `T`, plus a derived generator when
`T`'s structure allows one. A finite domain with few elements is enumerated, which is a proof by
exhaustion. The verifier counts cases that passed the guards, fails a law whose claim was never
evaluated, and warns above 90 % discards. A `law` may claim a route, `by exhaustion` or `by smt`,
which the verifier enforces.

**Why.** The convention cannot tell four things apart: a predicate over data, a convention that
holds for values the layer builds, a library law, and a theorem. Counting layer 4, 25 of its 35
`Law_` functions are predicates (an arbitrary polyline does not lie on the curve), and a runner
that quantifies them universally produces false failures or vacuous passes. In the language a
predicate is a `Boolean` function with `requires`; a convention is an invariant or an `ensures`; a
law is a `law`. Domains answer the other failure of today's runner: every `Number` is drawn from
[-10, 10] and every typed index from [-8, 8], so a law over `BrepModel` never runs at all.

**Use.**

```plato
// Adding a period does not change the wrapped value, measured around the circle.
law WrapIgnoresWholePeriods(t: Number, period: Number, tol: ParameterTolerance)
    requires t.CanWrap(period)
    requires (t + period).CanWrap(period)
    requires tol.IsResolvable(t.Abs + period)
    => PeriodicDistance((t + period).Wrap(period), t.Wrap(period), period) <= tol;

// A tighter chordal bound never yields fewer points, the other criteria and the floors fixed.
law TighterChordalNeverFewerPoints(m: BrepModel from ArcEdgeModels, e: BrepEdgeIndex in m.EdgeIndices,
        c: DiscretizationCriteria, floors: SegmentFloors, chordal: LengthTolerance in Below(c.Chordal))
    requires m.CanDiscretize(e, c)
    => m.Discretize(e, c.WithChordal(chordal), floors).Parameters.Count
        >= m.Discretize(e, c, floors).Parameters.Count;

// A law with no parameters is a unit test with a known answer.
law UnitBoxEulerCharacteristic => BrepModel.UnitBox.EulerCharacteristic == 2;

// Sagitta's existential, restated as a bound over a continuous domain the verifier owns.
law SagittaBoundsEveryChordPoint(m: BrepModel, e: BrepEdgeIndex in m.EdgeIndices,
        t0: Number in m.EdgeDomain(e).Range, t1: Number in m.EdgeDomain(e).Range,
        f: Number in NumberInterval(0.0, 1.0))
    => DistanceToSegment(m.PointOnEdge(e, t0), m.PointOnEdge(e, t1), m.PointOnEdge(e, t0 + (t1 - t0) * f))
        <= m.Sagitta(e, t0, t1) + m.Tolerances.Length;
```

### 4.2 `theorem` and `conjecture`

**What.** A theorem is a law with `because "<proof sketch>"`, optionally `tested by <laws>` (laws
that exercise instances by another route; the checker requires that they resolve) and a claimed
route: `by exhaustion`, `by smt`, or `proof "<file.lean>"`. A conjecture has no `because`; its
failure is a finding, not a failed build. A theorem whose assumptions and conclusion are computable
runs as a law until it is proved; one that is not (it assumes a property of every value of a type)
is reported "stated" and its `tested by` laws carry the evidence. An existential is stated by
exhibiting the witness in the body.

**Why.** Of the 41 theorems in the spec files, the ones that matter most are the index-level ones
(`SharedPolylineClosesEveryEdge`, and layer 8's `WatertightByConstruction`), whose proofs run with
`Number` opaque and so hold at every precision; a theorem that merely names its justification is
read, and a claimed route is checked. `conjecture` gives the design a place for the two open
questions SPEC-EXECUTION.md 4.5 names (several parameter-space points mapping to one vertex at a
pole; what `TriangulateRegion` promises about boundary segments) without pretending they are known.

**Use.**

```plato
// The sharing principle: the two faces of an edge meet point for point.
theorem SharedPolylineClosesEveryEdge(m: BrepModel, ds: EdgeDiscretizations,
        b1: FaceBound, c1: Coedge, b2: FaceBound, c2: Coedge, k: Integer)
    requires DiscretizationsCoverEdges(m, ds)
    requires c1.Edge == c2.Edge
    requires m.CoedgeRunsForwardOnCurve(b1, c1) != m.CoedgeRunsForwardOnCurve(b2, c2)
    requires ds.ByEdge[c1.Edge].Points.IsValidIndex(k)
    => m.AlongCoedge(ds.ByEdge[c1.Edge], b1, c1).Points[k]
        === m.AlongCoedge(ds.ByEdge[c1.Edge], b2, c2).Points[ds.ByEdge[c1.Edge].Points.Count - 1 - k]
    because "AlongCoedge returns the stored discretization when the coedge runs with the curve and
             its reversal otherwise; the two coedges run opposite ways, and Reversed copies without
             arithmetic, so point k of one is point count - 1 - k of the other."
    tested by ReversedReversesPoints
    by smt;

// Coincidence has no equivalence classes: welding by distance depends on the order of the welds.
theorem CoincidenceIsNotTransitive(t: LengthTolerance)
    => Point3D(0.0, 0.0, 0.0).Coincident(Point3D(0.75 * t.Value, 0.0, 0.0), t)
    && Point3D(0.75 * t.Value, 0.0, 0.0).Coincident(Point3D(1.5 * t.Value, 0.0, 0.0), t)
    && !Point3D(0.0, 0.0, 0.0).Coincident(Point3D(1.5 * t.Value, 0.0, 0.0), t)
    because "|a - b| = |b - c| = 0.75 t <= t and |a - c| = 1.5 t > t.";

theorem IsCleanIsAMonoidHomomorphism(a: Report, b: Report)
    => Merge(a, b).IsClean == (a.IsClean && b.IsClean)
    because "The diagnostics of Merge(a, b) are those of a followed by those of b."
    proof "proofs/Foundation.lean";
```

### 4.3 `witness`

**What.** A named value of a type, or a family with parameters drawn from domains like a law's.
A closed witness is evaluated at compile time and its type's invariants checked, so a malformed
witness is a `plato check` finding. `violates P, Q` names predicates over the type that the
witness must fail, and the verifier checks that it fails exactly those.

**Why.** Pseudorandom instances of constrained types are garbage (random 12-vertex polygons are
simple 0.03 % of the time, VALIDATION-MATH.md 7.1), so every law over a model runs over witnesses.
Today a witness is a static function by naming convention, never checked against anything.
Negative witnesses give the validation layer its discrimination matrix (which check catches which
defect) from declarations.

**Use.**

```plato
// The domain of a full circle: [0, 2 pi] with period 2 pi.
witness FullCircleDomain: CurveDomain
    => CurveDomain(NumberInterval(0.0, Number.Tau), Periodicity.Periodic(Number.Tau));

// A torus of major radius R and minor radius r, as a closed B-rep.
witness Torus(R: Number in Magnitudes(1e-2, 1e4), r: Number in NumberInterval(1e-3 * R, 0.9 * R)): BrepModel
    => ...;

// A unit box with its top face removed: one open shell, four edges used once.
witness BoxMissingFace: BrepModel
    violates EveryEdgeUsedTwice, ShellIsClosed
    => ...;
```

### 4.4 `generator` and `draw`

**What.** A block-bodied declaration whose `var` statements may use `draw D`, where `D` is a value
of a type implementing a stdlib interface `IDomain<T>` (integer ranges, closed intervals,
`Magnitudes(lo, hi)`, `OneOf`, `ArrayOf`, every type with a pool, every generator). The elaborator
threads an implicit sequence of integer choices through the body: each `draw` consumes some and
maps them to a value with exact operations only. `draw` is permitted nowhere else.

**Why.** Three consequences of the choice-sequence design (Hypothesis's) that the library needs.
A generator is a pure function of its choices, so it compiles into every backend and one choice
sequence yields bit-identical inputs in C#, TypeScript and the evaluator. Shrinking works on the
choice sequence and every candidate goes back through the generator, so every shrunk value is a
valid model: "shrink the generator, not the model" becomes the only way. A counterexample is a
generator name and a short list of integers, replayable anywhere. Together with parameterized
witnesses, transform generators (the 24 cube rotations, scaling by powers of two) and the sealed
constructors of section 2.2, this is how a law over `BrepModel` gets thousands of inputs instead
of eight.

**Use.**

```plato
// A model with one circular edge of drawn radius and sweep, moved by a drawn rigid motion.
generator ArcEdgeModels: BrepModel
{
    var radius = draw Magnitudes(1e-3, 1e5);
    var sweep = draw AngleInterval(0.001.Turns, 1.0.Turns);
    var motion = draw RigidMotions;
    return ArcStripModel(radius, sweep).Transformed(motion);
}
```

Every generated value is checked against its type's invariants; a violation is a defect of the
generator, not of the law.

## 5. What the front end checks

All in the edit loop, before anything runs.

| Construct | Checked |
|---|---|
| `invariant` | `Boolean`; mentions only `self` and functions; total under earlier clauses; constructs nothing of its own type |
| `sealed by` | each name is a function returning the type; no construction, tuple conversion, setter or `default` elsewhere |
| `requires`, `ensures` | `Boolean`; `result` has the return type; total under the earlier clauses |
| `decreases` | numeric; only on a recursive function or a loop |
| `deferred` | no body; a description present |
| `law`, `theorem`, `conjecture` | every parameter has a non-empty domain; guards and claim `Boolean` and total; not called from code; `tested by` names resolve; a `proof` file exists |
| `witness` | its type; parameter domains; `violates` names predicates over the type; closed witnesses satisfy their invariants (by evaluation) |
| `generator` | `draw` only here; domain types match |
| tolerance comparison | the measure's type is the tolerance's `M`; no literal bound in a specification |
| `===` | both sides of one type |
| `==` on a `Number`-bearing type in a specification | warning: `===` or a tolerance |
| `all`, `any` | finite domain in code and in contracts; continuous only in a law's body |

"Total" is guard dominance: every array index, integer division and sum projection in a
specification sits under an earlier `requires`, the left operand of `&&`, an `implies` antecedent,
a quantifier's domain, or a conditional's test. It is SPEC-DSL.md's rule "a law is total; guards
do that work", enforced. The 14 uses of the undeclared `UpTo`, and the five defects the first
version of SPEC-EXECUTION.md found by reading, are what this stage reports.

## 6. What each build emits

| Construct | Release | Checked | Verification | SMT and Lean |
|---|---|---|---|---|
| `invariant` | nothing | a check in each constructor, blaming the constructing function | the same, and the invariant as a predicate | obligations; axioms of the type |
| `requires`, `ensures` | nothing | entry and exit checks with blame | the same; the harness calls the function on generated arguments | verification conditions |
| `decreases` | nothing | a check per call or iteration | the same | termination argument |
| `deferred` | build error | the `reference` body, or a trap | the same, and "blocked" statuses | an opaque function with its `ensures` as axioms |
| `law`, `theorem` | nothing | nothing | a function and a manifest entry | a VC, or a Lean `theorem` |
| `witness`, `generator` | nothing | nothing | functions and manifest entries | model finding feeds the pools |
| tolerance comparison | a comparison | a comparison | a comparison that logs measure and bound | a comparison in Real or FP |

The checked build is a named profile, not the host's Debug configuration.

## 7. Migrating the sandbox

The `*.spec.plato` files disappear: invariants and seals move into `*.types.plato`, contracts onto
their functions in `*.library.plato`, theorems into `*.laws.plato` beside the laws, witnesses and
generators. A rewrite tool does it once per folder, and the sandbox writes its current files so the
rewrite is mechanical (SPEC-EXECUTION.md 7.3 lists the twelve rules). The mapping:

| Today | Proposed |
|---|---|
| `spec T { invariant e; constructor F; }` | `invariant e`, `sealed by F` on `type T` |
| `spec F(...) { requires; ensures; measure; deferred; }` | clauses on `F`; `measure` to `decreases` or a comment |
| `Law_X` marked model | a predicate, with its guards as `requires` |
| `Law_X` marked convention | an invariant or a constructor's `ensures` |
| `Law_X` marked library | `law X` |
| `theorem { given; assume; conclude; because; tested by; }` | parameters, `requires`, body, `because`, `tested by` |
| `Witness_X(_: T): T` | `witness X: T` |
| `forall (i: Integer) in D : e` | `all i in D: e`; a domain-less `forall` takes the cited law's guard as its domain |
| `exists` with a witness term | the witness in the body; without one, a law over the continuous domain |
| `a.Identical(b)`, `SameDiscretization`, `== // exact by construction` | `===` |
| `measure <= tol.Value` | `measure <= tol` |

First milestone, as SPEC-EXECUTION.md 7.4: `00-foundation` in the new syntax; `plato check` clean;
a status for every statement; the two subnormal failures the layer author found with 300,000
hand-written draws rediscovered from the declarations alone; one theorem proved in Lean.

## 8. Departures from SPEC-EXECUTION.md

Each with its reason, so the owner can reverse it.

1. **No `~=` and `within` operators.** Plato's rule is that operators are names of functions; a
   tolerance comparison needs only the `ITolerance<M>` interface, overloads of `LessThanOrEquals`,
   and a `Within` function. The language change shrinks to recognition in the elaborator.
2. **Continuous quantifiers only in law bodies, not in contracts.** SPEC-EXECUTION.md 2.3 lets a
   checked build sample an `ensures` over an interval "by a fixed plan". A contract's meaning
   would then depend on the verifier's plan, and the library already names its plans explicitly
   (`SamplePlan`). `Sagitta`'s existential becomes a law (section 4.1).
3. **Clauses evaluate with checking off.** Not stated there; without it `EdgeSeeds`' postcondition
   recurses forever in a checked build.
4. **`cost` is left out.** It is the one clause the compiler would type but never check, and the
   growth test it serves is ranked last of twelve use cases (SPEC-EXECUTION.md section 6). Until
   that test exists it is a comment; a clause nobody checks teaches authors that clauses may be
   decorative.
5. **Types built from file data carry no invariants** (section 2.1). SPEC-EXECUTION.md 2.4 makes
   every construction an obligation and guards the decoder with `CanConstruct`; this proposal keeps
   the SPEC-DSL distinction between a promise and a validated property, so that `Tolerances` and
   the Part 21 records need no guard and no invariant.
6. **`IsWellFormed` is derived beside `CanConstruct`** (section 2.3), since plain data still needs
   the predicate.
7. **`===` on existential fields is defined** (dynamic type, then value); SPEC-EXECUTION.md says
   "derived for every type" without saying how.
8. **Laws have their own name space.** They are not callable, so dropping the `Law_` prefix
   cannot collide with a function; open question 7 of SPEC-EXECUTION.md section 8 falls away for
   laws and remains only for witnesses.
9. **A deferred sealed constructor is excluded from the derived generator** (section 2.2); the
   document's "a generator for free" assumes every constructor has a body.
10. **Counts updated.** All seven layers: 376 `Law_` (was 201), 394 guard tails (187), 450
    `forall` (207), 15 `exists` (5), 41 theorems (26), 68 `deferred` (27). The proportions the
    argument rests on did not move.

Two names collide and should be settled with the grammar: the quantifier `all x in xs: e` beside
the fold `xs.All(f)`, and the law-parameter `in` beside the quantifier's `in`. Both read naturally;
the checker must simply not confuse them.

The open questions of SPEC-EXECUTION.md section 8 stand, less number 7; the facts that settle
each are listed there.
