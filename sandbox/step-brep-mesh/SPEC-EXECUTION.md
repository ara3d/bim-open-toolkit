# Specification and verification in Plato

Written 2026-10-17 for TKT-299 (the STEP B-rep to mesh design in this sandbox); second version. It
answers one question for the owner of Plato: which specification and verification system makes
**creating and validating** a large pure-functional geometry library most efficient once code
generation works well, and what Plato must become to support it. The library is this sandbox's
design first and the Plato stdlib after it.

The first version asked how to make the sandbox's spec DSL executable with the least change, and
recommended leaving Plato alone: a tool would rewrite spec clauses into `Law_` functions, and syntax
would move into the language after a cycle. The owner rejected that framing (PLAN.md, "Decided by the
owner during the pass"). Plato, its parser (`parakeet`), its elaborator, checker, writers, intrinsics
and law runner are the owner's, so every gap is work to schedule. A second correction followed: assume
the trivial compiler, writer and runner defects fixed, list them once (section 9.2), and judge each
construct as language design (coherence with Plato's model, expressiveness, how a reader understands
a spec, how an author and an agent work with it, what the compiler can check) rather than by what it
costs to build. This version is written to both corrections. The measured facts of the first version
are kept in section 9; its prior-art survey, its classification of what is provable, and its test
generation measures are kept and extended.

Evidence tags. **[R]** read in a file named in the text. **[M]** counted or measured during this
research; the method is stated. **[W]** an external source, numbered in "Sources". **[J]** my
judgement, with reasons. Plato paths are relative to `C:\Users\cdigg\git\plato` at commit
`f6e02cf0`; sandbox paths are relative to this folder. Code marked *illustrative* shows the shape of
an output that does not exist yet; its numbers are invented for the example.

Terms used throughout:

- **Statement**: anything the system checks. Five kinds, distinguished in section 2.2: a
  *predicate* (a Boolean function over data), a *contract clause* (`requires` or `ensures` on a
  function), a *type invariant*, a *law* (a universally quantified property of the library's
  functions), and a *theorem* or *conjecture* (a law with a justification, or flagged as open).
- **Obligation**, or **verification condition (VC)**: a formula that must be valid for a statement to
  hold at one place, such as "at this construction site the new value satisfies the type's
  invariant". To **discharge** an obligation is to show it valid by some engine.
- **Engine**: one way of discharging obligations: the type checker, evaluation, an SMT solver, a
  proof assistant, or generated tests.
- **SMT solver** (satisfiability modulo theories): a program such as Z3, cvc5 or Bitwuzla that
  decides formulas over theories: **Int** (integers), **Seq** (sequences), datatypes, **Real**, and
  **FP** (IEEE floating point, bit-precise, the SMT-LIB FloatingPoint theory [W27]).
- **TIR**: Plato's typed intermediate representation, produced by the elaborator once overloads are
  resolved and conversions made explicit (`docs/compiler-pipeline.md`).
- **Evaluator**: an interpreter over TIR inside the compiler. It does not exist today (section 9.1);
  section 2.1 argues for it.
- **Profile**: how a compilation or an evaluation represents `Number`: *binary64* (the default on
  CPU backends), *binary32* (GPU), *reference* (a wider format used only by the verifier, such as
  double-double with about 106 significand bits), *interval* (an enclosure of the exact value).
- **Checked build**: a compilation that checks contracts and invariants at run time. **Release
  build**: one that checks nothing. **Verification build**: one that also contains the laws,
  witnesses and generators and a small harness the verifier drives.
- **Witness**: a named, well-formed example value of a type. **Generator**: a function that builds
  values of a type from random choices. **Choice sequence**: the list of integers a generator
  consumed; replaying it rebuilds the value. **Shrinking**: reducing a failing case to a smaller one
  that fails the same way.
- **Vacuity rate**: the share of generated cases a law's guards rejected, so its claim was never
  evaluated. **Margin**: a tolerance comparison's measure divided by its bound; above 1 fails.
- **Metamorphic relation**: a rule relating the outputs of two runs on related inputs (rotate the
  input, the output rotates). **Mutation testing**: changing the code under test in small ways and
  counting the changes the statements detect.
- **Blame**: which function a contract failure is charged to (Findler and Felleisen [W28]).

## 0. The answer in brief

**Put the specification language into Plato**, as clauses and declarations that the same front end
parses, binds and type-checks as code, and build **one verifier**, `plato verify` (the Plato.Verify
engine that `tracker/issues/plato-390.md` proposes), which discharges each statement by the strongest
engine that can and reports every statement's status: proved, solved, exhausted, tested, stated,
blocked, or failed. The first version's architecture question (new syntax, a separate language, or
convention plus tooling) is settled for option A, new syntax inside Plato, because the owner controls
every part of the toolchain and the language-level form is the one a compiler can check (section 10).

The language additions:

1. **On types**: `invariant e` clauses, and `sealed by F, G`, which permits only the named functions
   to construct the type.
2. **On functions**: `requires e`, `ensures e` (with `result`), `decreases e`, `cost e`, and
   `deferred "<algorithm family>"` in place of a body, distinct from a bodiless intrinsic.
3. **Declarations** inside `library` and `interface` blocks: `law`, `theorem` and `conjecture`, all
   shaped like functions (parameters universally quantified, `requires` as guards, the body as the
   claim), with `because`, `tested by`, and a claimed proof route (`by exhaustion`, `by smt`,
   `proof "<file>"`); `witness` and `generator`, with a `draw` expression in generator bodies.
4. **Expressions**: `&&` and `||` short-circuit on `Boolean`; `a implies b`; bounded quantifiers
   `all x in D: e` and `any x in D: e`; `a === b`, bitwise identity derived for every type; tolerance
   comparisons `measure <= tol` typed by a stdlib interface `ITolerance<M>`, and `a ~= b within tol`.
5. **Law parameters** may name a domain (`e: BrepEdgeIndex in m.EdgeIndices`) or a generator
   (`m: BrepModel from ArcEdgeModels`).

The machinery behind them:

- a **TIR evaluator** in the compiler: the definitional semantics, the inner loop's backend (no code
  generation or host build between an edit and a verdict), compile-time evaluation of witnesses and
  constant construction sites, explanation traces, and the reference and interval profiles;
- **checked and verification builds** in every writer, driven through one small JSON protocol;
- an **SMT translator** with a content-hash cache, and a **Lean 4 translator** for theorems;
- an **orchestrator**: witness pools, generators over choice sequences, shrinking, vacuity and margin
  accounting, three-valued verdicts, cross-backend comparison, mutation testing, and one report,
  exposed as a CLI and as an MCP tool `plato_verify` beside `plato_check`.

Three judgements shape the design [J]:

- **Obligations are discharged outside the type checker.** Type checking stays nominal, decidable and
  fast enough for an edit loop; there are no refinement types and no SMT solver inside it. This is the
  Ada 2012 and SPARK model (contracts in the language, proofs by a separate tool) rather than the
  Liquid Haskell model (section 2.13).
- **Plato's purity makes this unusually cheap to get right.** There is no `old()`, no frame
  condition, no aliasing; a VC for an expression body is a substitution; and an invariant established
  at construction holds for the value's lifetime, because values never change.
- **Test first, prove where it pays.** Most of this library's statements are geometric and stay
  empirical. The system makes empirical evidence as strong and as fast as it can (generators that
  respect constraints, shrinking, worst-case search, verdicts aware of rounding, agreement across
  backends, mutation scores), and proves the combinatorial core.

**First end-to-end milestone** (section 7.4): `00-foundation` rewritten into the new syntax;
`plato check` clean in under 2 s warm; `plato verify` reports a status for every statement, from the
evaluator, C# and TypeScript; the two subnormal failures the layer's author found with a hand-written
C# fuzzer of 300,000 draws are rediscovered automatically and shrunk once the guard that fixed them is
removed; and one theorem is proved in Lean.

The fixes this design assumes are listed once, in section 9.2.

## 1. The target experience

This section is the specification the rest of the document serves. Times are budgets for a warm
session on the owner's machine; section 9.1 gives today's measurements they are set against.

### 1.1 An author writes a type, a function and a law

A person or an agent adds a function with its contract and a law to `foundation.library.plato` and
`foundation.laws.plato`.

1. **Save, then check: at most 2 s.** The editor, or the agent through `plato_check`, runs the front
   end over the changed declarations and their dependents. In one list, at source locations: names
   bind; types agree; each `requires` makes the indexing after it total; `result` has the declared
   type; the measure in `PeriodicDistance(...) <= Rounding(...)` is a `Number` and the bound a
   tolerance over `Number`; every law parameter has a domain or a generator; no literal epsilon
   appears in a comparison. Spec mistakes such as the 14 uses of the undeclared `UpTo` in
   `discretization.spec.plato` [M] surface here.
2. **Verify what changed: at most 10 s.** `plato verify --changed` (MCP: `plato_verify` with scope
   `changed`) finds the statements whose TIR closure changed, discharges what it can statically
   (finite enumeration; cached SMT results), then runs the rest on the evaluator over every witness
   and 200 generated cases each, shrinks the first counterexample, and returns.

   *Illustrative output*, after an edit that dropped `Wrap`'s second correction step:

   ```
   plato verify --changed     00-foundation, backend eval, 6.1 s
     Wrap ensures 1                       FAILED     eval, case 7 of 200
       t = -1.0e-300, period = 1.0                        shrunk from 23 choices in 38 steps
       result = 1.0; (result < period) = false
       Wrap: t / period = -1.0e-300; Floor = -1.0; r = t + 1.0 = 1.0 (rounded); s = r; returned s
       replay: plato verify --replay f3a91c --explain
     law WrapLandsInPeriod                FAILED     the same case; blame: Wrap
     law WrapIgnoresWholePeriods          tested     200 cases, vacuity 22 %, worst margin 0.31
     ShortestDifference ensures 2         solved     SMT FP64, 0.4 s (cache miss)
   ```
3. **Fix and repeat.** The replay command reruns exactly that case on any backend, with an
   explanation trace: the value of every subexpression of the failing clause, in the manner of power
   assertions [W29].

### 1.2 A reviewer reads a spec

A reviewer opens `04-discretization/discretization.library.plato`. Each function's contract sits
between its signature and its body; there is no second file to cross-reference. Hovering over a
clause (Navigation, fed by the last report) shows its status and evidence. The layer's README carries
a generated table between markers, refreshed by `plato doc`:

*Illustrative:*

| Statement | Kind | Status | Evidence |
|---|---|---|---|
| `Reversed` ensures 1 to 5 | contract | solved | SMT Seq, 0.6 s |
| `law ReversedIsInvolution` | law | solved | SMT Seq; also tested, 600 cases, 4 backends |
| `theorem SharedPolylineClosesEveryEdge` | theorem | proved | Lean, `Number` opaque, `proofs/Discretization.lean` |
| `Discretize` ensures 12 (sagitta) | contract | tested | 3,100 calls, 9 generators, worst margin 0.97, 0.4 % within rounding |
| `law TighterChordalNeverFewerPoints` | law | blocked | by `Discretize`, deferred |
| `theorem DiscretizeTerminates` | theorem | stated | no proof; not executable as written, since it assumes a bound over every discretization of the edge |

What is proven, what is tested and on what, and what is merely stated is answered by the table, not by
the reader's reconstruction.

### 1.3 An implementing agent fills in a deferred function

The agent's task from TASKS.md is "implement `Discretize`". Its loop:

1. `plato_check`, at most 2 s.
2. `plato_verify` with `function: "Discretize"`, at most 10 s on the evaluator: every pooled
   `BrepModel` value with every edge index in range, criteria drawn from their generators;
   `Discretize` is called; the result's type invariants, then each `ensures` clause in order, are
   checked; the first failing case is shrunk; the failure is charged by blame (a failing `requires` of
   a callee inside `Discretize` blames `Discretize`; a failing `ensures` of a callee blames the
   callee, so the agent does not debug the wrong layer).
3. The tool result carries the counterexample as data (*illustrative*):

   ```json
   { "status": "failed", "backend": "eval",
     "statement": "Discretize ensures 12 (04-discretization/discretization.library.plato:233)",
     "clause": "all i in result.SegmentCount.Range: SagittaWithinChordal(m, result, c, SamplePlan.DiscretizationPlan, i)",
     "blame": "Discretize",
     "case": { "id": "c7f3e0", "generator": "ArcEdgeModels", "choices": [3, 0, 17, 2],
               "shrunk_from_choices": 412,
               "inputs": { "m": "ArcEdgeModels(radius = 10.0, sweep = 0.75 turn, motion = identity)",
                           "e": 0, "c": "Chordal 0.01, Angular 0.5 rad, MinLength 0.001" } },
     "explain": { "i": 0, "SampledSagitta(m, result, plan, 0)": 0.0148,
                  "EffectiveChordal(c, m.Tolerances) + m.Tolerances.Length": 0.010001,
                  "IsAtLengthFloor(m, result, c, 0)": false },
     "margin": 1.48, "verdict": "fails",
     "replay": "plato verify --replay c7f3e0 --explain" }
   ```
4. Once the evaluator is green, `plato_verify` with `backends: ["cs"]` confirms on compiled C# in at
   most 30 s for one layer. The report also lists **surviving mutants** of the new body (section 4.6),
   which tell the agent where the contract is too weak to notice a change.

### 1.4 Continuous integration and release

- **Every push**: `plato verify --all --backends eval,cs` over the stdlib and every layer, at most 10
  minutes; SMT and Lean results come from the cache unless their inputs changed. The report is
  compared with the last committed one, and any statement whose status fell (solved to tested,
  tested to failed) fails the build: a ratchet.
- **Nightly**: adds TypeScript, Rust and C++, mutation testing, and targeted worst-case search.
- **Release**: `plato verify --release`: every law, contract and invariant on every backend over the
  same cases, results compared (section 5), the pipeline run end to end on the witness corpus and the
  public STEP files, and the report committed beside the release.

| Loop | Budget | Engine |
|---|---|---|
| Spec and code check of changed declarations | 2 s | front end, warm and incremental |
| Changed statements, one layer | 10 s | evaluator; SMT and Lean from cache, new obligations solved in parallel and streamed into the report |
| Confirmation on compiled C#, one layer | 30 s | verification build |
| Every statement, two backends | 10 min | CI |
| Every statement, five backends, mutation | hours | nightly, release |

## 2. The specification language as part of Plato

### 2.1 What Plato's model decides

| Property of Plato | Consequence for the specification language |
|---|---|
| Every value is immutable; every function is pure | Contracts refer to parameters directly; nothing needs `old()`, frame conditions, or alias reasoning. An invariant established when a value is constructed holds as long as the value exists, so checking at construction is complete. Specifications may call any function, so there is no separate ghost language as in Dafny or SPARK. |
| No exceptions (SEMANTICS.md section 8) | A contract violation is a defect in the program, not a value of the program: a checked build stops through the host with a structured report, a release build checks nothing. Bad *data* remains a diagnostic (the sandbox's decision "Diagnostics, never exceptions"); a decoder never relies on a `requires` to reject a malformed file. |
| Nominal typing, no subtyping | A constrained set of values is a named type with invariants, never a refinement subtype; a stronger promise is a new nominal type. Tolerance types give dimension checking by name. |
| Interfaces are type classes; generic code is monomorphized | Laws belong in interfaces as type-class laws and are stamped onto every implementing type, which the stdlib's law runner already does by convention (`stdlib/tests/foundation.laws.plato`, preamble). A `Number` profile is just another compilation. |
| One global namespace; no modules or visibility | Restricting construction names functions (`sealed by`), not a module boundary. |
| Bounds sit between signature and body (`where`) | Contract clauses take the same slot. SEMANTICS.md section 5 already calls a function's `where` bound "a precondition on inference, checked where inference happens"; `requires` is its value-level twin. The grammar's comments insist that type, interface and function declarations read alike (`PlatoGrammar.cs`, `ConstraintList`), so type invariants take the same slot too. |
| `match` lowers to a chain of conditionals with no new TIR node (`Elaborator.ElaborateMatch`) | `implies`, short-circuit `&&` and `||`, and bounded quantifiers lower the same way; only the constructs that tools must see (tolerance comparisons, contract lists, generator draws) need TIR of their own. |
| The host intrinsic kernel is meant to shrink (`plato-378`) | An evaluator needs only that kernel; mathematics implemented in Plato gives every backend the same bits (section 5). |

**Why an evaluator** [J]. Plato has no interpreter today: every execution goes through a writer and a
host compiler (searched `src/` and `writers/` for interpreter or evaluator classes, none found [M]). A
TIR evaluator removes code generation and the host build from the inner loop, which today cost 10.3 to
11.6 s for the foundation tier alone in C# (TARGET-LANGUAGE.md 2.2). It also gives the language a
definitional semantics that each backend is compared against, evaluates witnesses and constant
construction sites at compile time, produces explanation traces by recording subexpression values,
and hosts the reference and interval profiles without any writer knowing about them. Compiled
backends remain the evidence for performance and for agreement across languages; the evaluator is
where an author or agent learns, in seconds, whether a statement holds.

### 2.2 Five kinds of statement

The sandbox writes four different things as `Law_` functions, and the convention cannot tell them
apart. Section 4.1 of the first version saw this ("model laws are predicates on user data"); counting
it shows how much it matters.

| Kind | What it says | Example | Run by the verifier as |
|---|---|---|---|
| Predicate | a property a given value may or may not have | `PointLiesOnCurve(m, d, i)` | never on its own; evaluated where a contract, invariant or validator cites it |
| Contract clause | the caller's obligation (`requires`) or the function's (`ensures`) | `Discretize` ensures the sagitta predicate on every segment | at every call in checked builds; by the contract harness on generated arguments |
| Type invariant | a property of every value of a type | a `Check` with an unmeasured `Worst` does not hold | at every construction |
| Law | a property of the library's functions for all parameter values meeting its guards | `ReversedIsInvolution` | over pooled witnesses and generated cases, or proved |
| Theorem, conjecture | a law with a justification and possibly a proof; or an open claim | `SharedPolylineClosesEveryEdge` | as a law until proved; a failing conjecture is a finding |

[M], from the layer READMEs' law tables. In `04-discretization`, 25 of the 35 `Law_` functions are
predicates over data (severity Error, W/E or Info), and 10 are laws (severity "test"). In
`00-foundation`, of 34: 4 are "model" laws (three are one-line wrappers of `IsWellFormed`, one is a
predicate over a magnitude), 3 are "convention" laws (properties of values built by the layer's own
constructors), and 27 are library laws. A runner that treats every `Law_` as universally quantified
would run the 25 predicates over arbitrary discretizations, where they are false by design (an
arbitrary polyline does not lie on the curve): either false failures, or, behind guards, vacuous
passes that look like evidence.

So in the language: a predicate is an ordinary `Boolean` function, which may carry `requires`; a
convention law becomes an invariant of a sealed type or an `ensures` of its constructors; a library
law becomes a `law`. Laws are not callable from code; a property that is reused as a hypothesis is a
predicate.

### 2.3 Expression forms

**Short-circuit `&&` and `||` on `Boolean`.** Today both are calls to `And` and `Or` and evaluate
both operands (SEMANTICS.md section 6, in capitals). The cost in this sandbox, at 13:48 on
2026-10-17 [M]: 187 guard tails of the form `pre ? claim : true` across the laws files; three laws in
layer 4 that build dummy arrays so that an unguarded index cannot fault
(`Law_ImagePointReevaluates`: `var uvs = ok ? m.ImagePoints(d, img) : 0.MapRange(j => UvCoordinate(0.0, 0.0));`);
and nested `if`s in `stdlib/geometry/triangulation.library.plato` whose comment says "The nesting is
load-bearing". In a pure language, the only observable difference between strict and short-circuit
evaluation is a fault or the time taken; short-circuit evaluation is defined on strictly more
programs. **Recommendation**: on `Boolean`, the elaborator lowers `a && b` to `a ? b : false` and
`a || b` to `a ? true : b`. On any other `IBooleanAlgebra` type they stay calls to `And` and `Or`,
since only a `Boolean` can be branched on. All five target languages short-circuit their native `&&`,
GLSL included.

**`a implies b`**, sugar for `a ? b : true`, with the lowest precedence of the binary operators. It
names the pattern behind those 187 guards.

**Bounded quantifiers.** `all x in D: e` and `any x in D: e`, short-circuit, where `D` is an array,
an integer range (`n.Range`), or any finite collection; lowered to a loop that stops at the first
decisive element. Over a continuous domain (a `NumberInterval`, an angle interval, a box in parameter
space), a quantifier is allowed only in specifications: checked and verification builds sample it by
a fixed plan (both ends, the midpoint, then pseudorandom points), and the interval profile can bound
it soundly by subdivision; in ordinary code it is a compile error. Unbounded quantification is not an
expression at all; it is a law's parameter list. The sandbox wrote 207 `forall` [M]; 110 have no
domain and rely on the cited law's guard to bound an index, and 24 lines nest one quantifier inside
another. Section 7.3 says how those become explicit domains.

**Identity, `a === b`.** Derived for every type: bitwise on `Number` (a NaN is identical to a NaN
with the same bits; +0 and -0 differ), element by element on arrays, tag and payload on sums. It is
the executable form of "exact by construction" (SPEC-DSL.md section 2) and replaces the foundation's
hand-written `Identical` (17 uses) and layer 4's `SameDiscretization`. In specifications, `==` on
`Number` or on a type containing one is a warning that asks for `===` (the value is a copy) or a
tolerance comparison (the value is computed).

**Tolerance comparisons.** A comparison `m <= tol` or `m < tol` in which `tol`'s type implements the
stdlib interface `ITolerance<M>` and `m` has type `M` is a tolerance comparison, and `a ~= b within tol`
is `Distance(a, b) <= tol` through `IMetricSpace`. Section 2.9 gives the semantics.

**`draw`**, only inside generator bodies (section 2.8).

### 2.4 Type invariants and sealed construction

Syntax: clauses after the `implements` list and before the body, for products and sums alike.

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
```

**Meaning.** Every value of the type satisfies every invariant; clauses are read in order, and a
later clause may assume the earlier ones. Values never change, and every value comes from a
construction: the derived constructor, a tuple converted at a typed boundary, a sum-case factory, a
derived setter, or host code calling the generated constructor. So the obligation is exactly: at
each construction site, the new value satisfies the invariants.

**Three ways a language can treat construction** [J]:

| Option | Precedent | Verdict for Plato |
|---|---|---|
| Smart constructors only: construction restricted to a few functions | Haskell's module exports, Ada private types | Cannot state a property of a value on its own; needs a module boundary Plato does not have. Useful as an addition, below. |
| Proof-carrying values: the type checker proves every site | Liquid Haskell, F* refinement types [W10] | Needs an SMT solver inside the type checker and a subtyping relation between a type and its refinements, which a nominal, monomorphized checker with tiered overload resolution does not have; and Liquid Haskell reasons about floats as reals, which is wrong for this library. |
| Checked construction sites: each construction is an obligation, discharged statically where possible and checked at run time in a checked build | Eiffel class invariants [W2], Ada 2012 `Type_Invariant` and `Dynamic_Predicate` [W30] | **Chosen.** Fits a pure language exactly, since there is no mutation after construction. |

**`sealed by`**, opt-in, names the only functions whose bodies may construct the type; anywhere else,
a construction, tuple conversion, setter or `default` of the type is a compile error. It buys three
things that an invariant cannot:

1. Properties that relate a value to the arguments it was built from. The foundation author wanted
   "`Holds` is exactly `Worst <= bound`", but `bound` is not a field of `Check`, so no invariant can
   say it; the spec file fell back to a constructor list and a comment (`foundation.spec.plato`,
   `spec Check`).
2. Induction over constructors. If every sealed constructor establishes a property, given that
   property of any argument of the same type, then every value has it. The foundation's three
   "convention laws" become theorems with a mechanical proof shape, and the README's open question 8
   ("Phase 3 should check that every `Check_` builds through `CheckWithin`, `CheckExact` or
   `WorseOf`") becomes a compile error.
3. A generator for free: random compositions of the sealed constructors (section 2.8).

```plato
// One law evaluated over one value. Built only by CheckWithin, CheckExact and WorseOf, whose
// contracts make Holds exactly "Worst <= bound" for the bound each was given.
type Check
    sealed by CheckWithin, CheckExact, WorseOf
    invariant self.Worst.IsNaN implies !self.Holds
{
    Law: String;
    Holds: Boolean;
    Worst: Number;
    Where: Provenance;
}

// The checks and diagnostics of one validation; every failed check has a diagnostic.
type Report
    sealed by Empty, Merge, ReportOf
    invariant all k in self.Checks.Count.Range:
        self.Checks[k].Holds || self.Diagnostics.Any(d => d.Code == self.Checks[k].Law)
{
    Checks: Array<Check>;
    Diagnostics: Array<Diagnostic>;
}
```

**A derived precondition for construction.** Each type with invariants gets a static
`T.CanConstruct(fields...)` that evaluates the invariants on would-be fields. It makes official the
stdlib's existing convention for partial operations ("`CanInvert: Boolean` alongside `Invert`",
SEMANTICS.md section 8). The STEP decoder writes
`LengthTolerance.CanConstruct(v) ? ... : <diagnostic>`, so a malformed file yields a diagnostic, and
the guard discharges the construction obligation syntactically.

**New promises are new nominal types.** The layer 4 author had to weaken `EdgeDiscretization`'s
invariant from "strictly increasing" to "strictly monotone", because `Reversed` builds the decreasing
direction, and to repeat "canonical" as an `ensures` on four functions and an invariant of
`EdgeDiscretizations` (README, "Changes to the contract"). In a nominal language the canonical form
can be its own type, `CanonicalDiscretization { Value: EdgeDiscretization; }` with
`invariant self.Value.RunsAlongCurve`, which `Discretize` returns and `EdgeDiscretizations` stores. The
promise then lives in one place, and a function that needs canonical input says so in its signature.

**Other rules.** `default` of a type with invariants is rejected unless the zero value satisfies them,
which the evaluator decides at compile time. An invariant may not construct a value of its own type,
directly or through calls, since checking it would recurse. Invariants of interfaces are not proposed:
an interface is a constraint, not a set of values.

### 2.5 Function contracts

Syntax: clauses after the return type and any `where` bound, before the body.

```plato
// The representative of t modulo period in [0, period): t - period floor(t / period), corrected
// once on each side (README, "A periodic domain as a quotient").
Wrap(t: Number, period: Number): Number
    requires t.CanWrap(period)
    ensures result >= 0.0 && result < period
    ensures PeriodicDistance(result, t, period) <= Rounding(t.Abs + period)
{
    var r = t - period * (t / period).Floor;
    var s = r < 0.0 ? r + period : r;
    return s >= period ? s - period : s;
}

// The check of a measured law over its samples: it holds exactly when worst <= bound.
CheckWithin(law: String, worst: Number, bound: Number, where: Provenance): Check
    ensures result.Holds == (worst <= bound)
    ensures result.Law == law
    ensures result.Worst === worst
    => Check(law, worst <= bound, worst, where);
```

| Clause | Meaning | Checked build |
|---|---|---|
| `requires e` | the caller's obligation; clauses in order, each may assume the earlier | at entry; a failure blames the caller |
| `ensures e` | the function's obligation whenever every `requires` held; may name `result` | at exit; a failure blames the function |
| `decreases e` | on a recursive function or a `while` loop (`while (c) decreases e { ... }`): a non-negative quantity that strictly decreases at each recursive call or iteration | at each call or iteration; a hang becomes a located failure |
| `cost e` | the size the work grows with (the sandbox's `measure`, renamed so it is not mistaken for termination) | none; used by growth tests |
| `deferred "<family>"` | in place of a body: the algorithm is still to be written in Plato | traps with "deferred", or runs a `reference` body |

**`deferred` is not `intrinsic`.** Today a bodiless function is an intrinsic obligation that the host
fulfils (SEMANTICS.md section 3), and the sandbox overloads it to mean "not written yet"; such a
function passes every gate and degrades at code generation into a throwing member or a self-calling
stub (PLATO-PRIMER.md D.7). With `deferred` the two separate. A release build that reaches a deferred
function is an error naming it. In checked and verification builds, every statement whose closure
reaches a deferred function is reported **blocked by** it. That report is a progress meter for
TASKS.md: implementing `Discretize` unblocks a known list of statements.

**`reference` bodies** (optional). A function may carry, beside its real body or instead of it, a
slow and evidently correct `reference => ...` body, checked against the same contract. Before the real
body exists, the reference stands in for it, so the layers above can be tested; this is Kani's
"stub by a verified contract" idea [W8] with a body rather than a contract. Where the result is unique
(an exact sagitta, a closed-form area), the reference is also a differential oracle for the optimized
body.

**Contracts on interface members** apply to every implementing function, checked on each
monomorphized instance; an implementation's own `requires`, if it has any, must follow from the
interface's (a VC).

The largest contract in the sandbox, merged onto its declaration. Predicates lose the `Law_` prefix
(section 2.2), and the quantifier domains are explicit (`SegmentCount.Range`, and
`InteriorPointIndices`, a helper the layer would declare for the indices 1 to count - 2):

```plato
// The canonical discretization of one edge.
Discretize(m: BrepModel, e: BrepEdgeIndex, c: DiscretizationCriteria, floors: SegmentFloors): EdgeDiscretization
    requires m.CanDiscretize(e, c)
    ensures result.Edge == e
    ensures result.RunsAlongCurve
    ensures result.Parameters.First === m.EdgeDomain(e).Range.Start
    ensures result.Parameters.Last === m.EdgeDomain(e).Range.End
    ensures result.Points.First === m.Vertices[m.DomainStartVertex(e)].Point
    ensures result.Points.Last === m.Vertices[m.DomainEndVertex(e)].Point
    ensures all i in result.Points.Count.Range: PointLiesOnCurve(m, result, i)
    ensures all s in m.EdgeSeeds(e): result.ContainsParameter(s)
    ensures m.IsDegenerateEdge(e) implies result.SegmentCount == 1
    ensures m.IsClosedEdge(e) implies result.SegmentCount >= c.ClosedEdgeMinimum
    ensures result.SegmentCount >= m.MinimumSegmentCount(e, c, floors)
    ensures all i in result.SegmentCount.Range: SagittaWithinChordal(m, result, c, SamplePlan.DiscretizationPlan, i)
    ensures all i in result.SegmentCount.Range: TangentDeviationWithinHalfAngular(m, result, c, SamplePlan.DiscretizationPlan, i)
    ensures all i in result.InteriorPointIndices: TurningAngleWithinAngular(m, result, c, i)
    ensures all i in result.SegmentCount.Range: SegmentWithinMaxLength(m, result, c, i)
    ensures all i in result.SegmentCount.Range: ShortSegmentIsForced(m, result, c, floors, i)
    ensures all img in m.EdgeImages(e): all i in result.SegmentCount.Range:
        ImageChordWithinChordal(m, result, c, img, SamplePlan.DiscretizationPlan, i)
    cost result.Parameters.Count
    deferred "seeds; a closed-form uniform count for conics, raised until the image criteria hold; adaptive bisection at parameter midpoints with three-sample tests for other curves; then the count floors";

// Point i lies on the edge's curve at parameter i, within the model's length tolerance.
PointLiesOnCurve(m: BrepModel, d: EdgeDiscretization, i: Integer): Boolean
    requires m.IsEvaluable(d)
    requires d.Points.IsValidIndex(i)
    => d.Points[i] ~= m.PointOnEdge(d.Edge, d.Parameters[i]) within m.Tolerances.Length;
```

The predicate's guards are now `requires`: calling it out of range is a defect the checked build
reports, rather than a silent `true` that a vacuity count must later detect.

### 2.6 Laws

```plato
// Adding a period does not change the wrapped value, measured around the circle.
law WrapIgnoresWholePeriods(t: Number, period: Number, tol: ParameterTolerance)
    requires t.CanWrap(period)
    requires (t + period).CanWrap(period)
    requires tol.IsResolvable(t.Abs + period)
    => PeriodicDistance((t + period).Wrap(period), t.Wrap(period), period) <= tol;

// Reversing twice gives back the same discretization, bit for bit.
law ReversedIsInvolution(d: EdgeDiscretization)
    => d.Reversed.Reversed === d
    by smt;

// A tighter chordal bound never yields fewer points, the other criteria and the floors fixed.
law TighterChordalNeverFewerPoints(m: BrepModel, e: BrepEdgeIndex in m.EdgeIndices,
        c: DiscretizationCriteria, floors: SegmentFloors, chordal: Number in NumberInterval(0.0, c.Chordal))
    requires m.CanDiscretize(e, c)
    requires chordal > 0.0
    => m.Discretize(e, c.WithChordal(chordal), floors).Parameters.Count
        >= m.Discretize(e, c, floors).Parameters.Count;
```

**Meaning.** For every combination of parameter values drawn from their domains that satisfies the
`requires` clauses in order, the claim holds. The old `tol.IsWellFormed` guard disappears: the
`ParameterTolerance` type's invariant guarantees it.

**Parameter domains.** Without an annotation, a parameter of type `T` is drawn from `T`'s **pool**:
every witness and every generator declared for `T`, plus a derived generator when `T`'s structure
allows one (section 2.8). `p: T in e` draws from a domain evaluated after the earlier parameters,
which is how dependent generation is written (an edge index of the model just drawn; a chordal bound
below the criteria's). `p: T from G` names one generator or witness. Finite domains with few elements
(a payload-free sum, `Boolean`, a short range) are enumerated rather than sampled, as SmallCheck does
[W31].

**Guards and vacuity.** The verifier counts, per law, how many cases passed every `requires`, fails a
law that never evaluated its claim, and warns when more than nine cases in ten were discarded ("give a
domain or a generator"). The foundation README's open question 4 (a sample count in `Check`, for a
vacuity rate) is answered without changing the type: the verifier counts.

**Tolerance parameters** are drawn from their type's pool, which by the invariants above contains only
positive, finite, normal values, spread over magnitudes. Today's runner draws every `Number` from
[-10, 10], so about half its tolerance draws fail the guards (00-foundation README, "Laws").

**Interface laws.** A `law` inside an `interface` is a type-class law: it is stamped onto every
implementing type, and each (type, law) pair is reported. The stdlib already writes generic laws over
interfaces in `stdlib/tests/foundation.laws.plato`; inside the interface, the law travels with the
obligation it constrains.

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

For `Point3D`, `a - b` and `b - a` differ only in sign, so the computed distance is symmetric exactly,
and the foundation's `Law_CoincidentIsSymmetric` becomes a consequence rather than a separate law.

**Examples.** A law with no parameters is a unit test with a known answer:
`law UnitBoxEulerCharacteristic => BrepModel.UnitBox.EulerCharacteristic == 2;`.

**Style.** "One statement per law" (SPEC-DSL.md section 2) stays, as a lint on a top-level `&&` in a
claim.

### 2.7 Theorems and conjectures

A theorem is shaped like a law: its parameters are the `given` variables, its `requires` are the
assumptions (predicates), its body is the conclusion. It adds `because "<proof sketch>"`,
`tested by <laws>`, and optionally a claimed route: `by exhaustion`, `by smt`, or
`proof "<file.lean>"`. A conjecture has no `because`, and its failure is reported as a finding, not
as a failed build.

```plato
// The sharing principle: the two faces of an edge meet point for point.
theorem SharedPolylineClosesEveryEdge(m: BrepModel, ds: EdgeDiscretizations,
        b1: FaceBound, c1: Coedge, b2: FaceBound, c2: Coedge, k: Integer)
    requires DiscretizationsCoverEdges(m, ds)
    requires m.IsEvaluable(ds.ByEdge[c1.Edge])
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
```

- **A theorem runs as a law** whenever its assumptions and conclusion are computable. Of the 13
  theorems in layers 0 and 4, 10 are [M, by reading]; once rewritten with its witness,
  `CoincidenceIsNotTransitive` is the eleventh. The other two assume a property of every value of a
  type (`TurningAngleBoundedByTangentDeviation` over every `SamplePlan`, `DiscretizeTerminates` over
  every discretization of the edge), which no test can establish; they stay stated until proved, and
  their `tested by` laws carry the evidence. Until a proof is checked, a runnable theorem is at least
  tested. `tested by` names other laws that exercise it by a different route; the checker requires
  that they resolve.
- **Existentials are stated by exhibiting the witness.** `CoincidenceIsNotTransitive` becomes a
  theorem over `t: LengthTolerance` whose body builds the points at 0, 0.75 t and 1.5 t and states the
  three comparisons. An existential over a continuous domain without a witness term (the sandbox has
  one, in `Sagitta`'s contract) has no executable meaning; it is restated as a bound against a sampled
  or certified quantity.
- **A claimed route is checked.** `by smt` fails the build if the solver does not discharge the
  statement; `proof` fails it if the Lean file does not check against the generated statement. An
  unclaimed statement gets the best status any engine reaches, reported but not enforced.

### 2.8 Witnesses and generators

**Witness.** A named value, or a family of values with parameters:

```plato
// The domain of a full circle: [0, 2 pi] with period 2 pi.
witness FullCircleDomain: CurveDomain
    => CurveDomain(NumberInterval(0.0, Number.Tau), Periodicity.Periodic(Number.Tau));

// A torus of major radius R and minor radius r, as a closed B-rep. (Layer 7, not yet written.)
witness Torus(R: Number in Magnitudes(1e-2, 1e4), r: Number in NumberInterval(1e-3 * R, 0.9 * R)): BrepModel
    => ...;
```

A closed witness is evaluated at compile time and its invariants checked, so a malformed witness is a
`plato check` finding. A parameterized witness's parameters are drawn and shrunk exactly like a law's.
A **negative witness** names the predicates it must fail, `witness BoxMissingFace: BrepModel
violates EveryEdgeUsedTwice => ...;`, and the verifier checks that it fails exactly those among the
predicates over its type. That gives the discrimination matrix of witnesses by predicates that the
first version proposed, from declarations.

**Generator.** A block body with `draw` expressions, for constructions where later choices depend on
earlier ones:

```plato
// A model with one circular edge of drawn radius and sweep, moved by a drawn rigid motion; valid by
// construction. ArcStripModel and Transformed are layer-7 and layer-2 builders (not yet written).
generator ArcEdgeModels: BrepModel
{
    var radius = draw Magnitudes(1e-3, 1e5);
    var sweep = draw AngleInterval(0.001.Turns, 1.0.Turns);
    var motion = draw RigidMotions;
    return ArcStripModel(radius, sweep).Transformed(motion);
}
```

**Semantics: choice sequences.** The elaborator threads an implicit sequence of choices through the
generator's `var` statements; each `draw` consumes some, and a domain maps them to a value. This is
the design of Hypothesis [W19, W32]. It has four consequences that matter here:

1. A generator is a pure Plato function of its choices, so it compiles into every backend, and the
   same choices give the same value everywhere, provided domains map choices to values with exact
   operations only (integer arithmetic, `ScaleB`, integer-to-float conversion; never `Log` or `Exp`).
2. Shrinking works on the choice sequence, generically: shorter sequences and smaller choices first.
   Every candidate goes back through the generator, so **every shrunk value is valid by construction**.
   The first version's advice, "shrink the generator, not the model", becomes the only way shrinking
   happens.
3. A counterexample is a generator name and a choice sequence: small, backend-neutral, replayable.
4. Domains decide what "simpler" means: an integer range shrinks toward its start, an array toward
   fewer elements, `OneOf` toward its first alternative. Authors list the simplest alternative first.

A domain is any value whose type implements a stdlib interface `IDomain<T>`; the stdlib supplies
integer ranges, closed intervals that draw their ends first, `Magnitudes(lo, hi)` (logarithmically
spread, built from an exponent and a mantissa draw), `OneOf`, `ArrayOf`, and every type and generator.

**Composition for constrained types.** Random B-reps are useless because almost none are well formed
(VALIDATION-MATH.md 7.1: random 12-vertex polygons are simple 0.03 % of the time). The rule is
*construct, don't filter*, from three sources that compose:

1. **Parameterized witnesses** (VALIDATION-MATH.md 7.3: extruded star polygons, which are simple by
   construction; tori; spheres with poles; revolved profiles), with **transform generators** (the 24
   cube rotations, scaling by powers of two, translation up to 10^8 model units) composed onto any of
   them.
2. **Sealed constructors.** A random composition of a sealed type's constructors yields only values
   the library itself could build: for `EdgeDiscretization`, `Discretize`, `RefineEdge`, `Reversed`
   and `AlongCoedge` applied to pooled models.
3. **SMT model finding** for laws that depend only on topology: the combinatorial predicates,
   conjoined and bounded, handed to a solver, return models nobody thought to write (section 4.4).

**Derived generators.** For a product of generable fields, a sum (a case, then its payload), and an
array (a length, then the elements), the compiler derives a generator. Invariants that bound a field
(`>= c`, `< c`, `IsFinite`) are folded into that field's domain; other invariants are enforced by
rejection, with the discard rate reported.

**Generator soundness.** Every generated value is checked against its type's invariants; a violation
is reported as a defect of the generator, not as a law failure.

### 2.9 Tolerances, approximate equality, identity, and three-valued verdicts

**Tolerance types.** A stdlib interface `ITolerance<M>` with one member, `Value(t: Self): M`, which a
field named `Value` discharges (PLATO-PRIMER.md A.3). `LengthTolerance` and `ParameterTolerance`
implement `ITolerance<Number>`; `AngleTolerance`, whose `Value` is an `Angle`, implements
`ITolerance<Angle>`. So comparing a `Number` measure with an `AngleTolerance` is a type error:
dimension checking by name, as far as the stdlib's quantity types reach. A new stdlib type,
`RoundingTolerance` (built by `Rounding(magnitude)`, `Value` = `ResolutionAt(magnitude)`), marks
bounds that absorb rounding only. Criteria such as layer 4's `Chordal` become tolerance-typed fields so
their comparisons are recognized.

**The comparison** `m <= tol` elaborates to a TIR node that records the measure, the bound and the
tolerance's type. In release builds it is an ordinary comparison. In the evaluator and verification
builds, every evaluation is logged, which gives, without a line in the law:

- the **margin** distribution per statement, and a flag on statements whose margin never exceeds
  0.001 ("may not test its tolerance");
- **targeted search**: maximizing the margin over choice sequences, which finds worst cases rather
  than typical ones (targeted property-based testing [W19b]);
- the **three-valued verdict** below.

In specifications, a numeric literal as a bound is an error. The stdlib's own `LawEq` helper
(`stdlib/tests/foundation.laws.plato`: `|a - b| <= max(|a|, |b|) * 1e-4 + 1e-4`) is the pattern this
removes.

**Three-valued verdicts.** Each tolerance comparison in a case is judged twice: as computed in
binary64, and with the statement's own computation re-evaluated in the reference profile.

| binary64 | reference | Verdict |
|---|---|---|
| holds | holds | **holds** |
| fails | fails | **fails** |
| differ | differ | **within rounding**: the binary64 verdict was decided by rounding |

Which values are re-evaluated matters. A statement's **inputs** (a law's parameters; a contract's
arguments and its `result`) are converted exactly into the reference format, since widening loses
nothing; everything the statement **computes** is re-evaluated. So a contract on `Discretize` judges
the binary64 polyline against a more exact curve, which is the question that matters. Comparisons
against a `RoundingTolerance` are the exception: they are claims about binary64 rounding itself
(`PeriodicDistance(Wrap(t), t) <= Rounding(...)` says that `Wrap` errs by little), so they are judged
in the primary profile only, since re-evaluating `Wrap` exactly would erase what is being measured.
The type of the tolerance carries that distinction, which is one more reason tolerances are typed.

**Branch stability.** During re-evaluation, a conditional whose condition differs between the two
profiles is reported with its location: a decision taken within rounding. TARGET-LANGUAGE.md 4.3 asked
that "decisions that choose topology use only + − × ÷ √ and comparisons, or a robust predicate"; this
report finds the decisions that do not.

### 2.10 What the front end checks

All of this runs in the edit loop, in seconds, before anything executes.

| Construct | Checked by the front end | Handed to the verifier as obligations |
|---|---|---|
| `invariant` | `Boolean`; names only `self` and functions; total under its earlier clauses; no construction of its own type | at each construction site, the invariant of the new value |
| `sealed by` | names functions returning the type; no construction, tuple conversion, setter or `default` elsewhere | each listed function establishes the invariants |
| `requires` | `Boolean` over parameters; total under earlier clauses | at each call site, the callee's `requires` under the caller's assumptions |
| `ensures` | `Boolean`; `result` typed; total under the `requires` | the body establishes it |
| `decreases` | numeric; only on recursion or a loop | decrease and bound at each call or iteration |
| `cost` | numeric | none |
| `deferred` | no body; a description present | release build: error; elsewhere, statements reaching it are "blocked" |
| `law` | every parameter has a non-empty domain; guards and claim `Boolean` and total; not called from code | the claim over the domains, under the guards |
| `theorem`, `conjecture` | as a law; `tested by` names laws; a claimed `proof` file exists | as a law, plus the claimed route |
| `witness` | type; parameter domains; `violates` names predicates over the type | invariants, at compile time when closed |
| `generator` | `draw` only inside generators; domain types match | generated values satisfy the type's invariants |
| tolerance comparison | measure type matches the tolerance's `M`; no literal bound in specifications | none |
| `===` | both sides of one type | none |
| `==` on `Number`-bearing types in specifications | warning: use `===` or a tolerance | none |
| `all`, `any` | finite domain in code; continuous only in specifications | none |

"Total" is a dominance check: every array index, integer division and sum projection inside a
specification sits under a guard that makes it defined: an earlier `requires`, the left operand of a
short-circuit `&&`, an `implies` antecedent, a quantifier's domain, or a conditional's test. It is the
SPEC-DSL rule "a law is total; guards do that work", now enforced.

### 2.11 What is emitted

| Construct | Release build | Checked build | Verification build | SMT and Lean |
|---|---|---|---|---|
| `invariant` | nothing | a check in the generated constructor; a failure blames the constructing function | same, and the invariant as a callable predicate | obligations; axioms of the type |
| `requires`, `ensures` | nothing | entry and exit checks with blame | same; the harness calls the function on generated arguments | VCs |
| `decreases` | nothing | a check per call or iteration | same | termination argument |
| `deferred` | build error | the `reference` body, or a trap | same, and "blocked" statuses | an opaque function with its `ensures` as axioms |
| `law`, `theorem` | nothing | nothing | a function and a manifest entry | a VC, or a Lean `theorem` |
| `witness`, `generator` | nothing | nothing | functions and manifest entries | (model finding runs the other way) |
| tolerance comparison | a comparison | a comparison | a comparison that logs measure and bound | a comparison in Real or FP |

A checked-build failure leaves through the host with a structured report: the clause, its source span,
the blamed function, and the arguments serialized as JSON. In C# it is an exception type of the
runtime, in TypeScript a thrown object, in Rust a panic payload, in C++ an exception or an abort with
the report printed. The GPU profile has no checked build. The checked build is an explicit profile, not
C#'s Debug configuration: `tracker/issues/plato-292.md` shows what goes wrong when Debug and Release
disagree about what is checked.

### 2.12 The sandbox's files once this exists

The `*.spec.plato` files merge back into the declaration files: invariants and `sealed by` into
`*.types.plato`, contracts onto their functions in `*.library.plato`, theorems into `*.laws.plato`
beside the laws, witnesses and generators. Reasons:

- **One declaration, one place** (PRINCIPLES.md 4). Today every one of the 25 contracts in
  `foundation.spec.plato` repeats its function's signature, and a contract that drifts from its
  declaration is caught only by a reader. The first version kept the repetition to disambiguate
  overloads; on the declaration there is nothing to disambiguate.
- **A reviewer reads the contract beside the signature**, and an agent editing a body sees the
  promise it must keep in the same view.
- **The gate hazard disappears**: spec files had to be excluded from every front-end run because the
  parser could not read them (PLATO-PRIMER.md E.1).

The file kinds become: `*.types.plato` (types with their invariants), `*.concepts.plato` (interfaces
with their contracts and laws), `*.library.plato` (functions with contracts, and predicates),
`*.laws.plato` (one library of laws, theorems, conjectures, witnesses and generators),
`proofs/*.lean` (hand-written proofs against generated statements). STY005 (one kind of declaration
per file) still holds, since laws, theorems, witnesses and generators are library members.

### 2.13 Designs considered and rejected

- **Refinement types checked by the type checker.** Rejected above (2.4): an SMT solver in the type
  checker, subtyping in a nominal checker, slower and less predictable edit loops, error messages that
  are hard for agents, and floats treated as reals.
- **A separate specification language or front end** (the first version's interim choice). With the
  parser in the owner's hands it buys nothing and costs a second grammar and a second binder.
- **Specifications in comments**, as JML and ACSL do [W6, W7]: the compiler cannot check them, and the
  history in section 10 shows such layers drift.
- **Contracts that change return types** (`Checked<T>` wrappers returning diagnostics). They make every
  signature lie about what the function computes. Diagnostics-as-data stays the pattern for bad input
  data, where it belongs.
- **Exceptions in the language** for contract failures. The language stays exception-free; the
  checked build is a host-level instrument.
- **Unbounded quantifiers inside expressions**: no executable meaning; a law's parameters say it.
- **Bounded integer types** (an index type that knows its table's length): that is dependent typing,
  far from Plato's nominal model. Index safety stays an obligation (section 4.2).
- **Laws callable as predicates**: reintroduces the conflation of section 2.2.

## 3. Dependency order

What must exist before what. Effort notes, where kept, are in Appendix A.

```
D1  grammar, AST and binding of every new form                          (parakeet, Plato.AST, binder)
 └─ D2  checking: spec typing, totality, units, domains, sealing, lints  (checker, linter)
     │    -> spec errors in seconds; the sandbox and stdlib/tests can migrate
     ├─ D11 documentation tables and editor hover (statuses need D5)     (Navigation)
     └─ D3  elaboration: contract lists on TirFunction, the tolerance-comparison node,
         │   lowering of implies, short-circuit && and ||, quantifiers and draw,
         │   invariants as synthesized functions, construction-site obligations
         ├─ D4  TIR evaluator, binary64 profile; compile-time evaluation
         │   ├─ D5  orchestrator: pools, derived generators, choice sequences, shrinking,
         │   │       vacuity, margins, blame, explanation traces, report, CLI and MCP
         │   │       -> milestone M1 on the evaluator
         │   └─ D6  reference and interval profiles -> three-valued verdicts, branch stability
         ├─ D7  checked and verification builds per writer, harness protocol
         │       (C#, then TypeScript, Rust, C++; each needs its fixes of 9.2) -> cross-backend, with D5
         ├─ D8  SMT translator and cache (model replay needs D4; model finding feeds D5's pools)
         ├─ D9  Lean translator and proof checking
         └─ D10 mutation of TIR (needs D5 to run statements against mutants)
```

Two orderings follow from it. The library gains as soon as D2 lands, because nine authors writing in
parallel get spec errors in seconds. Execution starts with D4 and D5, not D7, because the evaluator
needs no writer and no host build.

## 4. Verification: proof, solving and testing as one system

### 4.1 Obligations, engines and statuses

Every statement yields obligations: one per construction site per invariant, one per call site per
`requires`, one per function per `ensures`, one per law or theorem. The verifier tries engines in order
of strength and cost and records the strongest result:

| Status | Meaning | Engine |
|---|---|---|
| **proved** | a Lean proof checks against the generated statement; marked "for any `Number`" or "over the reals" (4.5) | Lean 4 |
| **solved** | the negated VC is unsatisfiable; marked with the theory (Int and Seq, FP bit-precise, Real) | SMT |
| **exhausted** | evaluated on every value of a finite domain | evaluator |
| **tested** | evaluated on N cases from M sources on K backends; with vacuity, margins, mutants killed | evaluator and compiled backends |
| **within rounding** | no case fails; some cases are decided by rounding | reference profile |
| **stated** | not evaluated: no domain, or a proof route claimed and not achieved | none |
| **blocked by F** | its closure reaches the deferred function F | none |
| **failed** | a counterexample, shrunk, replayable | any |

Statements that involve `Number` arithmetic are tested even when proved over the reals, since a proof
over the reals says nothing about rounding. Statements proved for any `Number`, or solved over
integers and sequences, are still run on a few cases: a failure there exposes a translation defect.

### 4.2 The type checker

It discharges, outright and in the edit loop:

- **exhaustiveness** of every `match` (CHK300 to CHK303 exist today);
- **totality** of specifications by guard dominance (2.10);
- **units** of every tolerance comparison;
- **sealing**: no construction of a sealed type outside its list;
- **runnability**: every law parameter has a domain;
- **trivial call-site obligations**: a callee's `requires` that appears verbatim among the caller's
  `requires`, or that holds of literal arguments by evaluation.

Index ranges in general are not the type checker's to prove. Plato's typed indices
(`BrepEdgeIndex { Value: Integer }`) know their table only by convention, and making them know it
would be dependent typing (2.13). Each index is a VC, and the totality check guarantees that every
index in a specification is at least guarded.

### 4.3 Evaluation: constants and finite domains

The evaluator evaluates closed terms at compile time: constant witnesses (`FullCircleDomain`,
`Witness_Tolerances`'s `LengthTolerance(1e-6)`) and construction sites whose arguments are literals,
with their invariants. It **proves by exhaustion** any statement whose parameters all range over
finite types: `OppositeSideIsInvolution` over the four `DomainSide` cases, `IsError` over three
`Severity` cases. Exhaustion is a proof for all values, not a sample.

### 4.4 SMT

**VC generation is modular.** For a function with a contract and a body, the VC is
`requires(x) ⇒ ensures(x, body(x))`, with each call in the body replaced by a fresh value satisfying
the callee's `ensures` when the callee has a contract, inlined when it has none and does not recurse,
and left uninterpreted otherwise. Plato's purity makes this a substitution; there is no weakest
precondition over state. Editing a body re-solves only that function's VCs, because callers see its
contract.

**Encodings.** `Integer` as Int, with a separate overflow obligation; `Boolean` as Bool; products and
sums as datatypes; `Array<T>` as `Seq T` (`Count` is `seq.len`, `At` is `seq.nth`, `Concatenate` is
`seq.++`), with `MapRange` given by the axioms "length is `n` for `n >= 0`" and "element `i` is
`f(i)` for `0 <= i < n`"; bounded quantifiers as guarded quantifiers; `Reduce` uninterpreted, unrolled
when the length is a small constant. `Number` two ways: **FP** (binary64, bit-precise, including NaN
and signed zero) when the statement uses comparisons, NaN tests and a few basic operations;
**Real**, labeled "over the reals", otherwise. Transcendental functions are uninterpreted.

*Sketch of a generated query (illustrative):*

```smt2
; law SamplesHaveRequestedCount (00-foundation); Number as Real; only the count is used
(declare-datatype NumberInterval ((mk (Start Real) (End Real))))
(declare-fun Samples (NumberInterval Int) (Seq Real))
; Samples' body is count.MapRange(...); the MapRange axiom, specialized:
(assert (forall ((r NumberInterval) (n Int)) (=> (>= n 0) (= (seq.len (Samples r n)) n))))
(declare-const range NumberInterval)
(declare-const count Int)
(assert (>= count 2))                                     ; requires
(assert (not (= (seq.len (Samples range count)) count)))  ; negated claim
(check-sat)                                               ; expected: unsat, so solved
```

**Cache.** Results are keyed by a hash of the VC text, the solver and its version and options, and
stored with the time taken and the model or the unsatisfiable core. A per-VC timeout (5 s by default)
keeps the solver off the edit loop's critical path; results stream into the report.

**Counterexamples are replayed.** A model of a negated VC becomes a concrete case run on the
evaluator. If the statement fails there, it is a real counterexample, shrunk and reported like any
other. If it holds there, the model was spurious (typically a Real model of a float statement) and is
labeled so.

**Model finding and consistency.** The combinatorial predicates of layers 2 and 6, conjoined at a small
bound (say 16 vertices, 24 edges, 12 faces), handed to the solver, return models: topology witnesses
for the pools. An unsatisfiable conjunction returns a core naming predicates that contradict each
other, which makes PLAN.md's done condition 5 ("no law in one layer that contradicts a law in
another") a mechanical check, at small scope, as Alloy argues [W12].

**Equivalent mutants.** A mutant whose equivalence to the original solves is excluded from mutation
scores (4.6).

Solvers: Z3 and cvc5 for Int, Seq and datatypes [W11, W33]; Bitwuzla for FP [W34].

### 4.5 Lean 4

**Why Lean** [J]. Plato is a pure functional language, and so is Lean 4 [W35]: types, sums, arrays,
pure functions and conditionals translate almost one to one, where a translation to Dafny targets an
imperative verifier. Mathlib covers the real analysis the geometric lemmas need. The proof
automation that recommends Dafny for index bookkeeping comes here from the SMT layer instead (4.4),
and from Lean's own decision procedures and SMT bridges [W36]. Machine-learning provers have
concentrated on Lean (PutnamBench and similar benchmarks [W37]), which matters when agents write
proofs. Dafny remains a viable choice; open question 3 names the spike that settles it.

**Translation**, from TIR:

| Plato | Lean |
|---|---|
| product type, sum type | `structure`, `inductive` |
| `Array<T>`, `Integer`, `Boolean` | `Array T`, `Int` (overflow is a separate obligation), `Bool` |
| `Number` | either an opaque type `PNum` with no axioms, or `ℝ`; a proof that goes through with `PNum` holds for every `Number` semantics, binary32 and binary64 included |
| function | `def`; recursion and loops through `termination_by` from `decreases` |
| `deferred` function | `opaque` constant with its `ensures` as an `axiom` |
| intrinsic | `opaque`, with axioms only where the stdlib states a contract for it |
| law, theorem | `theorem` with the proof `sorry`, regenerated on every build |

The proof lives in a hand-written file that imports the generated module; `lake build` checks it,
cached by the hash of both files. A change in Plato that changes a statement breaks its proof loudly
rather than silently.

*Illustrative, the milestone's theorem:*

```lean
-- Generated from 00-foundation (Number opaque). Do not edit.
opaque PNum : Type
inductive Severity | error | warning | info
def Severity.IsError : Severity → Bool
  | .error => true | .warning => false | .info => false
structure Diagnostic where
  severity : Severity
  code : String
  message : String
  where_ : Provenance
  measure : PNum
structure Report where
  checks : Array Check
  diagnostics : Array Diagnostic
def Merge (a b : Report) : Report := ⟨a.checks ++ b.checks, a.diagnostics ++ b.diagnostics⟩
def IsClean (r : Report) : Bool := !(r.diagnostics.any fun d => d.severity.IsError)
theorem IsCleanIsAMonoidHomomorphism (a b : Report) :
    IsClean (Merge a b) = (IsClean a && IsClean b) := by
  sorry  -- proved in proofs/Foundation.lean from the library lemma that `any` distributes over `++`
```

**`WatertightByConstruction`** (layer 8) is the theorem a proof pays for. Closedness is defined on
vertex indices, so the proof runs with `Number` opaque and holds for every precision. Its axioms are
the contracts of `TriangulateRegion`, `Discretize`, `AlongCoedge` and the vertex numbering, and the
attempt is valuable mostly for the assumptions it forces into those contracts. The first version
named two candidates, both still open: several parameter-space points mapping to one vertex at a pole
or a cone apex, and whether `TriangulateRegion` promises "each boundary segment used once in the
loop's direction, each interior edge twice in opposite directions" or something weaker.

### 4.6 Empirical statements: the strongest honest tooling

Every tolerance statement over evaluated curves and surfaces stays empirical: SMT floating-point
theories have no `sin`, and Lean's `Float` is opaque to its logic [W16, W18]. For these the system
offers, in order of value:

1. **Generators that respect constraints, with integrated shrinking** (2.8), over pooled witnesses,
   transforms and sealed constructors, with dependent domains and exhaustive small domains.
2. **Targeted search** for the worst margin over choice sequences [W19b], so a criterion is tested
   where it is tightest, not where cases are typical.
3. **Three-valued verdicts and branch stability** from the reference profile (2.9).
4. **Sound bounds from the interval profile** where sampling cannot see between samples: a sagitta
   over a parameter interval, a deviation over a surface patch. The evaluator runs the measure with
   `Number` as an interval [W23]; a conditional whose test is undecided evaluates both branches and
   joins numeric results, or reports "undecided" otherwise; subdivision tightens the enclosure. This
   turns "sampled at three points" into "bounded on the whole span" for the analytic cases.
5. **Closed forms as zero-parameter laws** on witnesses with known measures: areas, lengths, Euler
   characteristics (VALIDATION-MATH.md 7.2).
6. **Metamorphic laws** over transform parameters (cube rotations, scaling by powers of two, which is
   exact and so compared with `===`; translation far from the origin; edge and face reversal;
   renumbering) [W21].
7. **Agreement across backends** (section 5).
8. **Mutation testing on TIR.** Operators: swap `<` and `<=`, add or remove `- 1` in index arithmetic,
   swap the branches of a conditional, drop a term of a sum, flip an orientation flag, remove a
   correction step (`Wrap`'s second line). Each mutant is emitted through the same writers, so one
   implementation serves every backend. The report gives a kill matrix of statements by mutants, a
   score per function, and the surviving mutants, each of which is a place where the specification
   does not notice a change [W26, W38].
9. **Branch coverage** of library code by the statement suite, from the checked build.

### 4.7 Where the statements of 00 and 04 land

Expected classes [J], from reading the statements; the verifier decides.

| Engine | 00-foundation | 04-discretization |
|---|---|---|
| Type checker | exhaustiveness on `Periodicity`, `Severity`, `ConstraintGroup`, `Provenance`, `MeshVertexProvenance`, `DomainSide`; units of every tolerance comparison; construction of `Check` and `Report` only through their sealed constructors | exhaustiveness on `Limit`, `RefinementReason`; construction of `EdgeDiscretization` only through its sealed constructors |
| Evaluation, exhaustion | `OppositeSideIsInvolution`; laws over `Severity`; closed witnesses | none |
| SMT, Int and Seq | `SamplesHaveRequestedCount`, `SamplesStartAtRangeStart`, `SamplesEndAtRangeEnd` (copies), `MergeIsAssociative`, both identity laws, `IsNoneExactlyWhenNegative`, the count `ensures` of `ReportOf` and `Merge`, `Report`'s invariant by induction over its three constructors | `ReversedIsInvolution`, `ReversedReversesParameters`, `ReversedReversesPoints`, `Reversed`'s and `AlongCoedge`'s `ensures`, `DiscretizeAll`'s indexing `ensures`, `SharedPolylineClosesEveryEdge` from those contracts |
| SMT, FP bit-precise | `CheckWithin` and `CheckExact` `ensures`; `Check`'s invariant at its constructors; `WorseOfHoldsExactlyWhenBothHold`; `WorseOfIsAssociative` (its preorder tests NaN, which a Real model gets wrong); `ShortestDifferenceAtMostHalfPeriod` and `WrapLandsInPeriod` within a time budget | none expected |
| Lean, `Number` opaque | `IsCleanIsAMonoidHomomorphism`, `ReportsFormAMonoid`, `WorseOfFoldIsWellDefined` | `SharedPolylineClosesEveryEdge` if SMT fails; `EdgeReversalInvariance` (a frame argument: `Discretize` reads nothing that `WithEdgeReversed` changes); `ChordalRefinementIsMonotone` (induction over the bisection tree); `DiscretizeTerminates` (counting) |
| Lean, `Number` as ℝ | `ParameterToleranceBoundsMotion` to first order; `UvToleranceBoundsMotion` (triangle inequality); `CoincidenceChainBound` without its rounding term | `TurningAngleBoundedByTangentDeviation` (triangle inequality for angles); the circle sagitta behind `ArcSegmentCount` (MetiTarski also fits [W14]) |
| Empirical | the rounding laws (`WrapStaysInClass`, both `NearestUnwrapped` laws, `CoincidenceComposesWithSummedTolerance`), `DomainContainsItsSamples`, `SamplesStrictlyIncreasing` | every geometric predicate in the contracts of `Discretize`, `RefineEdge` and `ImagePoints`; `TighterChordalNeverFewerPoints`; the `Refine` laws; `ArcCriteriaCountMeetsChordal`, with an interval bound |

### 4.8 One command, one report

`plato verify` runs, in order and incrementally (every stage keyed by content hashes of the TIR
closures it reads):

1. the front end (D2), stopping on errors;
2. exhaustion and compile-time evaluation;
3. SMT on obligations whose VC changed, in parallel, with the cache;
4. `lake build` on proof files whose inputs changed;
5. the evaluator over every statement not proved, solved or exhausted, plus a light sanity run over
   those that are; shrinking; reference re-evaluation for tolerance comparisons;
6. compiled backends named by `--backends`, with the same cases, and comparison (section 5);
7. mutation testing and targeted search, when asked for (`--mutation`, `--search`);
8. the report: JSON for tools, Markdown for each layer README between markers, and a diff against
   the last committed report that fails on any status that fell.

Selection flags: `--changed`, `--layer`, `--function F` (its contract and every statement that
cites it), `--law L`, `--replay <case>` with `--explain`. The MCP tool `plato_verify` takes the same
arguments and returns the same JSON, so an agent's tool result and a person's terminal show one
truth.

## 5. Cross-backend validation

**One orchestrator, thin kernels.** Each backend's verification build is a small program that answers
JSON requests on standard input: `manifest` (its statements, parameters, domains, clause identifiers);
`run` (one statement on one case, given as a witness name or a generator and its choice sequence),
returning the verdict, every logged measure and bound, and a hash of the branch trace; and `call` (one
function on given arguments), returning the result. Generation policy, shrinking, comparison and
reporting live once, in Plato.Verify. TARGET-LANGUAGE.md 3.8 reached the same shape: do not port the
reflection runner; make the harness data-driven.

**Same inputs everywhere.** Generators are Plato code compiled into every backend, and domains map
choices to values with exact operations only, so one choice sequence yields bit-identical inputs on
every backend.

**What is compared:**

- verdicts, on every case;
- integers, Booleans, tags and indices, bitwise;
- `Number`s: bitwise under the portable mathematics profile below; otherwise within an envelope
  stated per transcendental function and accumulated along the path;
- on disagreement, the first TIR node whose value differs, found by comparing the evaluator's trace
  with the backend's by node identifier.

**What the compiler must guarantee** for a comparison to mean something:

1. **One `Number` width per compilation**: binary64 on CPU backends, binary32 only in a GPU profile
   (TARGET-LANGUAGE.md 5.4).
2. **No contraction and no reassociation.** Writers emit the flags that forbid fused multiply-add
   (`/fp:precise`, `-ffp-contract=off`, `nvcc --fmad=false`) and keep Plato's left-to-right
   association. C# and Node were measured not to contract (TARGET-LANGUAGE.md 3.6).
3. **IEEE round-to-nearest-even** for + − × ÷ √ and conversions.
4. **One meaning for every intrinsic**: `Round`, `Epsilon` (they differ across backends today), the
   signs of integer division and modulo, `Min` and `Max` with NaN, `Integer` width (64-bit
   recommended), and overflow, which traps in checked builds.
5. **Transcendental functions in two profiles.** *Portable*: the stdlib implements `Sin`, `Cos`,
   `Atan2`, `Exp`, `Log` and `Pow` in Plato with fixed algorithms, correctly rounded where published
   algorithms allow [W39], so every backend computes the same bits. *Host*: the platform's library,
   faster, compared within an envelope. Recommendation: portable for verification and release
   conformance; host allowed in production builds once conformance shows agreement within the
   envelope. This is the direction of `plato-378` (shrink the host intrinsic kernel).
6. **Exact serialization**: JSON numbers round-trip bitwise (hexadecimal floats or 17 significant
   digits), with explicit encodings for NaN, the infinities and -0.
7. **No capacity limits** on arrays or strings in any writer.

**At release**, every law, contract and invariant runs on every backend over the same cases, and the
pipeline runs end to end on the witness corpus and the public STEP files, comparing mesh integer
arrays bitwise and positions bitwise under the portable profile.

## 6. Use cases, ranked by value

Ranked by what each does for the efficiency of creating and validating the library once code
generation works [J].

| Rank | Use case | Made possible by | Used by |
|---|---|---|---|
| 1 | The implementing agent's loop: a counterexample in the tool result, shrunk, explained, blamed, replayable, in seconds | D3 to D5 | implementing agents |
| 2 | Spec checking while writing: names, types, units, totality, runnability, in the edit loop | D1, D2 | the nine layer authors, reviewers |
| 3 | Inputs for constrained types: pooled witnesses, composed generators, sealed constructors, SMT-found topologies; laws over `BrepModel` run at all | D5, D8 | everyone |
| 4 | Contracts at layer boundaries with blame, in checked builds | D3, D4, D7 | agents integrating layers |
| 5 | Static discharge of the combinatorial core; consistency of the predicates at small scope | D4, D8 | design reviewers (PLAN.md done condition 5), the owner |
| 6 | Statement status in documentation and the editor, and "blocked by" as a progress meter | D5, D11 | reviewers, the owner, TASKS.md |
| 7 | Three-valued verdicts and branch-stability reports | D6 | agents tuning tolerances; robustness of topology decisions |
| 8 | Minimal failing STEP files: Part 21 reduction that keeps the failing statement and diagnostic code [W40] | D5 and layer 3's provenance map | implementing agents, the regression corpus |
| 9 | Release conformance across C#, TypeScript, Rust and C++ | D7 and section 5 | the owner, at release |
| 10 | Mutation scores and surviving mutants per function | D10 | the owner judging specification strength; agents strengthening it |
| 11 | Lean proofs of the index-level theorems | D9 | the owner |
| 12 | Growth tests from `cost` clauses (vertex count against chordal bound, VALIDATION-MATH.md 6.1) | D5 | the owner |

## 7. Plan

### 7.1 Compiler work, in order

1. **D1 and D2**, with short-circuit `&&` and `||`, `implies`, `===`, `all` and `any`, tolerance
   comparison typing, and `ITolerance`, `RoundingTolerance` and `IDomain` in stdlib `foundation`;
   SEMANTICS.md gains a section on specifications in the same change, as its last paragraph requires
   of language changes. The library gains at once: every layer's specifications are checked.
2. **D3**: elaboration of every form, with construction-site obligations.
3. **D4 and D5**: the evaluator and the orchestrator with pools, derived generators, choice sequences,
   shrinking, vacuity, blame, explanation traces, the JSON report, and `plato_verify`. This is the
   inner loop, and milestone M1's core.
4. **D6**: reference and interval profiles.
5. **D7**: checked and verification builds, C# first; TypeScript second, since it is the second
   target (TARGET-LANGUAGE.md 4.1); then Rust; C++ when a consumer needs native code.
6. **D8**: SMT, Int and Seq first, FP second, with the cache and model replay.
7. **D9**: the Lean translator and proof checking.
8. **D10 and D11**: mutation, documentation tables, editor hover.

### 7.2 Tooling, in order

1. **A rewrite tool** that turns the sandbox's spec files and the stdlib's `stdlib/tests/*.laws.plato`
   into the new syntax (rules in 7.3), using Navigation to rename references; it runs once per folder.
2. `plato_check` extended to the new forms (it reports what D2 reports).
3. `plato verify` as CLI and `plato_verify` as an MCP tool in the same server.
4. The report renderer: layer README tables, the gate log.
5. Navigation hover with statuses.
6. The STEP reducer, with layer 3.
7. The release pipeline: all backends, mutation, committed report.

### 7.3 What the sandbox does now

Write the current spec files so the rewrite is mechanical. Each rule names the rewrite it enables.

1. **Classify every `Law_` by kind in its comment**: `model` (a predicate over data), `library` (a law),
   or `convention` (holds for values built by this layer). The foundation README's table already
   does; layer 4 uses severity ("test" means library). Rewrite: model to predicate, library to `law`,
   convention to invariant or constructor `ensures`.
2. **Every quantifier names its domain with `in`**, using names that exist (`n.Range`, an array, a
   layer helper such as `m.EdgeIndices`). No `UpTo` (14 uses in `discretization.spec.plato`, declared
   nowhere). The 110 domain-less `forall` that cite a guarded law can stay only when the law's guard
   is one of `xs.IsValidIndex(i)`, `i >= 0 && i < n`, or `i >= 0 && i + 1 < n`, from which the
   rewrite infers the domain.
3. **Guards only in the leading form** `pre ? claim : true`, nested for several preconditions. Rewrite:
   each condition to a `requires`. No `||` guards and no dummy-array guards in new laws.
4. **Copies compare with `Identical`**, never `==` with a comment. Rewrite: `===`.
5. **Tolerance comparisons as `measure <= tol.Value`**, with `tol` of a tolerance type. Rewrite:
   `measure <= tol`. Criteria fields compared this way are recorded as candidates for tolerance types.
6. **`constructor` lists stay as they are.** Rewrite: `sealed by`.
7. **`measure` stays.** Rewrite: `cost`; a `measure` in a recursive function becomes `decreases`.
8. **One `deferred` string per function**, not a comment as well. Rewrite: the `deferred` clause.
9. **Theorems keep `given`, `assume`, `conclude`.** Rewrite: parameters, `requires`, body.
10. **Witnesses keep the `Witness_X(_: T): T` form**, and parameterized witnesses take their
    parameters as ordinary parameters with a comment giving each one's range. Rewrite: `witness`,
    with the ranges as `in` domains.
11. **An existential states its witness** in the conclusion, or is marked for restatement (5 cases).
12. **Each spec header matches exactly one declaration**, which it does today; the rewrite moves the
    clauses onto it and deletes the spec file.

### 7.4 First milestone: the whole loop on `00-foundation`

Done when all of the following hold:

1. `00-foundation` is in the new syntax: `foundation.spec.plato` deleted, its invariants and seals in
   the type files, its 25 contracts on their functions, its 27 library laws as `law`, the 4 model laws
   folded into invariants and predicates, the 3 convention laws into invariants and `ensures`, its 8
   theorems in `foundation.laws.plato`, its 4 witnesses as `witness`.
2. `plato check` over the stdlib tiers and the layer reports no error, in under 2 s warm after an edit
   to one function.
3. `plato verify 00-foundation --backends eval,cs,ts` reports a status for every statement. Expected:
   `OppositeSideIsInvolution` exhausted; at least the Int and Seq row of 4.7 solved; the FP row
   attempted; every other law tested on at least 600 cases with vacuity reported; the invariants of the
   tolerance and domain types checked at every construction during the run; `Check` and `Report`
   values generated from their sealed constructors; C# and TypeScript agree bitwise on every law whose
   closure uses basic operations only, which by reading is every one except those through
   `AngleBetweenDirections` (`atan2`).
4. **Rediscovery.** With the `SmallestNormal` floor removed (from `ResolutionAt`, and from the
   tolerance types' invariants, which state it directly in the new syntax), the verifier finds both
   failures the layer author's hand-written C# fuzzer found (README, "Arithmetic resolution"):
   `SamplesStrictlyIncreasing` on a range of about 4e-323, and
   `ParameterToleranceAtMovesWithinLength` with a length tolerance of about 3e-316. Each is shrunk and
   reported with a replay command, within the inner-loop budget. The author needed 300,000 draws per
   width and a C# mirror of the bodies to find them; the milestone shows the language finds them from
   the declarations alone.
5. **A planted defect.** With `Wrap`'s second correction removed, `Wrap`'s first `ensures` and
   `WrapLandsInPeriod` fail on a shrunk case (a tiny negative `t`, for which `t - period * Floor(t /
   period)` rounds to `period`), and mutation testing reports which statements kill which of the
   layer's mutants.
6. **A proof.** `IsCleanIsAMonoidHomomorphism` proved in Lean against the generated module, status
   "proved, for any `Number`".
7. The layer README's law table generated from the report.

Milestone M2 is `04-discretization` with `Discretize` implemented: the agent's loop of 1.3 on
generators from layers 1 to 3 and 7, blame across layers, the interval bound for sagitta, and the
reference profile's within-rounding rate. Milestone M3 is release conformance on four backends for
layers 0 to 6.

## 8. Open questions for the owner

Each with the fact that would settle it.

1. **Short-circuit `&&` and `||` on `Boolean`.** Recommended. Settled by whether any backend or
   stdlib body needs both operands evaluated: none of the five target languages does (each
   short-circuits its native `&&`), so the remaining fact is a search of the stdlib and the demos for a
   Boolean `&&` whose right operand is relied on to run.
2. **How strict `sealed by` is.** Forbid every other construction site, or allow them with an
   obligation? Settled by counting constructions of `Check`, `Report` and `EdgeDiscretization`
   outside their lists once layers 2 to 7 exist (the foundation README's question 8 asks for that
   count).
3. **Lean 4 or Dafny.** Settled by a spike: translate the foundation's `Check` and `Report` and layer
   4's `Reversed` and `AlongCoedge` into both, and have an agent prove `IsCleanIsAMonoidHomomorphism`
   and `SharedPolylineClosesEveryEdge` in each; compare success and time.
4. **Portable or host transcendental functions** for verification. Settled by whether meshes become
   hashed run evidence (TARGET-LANGUAGE.md question 3) and by the speed of a Plato `Sin` against the
   host's in C#.
5. **A checked-build failure stops, or collects and continues?** Settled by whether any pipeline stage
   is meant to carry on past a defect in the program; the sandbox's "diagnostics, never exceptions"
   covers bad data, not defects.
6. **Laws inside interfaces.** Move the stdlib's generic laws (27 in `stdlib/tests/foundation.laws.plato`)
   into the interfaces they test? Settled by whether implementers should inherit the obligations, and
   by how many of those laws have a single interface as their receiver.
7. **Laws without the `Law_` prefix.** Settled by the number of name collisions the rewrite finds when
   it drops the prefix in the stdlib and the sandbox (one global namespace).
8. **Claimed routes as hard gates.** Should `by smt` and `proof` fail the build when not achieved, or
   only report? Settled by how often a solver upgrade or a timeout changes a status in the first month.
9. **Criteria as tolerance types.** Make `DiscretizationCriteria.Chordal` and its siblings
   tolerance-typed, so their comparisons are recognized and reported apart from model tolerances?
   Settled by whether the severity rule of SPEC-DSL.md section 4 is to be computed from the report.
10. **Derived evidence.** Derive a `Check` (worst measure and where) from a predicate of the form
    `all i in D: measure(i) <= tol`, removing hand-written `Check_` functions that must agree with
    their laws? Settled by how many of layer 7's `Check_` functions have exactly that form once
    written.
11. **The reference profile's mathematics library**: double-double in C#, or a binding to MPFR.
    Settled by the accuracy the verdicts need: at least 20 bits beyond binary64 in every function the
    library calls; double-double gives about 50.
12. **`Integer` width and overflow**: 64-bit everywhere, trapping on overflow in checked builds?
    Settled by the largest index or STEP instance number the corpus needs (TARGET-LANGUAGE.md question
    4) and by whether any stdlib body relies on wrap-around.

## 9. The current state and the gap

### 9.1 Measured facts

Plato at `f6e02cf0`; times on the owner's machine, 2026-10-17, unless dated otherwise.

**Parser and compiler** [R]

- The grammar is a PEG written as C# properties in `parakeet/Parakeet.Grammars/PlatoGrammar.cs`
  (241 lines). `parakeet` is a submodule (`github.com/ara3d/parakeet`) whose commits Plato records
  separately (Plato `AGENTS.md`). `MethodDeclaration` is name, parameters, return type,
  `ConstraintList`, body; `Type` is the optional `unique`, `type` or `primitive`, name, type
  parameters, `ConstraintList`, `ImplementsList`, body. Both have the slot between signature and body
  that section 2 uses.
- The elaborator (`src/Plato.Compiler/Checking/Elaborator.cs`) is 382 lines; a statement form is in
  the language exactly when `ElaborateStatement` has a case for it (SEMANTICS.md). `match` lowers to
  a chain of `TirConditional`s with no new node.
- `Tir.cs` (404 lines) defines 20 node classes. `TirFunction` holds the definition, parameters, return
  type and body, and nothing for contracts. `TirTypeVerifier` checks TIR consistency (rules R1 to R6)
  and is a precedent for TIR-level checks.
- Declaration-level checkers exist as precedents for invariant and sealing checks:
  `TypeConstraintChecker`, `SumTypeChecker`, `ExistentialConceptChecker`.
- No interpreter or evaluator exists in `src/` or `writers/` [M, by search].
- Writers: C# 7,516 lines, C++ 3,290, TypeScript 2,639, Rust 2,165, GLSL 1,181 [M].
- `&&` and `||` evaluate both operands. Bodiless functions pass every gate and become, in C#, a member
  that throws `NotImplementedException` or a self-calling stub (PLATO-PRIMER.md D.7). Per-field
  setters are not derived, although SEMANTICS.md says they are. `==` on arrays is CHK201, and generated
  record equality compares array fields by reference (PLATO-PRIMER.md D.6).

**Numbers and backends** [R, M; TARGET-LANGUAGE.md]

- `Number` is binary32 in C# (`src/Plato.Intrinsics/Number.cs:21`), C++, CUDA and GLSL; binary64 in
  TypeScript and Rust. SEMANTICS.md says 32-bit everywhere; `primitives.plato` says 64-bit.
- Sum types and `match` are emitted only by C#; TypeScript and Rust emit a CHK320 comment; C++ calls a
  type with a sum field "not representable".
- C#: the foundation tier's loop (generate, build, run laws) took 10.3 to 11.6 s; foundation plus
  geometry generated in 16.0 s and compiled in 4.6 s once four defects were worked around.
  TypeScript: about 22 s for three tiers, with 2,476 type errors hidden by `@ts-nocheck`. C++: the
  foundation tier stopped at 100 errors after 92.7 s. Rust: 3,347 errors from `cargo check` in 10.5 s.
- `Round(digits)` and `Number.Epsilon` mean different things in C#, C++ and TypeScript;
  `Number.Epsilon` is the smallest subnormal, not the machine epsilon. `Integer` is a 32-bit `int` in
  C# (`src/Plato.Intrinsics/Integer.cs:19`), 64-bit in Rust, and a binary64 value in TypeScript.
- Neither C# nor Node contracts `a * b + c` into a fused multiply-add (measured); transcendental
  functions differ by platform.

**Laws and the runner** [R; PLATO-PRIMER.md B.2]

- `tests/conformance/Plato.ForwardConformanceTests` finds `Law_` members by reflection, builds 25
  seeded pseudorandom instances per law, draws `Number` from a ten-value special set 30 % of the time
  and otherwise from [-10, 10], and `Integer` from [-8, 8]. It skips, rather than fails, any law over
  a type holding an array, a sum, an interface, no fields, or itself. It has no witnesses, no
  shrinking, no vacuity count.
- Its driver script passes `--scalar=float`, which the CLI now rejects. Driven directly, 35 law cases
  over foundation passed. `docs/gate-log.md` has one conformance row, 2026-07-31: 44 passed, 0 failed,
  3 skipped. `stdlib/VERIFICATION.md`: "Until rung 6 is routinely green, every behavioural claim about
  `stdlib/` ... is backed by human inspection, not by a test."
- The triangulation subset route took about a minute per iteration on 2026-08-03 (14 to 24 s to
  resolve, 11 to 16 s to generate, 14 to 26 s to build and test).

**Front-end gates** [M; PLATO-PRIMER.md E]

- The gate driver over the three stdlib tiers plus one design folder: 12 to 15 s cold, about 3,850
  functions type-checked; `00-foundation` passed with 3,937 functions. Navigation rebuilds warm in
  under a second but does not resolve overloads or compute types.
- The spec files cannot be parsed, so every front-end run must exclude them; the stdlib's three
  `brep.*.plato` files must be excluded too, because the sandbox redeclares their names in Plato's one
  namespace.
- The first version found five defects in SPEC-DSL.md's examples that a checker would report (an
  undeclared `UpTo`, `EdgeDomain(e).Start` where the field is `Range`, a law cited with the wrong
  parameters, two names no layer exports); layer 4's author has since corrected the `Range` one.

**The sandbox's specifications** [M, at 13:48 on 2026-10-17; layers 01, 02, 03, 05 and 06 were still
being written, so whole-sandbox counts will move]

- Whole sandbox: 201 `Law_` declarations; 187 guard tails `: true` in laws files; 8 `Witness_`
  declarations; in spec files 207 `forall` (110 without a domain, 24 lines nesting two), 5 `exists`,
  14 `UpTo` (declared nowhere), 78 `invariant`, 97 `requires`, 240 `ensures`, 39 `measure`, 19
  `constructor`, 26 `theorem`, 0 `conjecture`, 27 `deferred`, 23 `tested by`; 25 comments
  "exact by construction".
- `00-foundation`: 34 laws (4 model, 3 convention, 27 library), 4 witnesses, 17 uses of `Identical`;
  `foundation.spec.plato` is 425 lines with 11 invariant blocks, 25 contracts and 8 theorems. The
  author's scratch fuzzer mirrored the bodies in C# and made 300,000 adversarial draws in each of
  `double` and `float`; it found two failures on subnormal values, and a 2,000,000-draw run found worst
  errors of 2 unit roundoffs for `Wrap` and 3.9 for `NearestUnwrapped`.
- `04-discretization`: 35 laws (25 predicates by severity, 10 library), no witnesses, 53 `forall` (36
  without a domain), 3 laws with dummy-array guards; `discretization.spec.plato` is 307 lines.

### 9.2 Fixes assumed

Assumed done before execution starts, and not weighed in this design:

- `Number` binary64 in C# (`plato-370`), one width per compilation, binary32 only in a GPU profile;
  SEMANTICS.md and `primitives.plato` agreeing.
- Sum types and `match` emitted by the TypeScript, Rust and C++ writers; C++ with heap-backed arrays,
  unbounded strings and the `List` and `Buffer` builders.
- The geometry tier's C# compiles (the unescaped `base` parameter, two CS1929, one CS0117).
- TypeScript output type-checks without `@ts-nocheck`; Rust's foundation tier compiles; C++'s
  foundation tier compiles.
- Per-field setters derived as SEMANTICS.md says; `==` on arrays structural; record equality comparing
  arrays element by element.
- The law runner's dead `--scalar=float` flag; laws over arrays, sums and zero-field types
  constructible.
- One meaning for `Round` and `Number.Epsilon` in every writer.
- Navigation models sum types (`plato-364`); `plato_check` is tier-aware (`plato-389`);
  interface-generic law bodies use the right override (`plato-374`); functions with a builder as first
  parameter are emitted (`plato-416`); `default` resolves.

## 10. Prior art

| System | Where specifications live | How obligations are discharged | Floating point | Lesson for Plato |
|---|---|---|---|---|
| Eiffel [W2, W2b] | class invariants, `require`, `ensure` in the language | run-time checks; AutoTest uses contracts as test oracles | run-time only | contracts plus generated inputs find real faults without hand-written oracles |
| Ada 2012 and SPARK 2014 [W1, W30] | aspects: `Pre`, `Post`, `Type_Invariant`, `Dynamic_Predicate`; ghost code | run-time checks under an assertion policy; GNATprove through Why3 and SMT | IEEE semantics; proofs of bounds | contracts in the language, proofs by a separate tool; SPARK began as comments and moved into the language once the forms settled |
| Dafny [W3, W3b] | in the language | Boogie and Z3, user lemmas; test generation from the verifier | mathematical `real` | strong for sequences and indices |
| Whiley [W4] | in the language | a verifying compiler | limited | designing for verification shapes the whole language |
| Frama-C ACSL, JML [W6, W7] | comments | provers; run-time checking of an executable subset | ACSL separates reals from floats | annotation layers over another's language need sustained separate investment |
| Code Contracts [W5] | library calls and a binary rewriter | rewriter; abstract interpretation | none | the rewriter fell behind the compiler and died |
| Kani, Prusti, Creusot [W8, W9] | attributes; Pearlite | bounded model checking; Viper; Why3 | Kani models IEEE bit-precisely | contracts can stand in for verified functions (`stub_verified`) |
| Liquid Haskell, F* [W10] | refinement types | SMT inside the type checker | floats as reals | rejected for Plato (2.4) |
| QuickCheck, SmallCheck [W31, W41] | properties as functions | random and exhaustive small-scope testing | none | properties as ordinary code; exhaustive small domains |
| Hypothesis [W19, W32] | properties and strategies | generation over choice sequences; integrated shrinking; targeted search | float strategies with special values | the model for 2.8: shrinking that stays inside the generator's constraints |
| QuickChick, Luck, Korat [W24, W25, W42] | generators derived from predicates or relations | derivation; constraint-guided generation | none | generators for constrained structures can be derived or guided |
| Lean 4 and mathlib [W35, W36] | a pure functional language with proofs | the kernel; tactics; SMT bridges | `Float` opaque to the logic | the translation target closest to Plato |

The pattern, for an owner who controls the language [J]: systems whose language team owned the
specification syntax and the tools (Eiffel, Ada with SPARK 2014, Dafny, Whiley) kept them coherent;
annotation layers over a language someone else controlled (JML, ACSL, Code Contracts) depended on a
separate team keeping pace, and one died when it did not. Plato is in the first position.

## Sources

- [W1] AdaCore, SPARK user's guide: https://docs.adacore.com/spark2014-docs/html/ug/
- [W2] Eiffel, Design by Contract: https://www.eiffel.org/doc/solutions/Design_by_Contract_and_Assertions
- [W2b] Wei and others, "Stateful testing: finding more errors in code and contracts" (AutoTest):
  https://arxiv.org/abs/1108.1068
- [W3] Dafny: https://dafny.org/
- [W3b] Dafny test generation, Dafny workshop at POPL 2024:
  https://popl24.sigplan.org/details/dafny-2024-papers/7/Dafny-Test-Generation
- [W4] Whiley: https://whiley.org/
- [W5] Microsoft, Code Contracts (.NET Framework only):
  https://learn.microsoft.com/en-us/dotnet/framework/debug-trace-profile/code-contracts
- [W6] Frama-C, ACSL and E-ACSL: https://frama-c.com/html/acsl.html
- [W7] OpenJML: https://www.openjml.org/
- [W8] Kani function contracts and `stub_verified`: https://rust-training.ferrous-systems.com/latest/book/kani;
  Creusot: https://github.com/creusot-rs/creusot
- [W9] Prusti: https://github.com/viperproject/prusti-dev
- [W10] Liquid Haskell: https://ucsd-progsys.github.io/liquidhaskell/; F*: https://fstar-lang.org/
- [W11] Z3: https://github.com/Z3Prover/z3; Bradley, Manna, Sipma, "What's decidable about arrays?",
  VMCAI 2006
- [W12] Alloy and the small-scope hypothesis: https://alloytools.org/
- [W14] MetiTarski: https://www.cl.cam.ac.uk/~lp15/papers/Arith/
- [W16] Cimatti and others, "Satisfiability modulo transcendental functions via incremental
  linearization": https://arxiv.org/abs/1801.08723
- [W18] Lean language reference, floating-point numbers:
  https://lean-lang.org/doc/reference/4.30.0/Basic-Types/Floating-Point-Numbers/
- [W19] Hypothesis: https://hypothesis.readthedocs.io/
- [W19b] Löscher and Sagonas, "Targeted property-based testing", ISSTA 2017
- [W21] Chen and others, "Metamorphic testing: a review of challenges and opportunities", ACM
  Computing Surveys 51(1), 2018
- [W23] IEEE 1788-2015, the standard for interval arithmetic
- [W24] Boyapati, Khurshid, Marinov, "Korat: automated testing based on Java predicates", ISSTA 2002
- [W25] Lampropoulos, Paraskevopoulou, Pierce, "Generating good generators for inductive relations",
  POPL 2018
- [W26] Stryker mutation testing: https://stryker-mutator.io/
- [W27] Brain, Tinelli, Rümmer, Wahl, "An automatable formal semantics for IEEE-754 floating-point
  arithmetic", ARITH 2015 (the SMT-LIB FloatingPoint theory)
- [W28] Findler and Felleisen, "Contracts for higher-order functions", ICFP 2002
- [W29] Spock framework, power assertions: https://spockframework.org/spock/docs/
- [W30] Ada 2012 Reference Manual, 7.3.2 "Type invariants" and 3.2.4 "Subtype predicates":
  http://www.ada-auth.org/standards/12rm/html/RM-7-3-2.html
- [W31] Runciman, Naylor, Lindblad, "SmallCheck and Lazy SmallCheck", Haskell Symposium 2008
- [W32] MacIver and Donaldson, "Test-case reduction via test-case generation: insights from the
  Hypothesis reducer", ECOOP 2020
- [W33] Barbosa and others, "cvc5: a versatile and industrial-strength SMT solver", TACAS 2022
- [W34] Niemetz and Preiner, "Bitwuzla", CAV 2023
- [W35] de Moura and Ullrich, "The Lean 4 theorem prover and programming language", CADE 2021;
  mathlib: https://github.com/leanprover-community/mathlib4
- [W36] lean-smt, an SMT tactic for Lean: https://github.com/ufmg-smite/lean-smt
- [W37] Tsoukalas and others, "PutnamBench", NeurIPS 2024 Datasets and Benchmarks; Loughridge and
  others, "DafnyBench", 2024
- [W38] DeMillo, Lipton, Sayward, "Hints on test data selection: help for the practicing
  programmer", IEEE Computer 11(4), 1978
- [W39] Sibidanov, Zimmermann, Glondu, "The CORE-MATH project", ARITH 2022 (correctly rounded
  mathematical functions)
- [W40] Zeller and Hildebrandt, "Simplifying and isolating failure-inducing input", IEEE TSE 2002;
  Regehr and others, "Test-case reduction for C compiler bugs" (C-Reduce), PLDI 2012
- [W41] Claessen and Hughes, "QuickCheck: a lightweight tool for random testing of Haskell
  programs", ICFP 2000
- [W42] Lampropoulos and others, "Beginner's Luck: a language for property-based generators",
  POPL 2017

## Appendix A. Effort notes

Notes only; nothing above is ordered or weighed by them.

- **The sum-type precedent.** `tracker/issues/plato-232.md`: design, specification and test corpus
  filed and closed on 2026-07-27; the grammar landed as parakeet `12aad78`, the AST and front end in
  Plato commits `1d3ed84` and `507de64`. Comparing two sum values needed a second fix six days later
  (`stdlib-402`). TypeScript and Rust emission are still missing at `f6e02cf0`. A language feature's
  core lands in days; its tail across writers and tools takes longer.
- **Sizes for calibration**: elaborator 382 lines; `Tir.cs` 404; writers 1,181 to 7,516 lines; the
  gate driver that runs every front-end check, 94 lines over the compiler's assemblies.
- **The first version's estimates**, made for a lowering tool over unchanged Plato: two to four days
  for parsing and checking spec blocks; one to two weeks for runner extensions (witnesses, dependent
  generation, vacuity, counterexamples); a few days per theorem proved in Dafny.
- **TARGET-LANGUAGE.md**: backing C# `Number` with `double` is about a day, about 25 code sites.
