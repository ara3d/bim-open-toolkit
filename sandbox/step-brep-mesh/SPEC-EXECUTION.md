# Making the specification DSL executable

Written 2026-10-17 for TKT-299 (the STEP B-rep to mesh design sandbox). It answers one question for
the owner of Plato and of this sandbox: how to turn the specification DSL of
[SPEC-DSL.md](SPEC-DSL.md) into something that **validates** specifications, **proves** what can be
proved, and **generates executable tests**, and whether that machinery belongs in Plato, in a
separate language, or in tooling over Plato as it is. It ends with ranked use cases, further
improvements, and open questions.

Evidence tags. **[R]** read in a file named in the text. **[M]** counted or measured during this
research (the method is described). **[W]** from an external source, numbered in "Sources". **[J]**
my judgement, with the reasons given. Plato paths are relative to `C:\Users\cdigg\git\plato` at
commit `f6e02cf0`; sandbox paths are relative to this folder.

Terms used throughout:

- **Law, witness, oracle, check**: as in SPEC-DSL.md section 2. A *law* is a `Law_` Boolean function
  read as a universally quantified statement; a *witness* builds a well-formed example value; an
  *oracle* computes a quantity by an independent route; a *check* is a law evaluated over one value.
- **Lowering**: rewriting a construct into simpler constructs with the same meaning, here a spec
  clause into an ordinary Plato function.
- **Vacuous pass**: a law of the form `pre ? claim : true` that returned `true` because `pre` was
  false, so the claim was never tested.
- **SMT solver** (satisfiability modulo theories): a program such as Z3 or cvc5 that decides
  formulas over theories. **LIA**, **LRA**, **NRA**: linear integer, linear real, and nonlinear real
  arithmetic.
- **Shrinking**: reducing a failing test input to a smaller one that fails the same way.
- **Metamorphic relation**: a rule relating the outputs of two runs on related inputs (rotate the
  input, the output rotates), used where no oracle gives the expected output.
- **Mutation testing**: changing the code under test in small ways and counting which changes the
  tests detect; an undetected change marks a weak test.
- **TIR**: Plato's typed intermediate representation, produced by the elaborator once overloads are
  resolved (`docs/compiler-pipeline.md`).
- **Rung**: one level of the seven-level verification ladder in `stdlib/VERIFICATION.md`; rung 6
  executes the laws.

## 0. The answer in brief

**Recommendation [J].** Keep Plato unchanged for now. Keep the spec text as the single source, in
the DSL the sandbox already uses. Build a small tool that parses spec blocks, **lowers every clause
into an ordinary Plato function** with a fixed name prefix in a generated file, and writes a manifest
recording what each generated function means (invariant, precondition, postcondition, theorem) and
where it came from. The real Plato front end then binds and type-checks the generated functions, and
an extended law runner executes them. This is option C (convention plus tooling) for semantics, with
a thin option B (a separate front end) for syntax. Promote a stable subset into Plato (option A) only
after one implementation cycle has shown which constructs earn compiler support, as SPARK did when
its comment annotations became Ada 2012 aspects [W1].

| Stage | When | What it delivers | Rough cost [J] |
|---|---|---|---|
| 0 | now | A recipe that stages the stdlib plus the sandbox's real Plato files and runs `Plato.CLI lint`; a script that lists every identifier in the spec files that Navigation cannot find | hours |
| 1 | during Phases 2 and 3 of [PLAN.md](PLAN.md) | `spec check`: parse spec blocks, lower them to `Inv_`, `Pre_`, `Post_`, `Law_Theorem_` functions, type-check those with the real checker, map findings back to spec lines; lints for the SPEC-DSL authoring rules; a traceability report and generated law tables | 2 to 4 days |
| 2 | once law and validator bodies compile to C# | laws run on witnesses before any algorithm exists; a contract harness around each deferred function; vacuity rates; tolerance-aware verdicts; counterexample reports | 1 to 2 weeks |
| 3 | during implementation | shrinking of parameterized witnesses, minimal failing STEP files, metamorphic transform families, mutation scores per law, a coverage report | weeks, in pieces |
| 4 | optional, per theorem | bounded consistency checks of the combinatorial laws with an SMT solver; Dafny proofs of the index-level theorems (watertightness, vertex layout) | days per theorem |

**Why [J].** First, the DSL's own definition already says every construct reduces to Plato
functions (SPEC-DSL.md section 3, "Reduction"), so lowering is the semantics the owner wrote down,
not a new one, and the real type checker then checks spec expressions at no extra cost. Second, the
executable half (rung 6) is the expensive and fragile part of Plato today, and options A and B do
not make it cheaper; option C uses it as it is. Third, Plato's parser lives in the `parakeet`
submodule, which Plato's `AGENTS.md` assigns to another repository, and the compiler is edited by
several sessions at once; a DSL that is still changing does not belong there yet.

**Main risk [J].** Everything executable depends on generating and compiling C# for the sandbox's
declaration closure with a 64-bit `Number`. Today `Number` wraps a 32-bit `float`
(`src/Plato.Intrinsics/Number.cs:21`), and at building coordinates in millimetres a 32-bit value
cannot resolve the model tolerance, so every geometric law would fail on rounding. Stage 1 is
designed to be useful without execution for that reason.

## 1. What the DSL must express

Restated from SPEC-DSL.md, with the formal reading of each statement and what a checker needs to
handle it. "Binding" is resolving names to declarations; "typing" is checking that the expression
is a well-typed `Boolean`.

| # | Statement | Sandbox form | Formal reading | A checker needs |
|---|---|---|---|---|
| 1 | Type invariant | `spec T { invariant P; }` | every value of `T` the program can produce satisfies `P(self)` | binding of `self`; typing; a totality check (no unguarded index) |
| 2 | Constructor list | `constructor F;` | no function other than a listed `F` builds a fresh `T` | every construction site of `T` in the whole program, including implicit tuple-to-struct coercions (SEMANTICS.md section 6) |
| 3 | Precondition | `requires P;` | the caller owes `P(args)`; behaviour is unspecified otherwise | binding of parameters; typing |
| 4 | Postcondition | `ensures Q;` | for all arguments, all `requires` together imply `Q(args, f(args))` | binding of `result`; typing; an evaluation order (the result's invariants before clauses that index it) |
| 5 | Measure | `measure M;` | cost is proportional to `M`, or `M` decreases across recursion | typing as a number; no semantic check, only a growth test |
| 6 | Deferred marker | `deferred "...";` | the body is still to be written | a match with a bodiless declaration |
| 7 | Law | `Law_X(a: A, ...): Boolean => pre ? claim : true;` | for all `a`, `pre(a)` implies `claim(a)` | the leading guard separated from the claim, for vacuity counting; a sampling plan for continuous parameters; generators that respect the guard |
| 8 | Theorem, conjecture | `given`, `assume`, `conclude`, `because`, `tested by` | for all givens, the conjunction of the assumptions implies the conclusion; `because` is prose | binding of givens; typing; `tested by` names that resolve to laws |
| 9 | Quantifier | `forall (x: T) in D : E`, `exists ...` | as in logic; `D` is a finite range or a continuous domain | a domain to enumerate or sample; for `exists`, a term that produces the witness |
| 10 | Witness | `Witness_X(_: T, ...): T` | a constructive proof that `T`'s invariants can be satisfied | the invariants of `T` evaluated on the result |
| 11 | Oracle | `Oracle_X(...)` | an independent computation of a quantity | a call-graph check that it never reaches the code it checks |
| 12 | Approximate equality | `Coincident(a, b, tol)` | `|a - b| <= tol`, with `tol` a named parameter | lints: no numeric literal in a comparison; exact `==` only on `Integer`, `Boolean`, typed indices, and sum tags; a verdict policy for rounding |
| 13 | Check | `Check_X(...): Check` | the evidence form of one law: held, worst measure, where | agreement with the law it names |

Facts about Plato that shape every option [R, `docs/SEMANTICS.md`]:

- There are no exceptions, so a violated contract cannot abort a call inside the language. Contract
  checks live in a test harness, or return diagnostics as data (the sandbox's decision D8).
- `&&` and `||` evaluate both operands, so every generated guard must use `? :` (SEMANTICS.md
  section 6).
- One global namespace: generated names need a prefix no author uses.
- Sum types emit to C# only; the TypeScript and Rust writers reject them (CHK320). The sandbox uses
  sums for all geometry, so execution goes through C#.
- A bodiless function is an intrinsic obligation to the compiler. The sandbox overloads it to mean
  "deferred", which only the spec tooling can tell apart.

## 2. Where the pieces stand today

Findings that any implementation starts from.

**The law runner** (`tests/conformance/Plato.ForwardConformanceTests/LawTests.cs` and
`ConformanceSupport.cs`) [R]. It discovers `Law_` members by reflection over generated C#, builds 25
pseudorandom instances per law (`ValueGen.N`), draws `Number` from a ten-value special set 30% of the
time and otherwise uniformly from [-10, 10], draws `Integer` from [-8, 8], seeds from a hash of the
law's name, and marks a law *ignored* when a parameter type cannot be built. It has no witnesses (no
`Witness_` function exists in `stdlib/tests` [M, by search]), no vacuity count, no shrinking, and no
dependent generation (an index is drawn without regard to the model it indexes); it reports failures
through `ToString()`.

**Array-holding types may never run** [R, not confirmed by execution]. `ValueGen.CanCreate` rejects
interface types, and the generated C# in the working tree declares an `Array<T>` field as
`IReadOnlyList<T>` (`Generated/_Polygon2D.g.cs:28`, dated 2026-08-02). If both hold at run time, a
law over any type with an array field, which includes every `BrepModel` law, is reported as ignored.
Running `regen-forward-conformance.ps1 -Test` and reading the skip list would settle it.

**Rung 6 is not routine** [R]. `docs/gate-log.md` holds one conformance row, 2026-07-31: 44 passed,
0 failed, 3 skipped. The packet now declares 148 `Law_` functions [M]. `stdlib/VERIFICATION.md` says
the generated C# for tiers above `foundation` does not compile, and that the working route is a
subset build of one library's declaration closure (`tools/regen-triangulation.ps1`). That route's
recorded timings on 2026-08-03 were 14 to 24 s to resolve the subset, 11 to 16 s to generate C#,
and 14 to 26 s to build and test [M, `%LOCALAPPDATA%\ara3d\gate-timings.csv`]: about a minute per
iteration.

**Name binding exists outside the compiler; typing does not** [R]. `src/Plato.Navigation` binds names
with the compiler's own binder and rebuilds in under a second when warm, but it does not resolve
overloads or compute types (its README, "Known limitations"). `plato_check` runs rungs 0 to 4 warm.
So a separate spec language can learn from Navigation whether a name exists, but must hand its
expressions to the compiler to learn whether they are well typed.

**The grammar** (`parakeet/Parakeet.Grammars/PlatoGrammar.cs`, 241 lines) [R]. It is a PEG grammar
written as C# properties. `StartRule` is overridable; the expression rules (`LeafExpression`,
`InnerExpression`) are plain properties. A subclass can reuse `Expression`, `TypeExpr`, and
`FunctionParameterList` as they are, but adding an expression form such as `forall` needs a change
inside `parakeet`.

**The cost of a language feature** [R]. Sum types: the design and the core implementation were filed
and closed on one day (`tracker/issues/plato-232.md`, 2026-07-27); comparing two sum values needed a
second fix six days later (`tracker/issues/stdlib-402.md`); TypeScript and Rust emission are still
missing. The five backend writers are 1,181 (GLSL) to 7,516 (C#) lines [M], and the elaborator is 382.

**Hazards for any gate over this sandbox** [R]:

1. The spec files are named `*.spec.plato`. `Plato.CLI lint` and `plato_check` read every `.plato`
   file in a folder, and the Plato grammar has no `spec` declaration, so the Phase 3
   parse-and-resolve gate in PLAN.md will fail on them unless they are excluded or renamed.
2. `stdlib/geometry/brep.types.plato` declares `BrepCurve`, `BrepEdge`, `BrepLoop`, `BrepSurface`,
   `BrepFace`, and `BrepValidation`, which the sandbox redeclares (VOCABULARY.md). One global
   namespace makes a plain merge fail. The staged stdlib needs those declarations removed while
   keeping `BrepEdgeUse` and `EdgeOrientation`, which the sandbox reuses.

**Defects a checker would already report** in the example text of SPEC-DSL.md [R]. They are small,
and they show what stage 1 buys:

- Section 3.2 writes `m.EdgeDomain(e).Start`, but VOCABULARY.md gives `EdgeDomain(m, e): CurveDomain`
  and `CurveDomain { Range; Periodicity }`; unless a layer declares `Start(CurveDomain)`, the clause
  does not type-check.
- Section 3.2 calls `Law_PointsLieOnCurve(m, result, m.Tolerances)`; the catalogue in
  `research/VALIDATION-MATH.md` section 8 gives that law the parameters `(m, d, i)`, pointwise in `i`.
- Section 3.2 compares `Number`s with `==` (`result.Parameters[0] == ...`), against the rule in
  section 2. VALIDATION-MATH.md wants exactly that comparison (`Law_DiscretizationEndsAtVertices`,
  "exact (bitwise)"), so the rule needs a written escape rather than a silent exception.
- Section 3.4 writes `in 0.UpTo(n)`; the stdlib's range is `n.Range`
  (`stdlib/foundation/primitives.library.plato:359`), and no `UpTo` exists.
- Section 3.3 cites `MeshModel` and `Law_MeshIsClosed`, which VOCABULARY.md does not export.

## 3. Three architectures

### 3.1 A: new syntax inside Plato

`spec`, `theorem`, `requires`, `ensures`, `invariant`, `forall`, and `exists` become Plato syntax. The
parser (in `parakeet`), the AST, the binder (`self`, `result`, bound variables), the constraint
generator and elaborator (Boolean typing), every pass that walks expressions (the normalizer, the
monomorphizer, four optimizer passes, five writers) and Navigation must accept or strip the new
forms, and SEMANTICS.md must say what they mean.

- *Validate*: the best possible. Spec expressions are checked by the same passes as code, with exact
  locations.
- *Prove*: nothing by itself. A compiler that owns `requires` still cannot discharge it without a
  prover; adding one is the scale of Whiley or Dafny [W3, W4], languages designed around one.
- *Tests*: the compiler could emit checks into generated C#, but Plato has no exceptions, so an
  emitted check is either a C# `Debug.Assert` (whose Debug and Release divergence is an open Plato
  issue, `tracker/issues/plato-292.md`) or a change to the function's return type. A quantifier over
  a continuous domain has no run-time meaning except sampling, which is a test concept, not a
  language one.
- *Language change*: survives best, because one compiler owns everything.
- *Cost*: the core in days, by the sum-types precedent; the tail in weeks; work in two repositories
  (`parakeet` and Plato), in a compiler that other sessions edit concurrently.
- *Agents*: one kind of file and errors in place; but Plato's documents (SEMANTICS.md,
  `plato-for-agents.md`, the stdlib guides) must teach the constructs.
- *Risks*: freezing an unproven DSL into the language; language surface that only test tooling gives
  meaning to; every backend inherits forms it must ignore.

### 3.2 B: a separate specification language

Spec files get their own small parser and refer to Plato declarations through `Plato.Navigation`.

- *Validate*: names, through Navigation. Types only if the tool reimplements overload resolution and
  type inference, or hands the expressions to the compiler, at which point it has become option C.
- *Prove*: a separate language can target a prover directly (Creusot's Pearlite targets Why3 [W8];
  ACSL in Frama-C targets Why3 and SMT solvers [W6]); the cost is a translation of Plato's meaning,
  which exists only in the compiler.
- *Tests*: generated host-language tests (C#) from the spec file; the spec language needs its own
  evaluator or a translation to C#.
- *Language change*: a second expression grammar drifts from Plato's unless it reuses Plato's rules;
  a renamed Plato declaration shows up as an unresolved name, which is loud and therefore good.
- *Cost*: a parser and binder for the block structure is days; a type checker is weeks, and a second
  copy of Plato's semantics.
- *Agents*: two languages to learn, with different error messages.
- *Risks*: two grammars; two type systems that disagree on overloads and implicit conversions. ACSL
  [W6] and JML [W7] show that the approach works only with a large, sustained tool investment.

### 3.3 C: convention plus tooling over unchanged Plato

Statements are Plato functions with fixed prefixes (`Law_`, `Witness_`, `Oracle_`, `Check_`, and new
ones: `Inv_`, `Pre_`, `Post_`). Spec blocks either disappear (authors write the prefixed functions by
hand) or are kept as source text that a tool lowers to prefixed functions.

- *Validate*: names and types by the real front end, because the lowered output is ordinary Plato;
  the status of each statement (invariant, precondition) from the manifest or the prefix; authoring
  rules by lints over the parsed files and the compilation.
- *Prove*: nothing directly; the lowered functions are the input to any later translation.
- *Tests*: the law runner already executes `Law_` functions, so a theorem lowered to
  `Law_Theorem_<Name>` runs with no new machinery; `Pre_` and `Post_` need a harness.
- *Language change*: the lowering emits only function declarations, `? :`, calls, and `Boolean`, the
  most stable part of Plato.
- *Cost*: hand-written prefixed functions cost nothing to build; a lowering tool takes days.
- *Agents*: they write Plato, which they already know; errors point at generated code unless the tool
  maps them back to spec lines.
- *Risks*: with hand-written prefixes, a misspelled prefix silently drops a contract, and a
  contract's status lives in a name. With a lowering tool, generated code can be edited by mistake;
  mark it, and regenerate in the gate.

### 3.4 Comparison

| Criterion | A: in Plato | B: separate language | C: convention + tool |
|---|---|---|---|
| Names resolve | yes | yes (Navigation) | yes (compiler) |
| Types agree | yes | only by reimplementing the checker | yes (compiler) |
| Authoring rules (no literal epsilon, `? :` guards) | as compiler lints | its own linter | lints over Plato files |
| Constructor lists enforced | a compiler rule | needs whole-program TIR | a lint over TIR |
| Executable tests | needs a lowering anyway | needs an evaluator or a C# translation | lowered functions run in the existing runner |
| Proofs | needs a prover in or beside the compiler | a translation to a prover | a translation from the lowered functions or the TIR |
| Survives Plato change | best | worst (second grammar) | good (minimal output syntax) |
| Cost to first use | weeks | days for names, weeks for types | hours (hand prefixes) to days (tool) |
| Reversible | hard | easy | easy |

### 3.5 What prior systems chose

| System | Where specifications live | How obligations are discharged | Floating point | Lesson for this choice |
|---|---|---|---|---|
| Eiffel [W2] | in the language from the start | run-time checks; AutoTest uses contracts as oracles for random tests [W2b] | run-time only | contracts plus random inputs found real faults with no hand-written oracle |
| SPARK and Ada [W1] | `--#` comment annotations through SPARK 2005; Ada 2012 aspects (`Pre`, `Post`) from SPARK 2014 | GNATprove, through Why3 and SMT solvers | IEEE semantics; proofs of bounds rather than equalities | comments first, language later, once the forms had settled |
| Dafny [W3] | in the language | Boogie and Z3, with user lemmas; test generation from the verifier [W3b] | mathematical `real`; I found no IEEE floating-point type in its documentation | strong for index and sequence reasoning; geometry must be axiomatized over `real` |
| Whiley [W4] | in the language | a verifying compiler | limited | designing for verification shapes the whole language |
| Frama-C ACSL, E-ACSL [W6] | `/*@ ... */` comments in C | the WP plug-in to provers; E-ACSL turns annotations into run-time checks | distinguishes mathematical reals from floats | a comment language with a large tool behind it; the executable subset is separate |
| JML [W7] | `//@` comments in Java | run-time checks, extended static checking, OpenJML | limited | lived for decades without being promoted into Java |
| Code Contracts for .NET [W5] | library calls plus a post-compile rewriter | the rewriter for run-time checks; abstract interpretation | none | the rewriter fell behind the compiler; unsupported on .NET 5 and later |
| Kani, Prusti, Creusot for Rust [W8, W9] | attributes (`#[requires]`, `#[ensures]`); Pearlite as an embedded spec language | bounded model checking (Kani), Viper (Prusti), Why3 (Creusot); Kani can replace a verified function by its contract (`stub_verified`) | Kani, built on a bit-precise model checker, can model IEEE arithmetic, which keeps it to small kernels [J] | attributes over an unchanged language are practical; the host compiler's evolution is the main maintenance cost |
| Liquid Haskell, F* [W10] | refinement types | SMT inside the type checker | Liquid Haskell reasons about floating types as reals, as I understand it, which ignores rounding | needs an SMT solver in the type checker, out of reach for Plato's unification checker |

The pattern [J]: systems that started as annotations over an unchanged language (SPARK 2005, ACSL,
JML, the Rust verifiers) lasted while a team maintained the tool; the one that rewrote compiled
output (Code Contracts) died when the compiler moved on. Option C's generated output is source, not
rewritten binaries, which avoids that failure.

### 3.6 Recommendation and the lowering

The recommendation is the hybrid of section 0: the spec text stays as written, a tool lowers it, the
compiler checks the result. The lowering rules:

| Spec construct | Generated Plato (in `<stem>.spec.g.plato`, library `<LibraryBlock>Spec`) |
|---|---|
| k-th `invariant E` in `spec T` | `Inv_T_k(self: T): Boolean => E;` |
| k-th `requires E` in `spec F(params): R` | `Pre_F_k(params): Boolean => E;` |
| k-th `ensures E` | `Post_F_k(params, result: R): Boolean => E;` |
| `ensures forall (x: X) in D : E` | `Post_F_k_At(params, result: R, x: X): Boolean => E;` and `Post_F_k_Domain(params, result: R)` returning `D` |
| `measure M` | `Measure_F(params, result: R): Number => M;` |
| `theorem N` with givens `g` | `Law_Theorem_N(g): Boolean => A1 ? (A2 ? (... ? C : true) : true) : true;` |
| `conjecture N` | `Law_Conjecture_N(g)`, the same shape, reported separately |
| `exists (x: X) by W : E` | `E` with `x` replaced by the witness term `W`; without `by`, documentation only |

The output for the contract and the theorem in SPEC-DSL.md, once the defects of section 2 are
corrected, would read:

```plato
// GENERATED from 04-discretization/discretization.spec by spec-lower. Do not edit.
library EdgeDiscretizingSpec
{
    // spec Discretize, requires 1 (discretization.spec:12)
    Pre_Discretize_1(m: BrepModel, e: BrepEdgeIndex, c: DiscretizationCriteria): Boolean
        => m.IsEdgeInRange(e);

    // spec Discretize, ensures 4 (discretization.spec:17): a prenex forall over a finite range
    Post_Discretize_4_At(m: BrepModel, e: BrepEdgeIndex, c: DiscretizationCriteria,
                         result: EdgeDiscretization, i: Integer): Boolean
        => Law_PointsLieOnCurve(m, result, i);
    Post_Discretize_4_Domain(m: BrepModel, e: BrepEdgeIndex, c: DiscretizationCriteria,
                             result: EdgeDiscretization): Array<Integer>
        => result.Points.Count.Range;
}

// GENERATED from 08-pipeline/pipeline.spec by spec-lower. Do not edit.
library StepToMeshSpec
{
    // theorem WatertightByConstruction (pipeline.spec:3)
    Law_Theorem_WatertightByConstruction(m: BrepModel, o: MeshingOptions): Boolean
        => Law_IndicesInRange(m)
            ? (Law_EveryEdgeUsedTwiceWithOppositeOrientation(m)
                ? (Law_LoopsChainEndToStart(m) ? Law_MeshIsClosed(MeshModel(m, o).Mesh) : true)
                : true)
            : true;
}
```

Beside it, one manifest entry per generated function:

```json
{ "function": "Post_Discretize_4_At", "kind": "ensures", "subject": "Discretize", "clause": 4,
  "source": "04-discretization/discretization.spec:17", "bound": ["i: Integer"],
  "domain": "Post_Discretize_4_Domain", "cites": ["Law_PointsLieOnCurve"] }
```

Three details matter [J]:

- **Quantifiers in prenex position only, at first.** A universal quantifier at the head of a clause
  lowers to a pointwise function, which is SPEC-DSL's own convention for laws. A quantifier nested
  inside an expression, or an `exists` without a witness term, has no executable reading, and would
  also need an expression-level grammar change in `parakeet` (section 2). Narrowing the DSL to
  clause-level `forall` and `exists ... by` loses none of the examples written so far.
- **The parser can be small.** Since the compiler checks the expressions, the tool needs only their
  extents: a subclass of `PlatoGrammar` that overrides `StartRule` with block rules and reuses
  `Expression`, `TypeExpr`, and `FunctionParameterList`, then copies expression text into the
  generated file and records line offsets for mapping findings back.
- **The spec repeats each function's signature.** That duplicates the declaration, but it also
  disambiguates overloads (VOCABULARY.md has two `Domain` and two `Eval` functions). Keep it, and
  have the checker require that it matches exactly one declaration.

### 3.7 The staged path in detail

**Stage 0, hours.** Stage a copy of the stdlib without the colliding B-rep declarations, add the
sandbox's real `.plato` files (not the spec files), and run `Plato.CLI lint` naming every layer
folder (`lint` does not recurse, VERIFICATION.md rung 0). For the spec files, a script extracts
identifiers and asks Navigation (`plato_search_symbols`) for each; unknown names are findings. This
already catches the `UpTo`, `MeshModel`, and `Law_MeshIsClosed` cases of section 2.

**Stage 1, two to four days.** The lowering tool and `spec check`:

- lower spec files to `*.spec.g.plato` plus the manifest; compile the staged corpus; map diagnostics
  back to spec lines;
- structural findings: a bodiless function in a `.library.plato` file with no `spec` block or no
  `deferred`; a `spec F(...)` header that matches no declaration, or several; a `tested by` or
  `constructor` naming nothing; a theorem with no `tested by`; a `Check_` whose comment names no law;
- authoring lints from SPEC-DSL.md section 5, over the real files: a numeric literal in a comparison
  inside a `Law_`; `==` or `!=` on operands of type `Number`, a point, or a vector (with an explicit
  escape such as a `SameBits(a, b)` helper, as the owner decides); `&&` or `||` with an operand that
  indexes or divides; a law body whose top level, after the guard chain, is a conjunction ("one
  statement per law"); a `Witness_` whose first parameter is not `_: T` with return type `T`;
- a traceability report, and law tables generated into each layer README between markers (section
  7.4).

Expose the same check as a command and later as an MCP tool beside `plato_check`, so an authoring
agent runs it in its edit loop.

**Stage 2, one to two weeks, after the validators compile.** Execution, in the order that is useful
before any algorithm exists: laws on witnesses, oracles against closed forms, negative witnesses,
calibration pairs, then the contract harness. Section 5 gives the details.

**Stage 3, weeks, during implementation.** Shrinking, minimal STEP files, metamorphic families,
mutation, coverage. Sections 5 and 7.

**Stage 4, optional.** Bounded consistency checks and Dafny proofs. Section 4.

**Promotion to Plato (option A)** becomes worth discussing when three facts hold: the constructs
used across all nine layers are known, none changed shape during one implementation cycle, and some
benefit needs the compiler (for example, enforcing `constructor` lists at every call site without a
separate lint). Until then the lowered form is the cheaper home.

## 4. Proof: what is realistically provable

### 4.1 Three kinds of statement

"Prove" means something different for each of the three kinds of statement in the sandbox [J]:

- **Model laws** (VALIDATION-MATH.md section 8, kind "model") are predicates on user data: a STEP
  file either satisfies `Law_EulerPoincare` or it does not. There is nothing to prove about a model
  law itself. What can be proved is that the laws are consistent (some model satisfies all of them),
  that one implies another, and that a validator computes the predicate it names.
- **Library laws** (kind "library, test") are properties of the library's functions: determinism,
  or that reversing an edge leaves the mesh unchanged. They can be proved only about a body, and only
  once the body is translated into a prover's language.
- **Theorems** relate the two: model laws on the input, through the contracts of deferred functions,
  imply laws on the output. These are where a proof pays, because a counterexample would be a silent
  defect in every mesh.

### 4.2 The 71 catalogued laws by provability

[M] from the table in VALIDATION-MATH.md section 8. The layers are not yet written, so this is the
catalogue the authors start from.

| Class | Count | Examples | What a proof can do |
|---|---|---|---|
| Combinatorial: integers, indices, tags | 21 | `Law_IndicesInRange`, `Law_LoopsChainEndToStart`, `Law_EdgeUsedTwiceInClosedShell`, `Law_EdgeUsesRunOpposite`, `Law_ShellOrientable`, `Law_EulerPoincare`, the mesh edge and Euler laws, `Law_MeshEulerMatchesBrep` | decidable at any fixed size; consistency and implication can be checked by SMT or SAT at small sizes; statements over every size need induction |
| Exact statements about computed floats: signs, bitwise copies, determinism, exact symmetries | 17 | `Law_FaceWindingMatchesSameSense`, `Law_DiscretizationEndsAtVertices`, `Law_PowerOfTwoScalingCommutes`, `Law_MeshingIsDeterministic`, `Law_BezierSagittaBoundedByControlHull` | they hold of a particular floating-point computation; a few have real-number versions provable in a proof assistant (the Bezier hull bound); the rest are tested |
| Tolerance laws | 33 | `Law_PointsLieOnCurve`, `Law_SagittaWithinChordal`, `Law_ElementDeviationWithinChordal`, `Law_AngleDefectSumIdentity`, `Law_SolidVolumeWithinTube` | empirical over floats; their exact-arithmetic versions split into identities (provable) and modelling bounds (provable for analytic cases only) |

The tolerance class splits in a way that changes how each law should be tested (section 5.9):

- **Rounding-only laws** state an identity that is exact over the reals: the angles of a flat
  triangle sum to pi, the angle defects of a closed mesh sum to 2 pi chi, the vector area of a closed
  mesh vanishes. Their tolerance absorbs rounding, so it should come from an error bound for the
  computation, not from the model's tolerance.
- **Modelling-tolerance laws** compare against `epsL` or a meshing criterion: points on curves,
  chordal deviation, normal deviation, area envelopes.

### 4.3 Decidable after translation

These need no induction and fit an SMT solver's decidable fragments [J, with W11 for the
fragments]:

- **Euler-Poincare arithmetic.** `chi = V - E + 2F - L` equals `V - E + F - R` given `R = L - F`:
  trivial LIA. Its parity and bound for one model are a computation, not a proof.
- **Orientation parity.** `Law_EdgeUsesRunOpposite` states that two effective directions in
  {-1, +1} sum to zero; implications between such laws are LIA.
- **Vertex layout injectivity.** `VertexLayout` numbers model vertices first, then edge interiors by
  edge, then face interiors by face (VOCABULARY.md, `06-mesh`). That two different (edge, k) pairs
  never receive the same index, given that `EdgeInteriorStart` is a prefix sum of interior counts, is
  linear arithmetic over arrays with one universally quantified index, inside the array property
  fragment that Bradley, Manna, and Sipma showed decidable [W11].
- **The discrete Gauss-Bonnet identity, symbolically.** With pi as an uninterpreted positive
  constant, "each triangle's angles sum to pi" as a hypothesis, and `3T = 2E`, the identity
  `sum of defects = 2 pi (V - E + T)` is LRA once the sums are named.
- **Bounded consistency of the combinatorial laws.** Encode a model with at most, say, 16 vertices,
  24 edges, and 12 faces as bounded integer arrays, conjoin the 21 combinatorial laws, and ask for a
  model. A satisfying model is a witness; an unsatisfiable core names laws that contradict each
  other. Asking for `B and C and not A` checks whether law `A` follows from `B` and `C` at that size.
  PLAN.md's done condition 5 ("no law in one layer that contradicts a law in another") becomes a
  mechanical check for this class. The small-scope hypothesis behind Alloy [W12] is the argument
  that small bounds find most specification errors.

### 4.4 Needs induction or a proof assistant

- **`WatertightByConstruction` over an arbitrary model.** The conclusion quantifies over every mesh
  edge of a model of any size, so it needs induction over faces and edges, or a counting argument
  over finite sets. It is combinatorial: closedness is defined on vertex indices, so positions and
  floating point never enter. That makes it provable in Dafny or Lean with the geometry left
  abstract.
- **Euler-Poincare parity as a theorem** (every valid closed shell has an even reduced `chi` of at
  most 2) is the genus theorem for combinatorial surfaces. Dufourd proved it for hypermaps in Coq,
  together with Euler's formula, and the development is a published package [W13]. A B-rep's coedge
  structure is a combinatorial map, so that library is the nearest reusable formalization.
- **Counting under refinement** (VALIDATION-MATH.md 4.4: an edge cut into `k` segments contributes
  `k` mesh edges and `k - 1` interior vertices, net -1, as the edge alone does) is a sum over all
  edges, which SMT solvers handle poorly and an inductive lemma handles easily.
- **Real-analysis lemmas**: the quad defect lemma of VALIDATION-MATH.md 4.5, the Bezier hull bound,
  the sphere bracketing inequalities. Lean with mathlib has real trigonometry and inner-product
  geometry. MetiTarski proves universally quantified inequalities over sin, cos, exp, and sqrt by
  replacing those functions with rational bounds [W14]; the circle sagitta bound
  `R (1 - cos(theta / 2)) <= d` for every segment angle `theta` at most `2 acos(1 - d / R)` is a
  one-line problem for it.

Flyspeck, the formal proof of the Kepler conjecture, is the precedent for the split this sandbox
needs: combinatorial and analytic facts proved in a proof assistant, numeric inequalities discharged
by verified interval arithmetic [W15].

### 4.5 Inherently empirical

Every tolerance law over floating-point evaluation of curves and surfaces stays empirical [J]:

- The SMT theory of floating point covers `+ - * / sqrt` and rounding modes by encoding them as bit
  operations, at a cost that grows quickly with expression size, and has no `sin` or `cos`. cvc5
  supports transcendental functions over the reals by incremental linearization, which is incomplete
  [W16]; dReal decides formulas with transcendental functions up to a chosen numerical slack [W17].
  None of them reasons about the platform's floating-point `sin`.
- Lean's `Float` is opaque to the logic: the kernel cannot reason about it without extra axioms
  [W18]. Proofs are about real numbers, and the gap to the implementation is covered by tests.

The honest tool for this class is the combination the sandbox already plans: witnesses with
closed-form oracles and sampling of continuous parameters, plus interval enclosures where a guarantee
is wanted (section 5.9).

### 4.6 Translating a theorem

A Dafny statement of `WatertightByConstruction`, as a translation of the spec block would emit it.
The proof body is the hard part, written by a person or an agent:

```dafny
datatype Use = Use(edge: int, forward: bool)
datatype Model = Model(vertexCount: int, edgeCount: int, loops: seq<seq<Use>>,
                       faces: seq<seq<int>>, interiorPoints: seq<int>)
predicate IndicesInRange(m: Model) { ... }               // translated from the Plato law
predicate EdgeUsedTwiceOpposite(m: Model) { ... }
predicate LoopsChainEndToStart(m: Model) { ... }
function Layout(m: Model): seq<int> { ... }              // VertexLayout: concrete prefix sums
// The deferred function: no body; its spec contract becomes an axiom.
function TriangulateRegion(boundary: seq<int>, interior: seq<int>): seq<Tri>
  ensures BoundarySegmentsUsedOnceInLoopDirection(boundary, TriangulateRegion(boundary, interior))
  ensures InteriorEdgesSharedTwiceOpposite(boundary, TriangulateRegion(boundary, interior))
predicate MeshIsClosed(t: seq<Tri>) { forall e :: e in EdgesOf(t) ==> IncidentOpposite(t, e) }
lemma WatertightByConstruction(m: Model, o: Options)
  requires IndicesInRange(m) && EdgeUsedTwiceOpposite(m) && LoopsChainEndToStart(m)
  ensures MeshIsClosed(MeshModel(m, o))
```

What has to be axiomatized, in Dafny or in Lean:

1. **`Number` as a real number.** The proof then holds for exact arithmetic. For this theorem it
   makes no difference, because no position appears in it.
2. **Every deferred function, by its contract.** The spec block's `ensures` clauses become axioms.
   The proof is only as good as those clauses, which is where the attempt pays (section 4.7).
3. **Intrinsics** (the stdlib's bodiless functions), by whatever the proof uses of them.
4. **Plato bodies, translated or restated.** Plato is pure and has no exceptions, so translating its
   functions into Dafny functions is straightforward in principle. The source should be the TIR,
   where overloads are resolved and conversions are explicit, not the source text. Judged by the
   existing writers (1,181 to 2,639 lines for GLSL, Rust, and TypeScript [M]), a Dafny writer for the
   subset that index-level code uses (product types, sums as datatypes, `Array` as `seq`, `Map` and
   `Reduce`, `? :`, `match`) is one to three thousand lines.

In Lean the same statement is a theorem over structures with `Finset` cardinalities, where mathlib's
finite sums and double counting help. Lean is the better choice for the analytic lemmas of 4.4, and
Dafny for the index-level theorems, whose proofs are mostly sequence and quantifier bookkeeping that
Z3 automates. Language models now write Dafny proofs with measurable success (DafnyBench, Loughridge
and others, 2024), which makes an agent-written proof plausible, not assured.

### 4.7 What a proof attempt is worth here

The value of attempting `WatertightByConstruction` lies less in the proof than in the missing
assumptions it forces into the spec [J]. Reading the statement against VALIDATION-MATH.md suggests
two:

- **Degenerate sides.** At a sphere's pole or a cone's apex, several parameter-space boundary points
  map to one model vertex (VALIDATION-MATH.md 1.3 and 5.3). If `VertexLayout` gives each its own
  index, the mesh has coincident vertices; if they share one, triangles along that side degenerate.
  The theorem's `assume` list says nothing about degenerate edges or vertex loops, so either an
  assumption is missing (`Law_EdgeHasPositiveExtent`, or a stated rule for poles) or the conclusion
  needs a case.
- **The strength of `TriangulateRegion`'s contract.** The proof needs "each boundary segment is used
  by exactly one triangle, in the loop's direction" and "each interior edge by exactly two, in
  opposite directions". If the face-meshing author writes a weaker `ensures`, for example only that
  the triangles cover the region, the theorem does not follow, and tests on a box would not show it.

These are readings of the design, not verified defects; the layer files do not exist yet.

## 5. Tests: what to generate

### 5.1 From each law, a property test

The runner already turns a `Law_` into a property test (section 2). For this sandbox it needs five
changes [J]:

1. **Witness-driven inputs.** Run a law whose first parameter is `BrepModel` on every `Witness_`
   that returns `BrepModel`, and on each witness under each transform of section 5.7. Pseudorandom
   models are useless: VALIDATION-MATH.md 7.1 measured that random 12-vertex polygons are simple
   0.03% of the time.
2. **Dependent generation.** A typed index parameter that follows a model parameter ranges over that
   model's table: enumerate every index for small witnesses, plus -1 and the count, to exercise the
   guard. A continuous parameter samples its domain: both ends, the period seam, B-spline knots
   (where derivatives jump), midpoints, then random points.
3. **Tolerance parameters are never random.** `Tolerances` comes from the witness; criteria such as
   the chordal deviation `d` are drawn log-uniformly from a range relative to the witness's size.
   The current runner would hand a law a negative tolerance, since it draws from [-10, 10].
4. **Vacuity.** The tool splits each law's leading guard chain (the `? :` whose else branches are
   `true`, a shape SPEC-DSL fixes) into a generated `Guard_Law_X`. The runner reports, per law, how
   many inputs passed the guard, and fails a law whose rate is zero, as VALIDATION-MATH.md 7.1
   requires.
5. **Counterexamples as data**: the law, the witness's name and parameters, the transform, the
   values of bound variables, the measure against the tolerance, the provenance, and a command that
   reruns exactly that case.

### 5.2 From each contract, a harness around the function

For each `spec F`, a generated test calls `F` on every witness input that satisfies all `Pre_F_k`,
then evaluates every `Inv_` of the result type, then every `Post_F_k` (and every `Post_F_k_At` over
its domain), in that order, so later clauses may index what earlier ones bound. A `Pre_` that fails
on a witness is a witness defect, reported separately. The first failing clause is reported by its
spec line, not by its generated name.

Two uses before all bodies exist:

- **Contracts as stubs.** A layer can be tested against a stand-in for a lower layer that satisfies
  the lower layer's contract trivially (for `Discretize`, dense uniform sampling). Kani's
  `stub_verified` does this for verified functions [W8].
- **Blame at layer boundaries.** In integration tests, check each callee's `ensures` at the call. A
  face-meshing failure caused by a discretization that broke its contract is then reported against
  `Discretize`, which keeps an agent from debugging the wrong layer. This is the blame assignment of
  higher-order contracts (Findler and Felleisen, ICFP 2002).

### 5.3 From invariant lists, a validator per type and a constructor obligation

- `Validate_T(self): Array<Check>`, generated from the `Inv_T_k`, used by the harness and available
  to the pipeline's validation levels.
- **The constructor obligation**, in two parts: every function in the `constructor` list has an
  `ensures` covering each invariant (a manifest check), and no other function builds a `T` (a lint
  over the TIR, where constructor calls and tuple-to-struct coercions are explicit).
- Optionally, a generic product type `Checked<T> { Value: T; Checks: Array<Check> }` and generated
  wrappers `Checked_F(params): Checked<R>` that evaluate pre- and postconditions as data. Plato
  forbids generic sums, not generic products (SEMANTICS.md sections 2 and 8), so this works today and
  keeps decision D8, diagnostics rather than exceptions.

### 5.4 From theorems, lowered laws and a cross-reference

`Law_Theorem_N` runs as a law over witnesses. The checker fails a theorem with no `tested by`, a
`tested by` that names a missing law, and a theorem whose lowered law is vacuous on every witness
(no witness satisfies its assumptions). A `conjecture` that fails is a finding, not a test failure.

### 5.5 From witnesses, a corpus with known answers

Each `Witness_` is stored with the facts VALIDATION-MATH.md 7.2 tabulates (V, E, F, L, R, S, G, chi,
area, volume) as data. Generated tests then check, before any mesher exists, that every positive
witness satisfies every model law, that every negative witness fails exactly the laws it was built
to break and no others (a discrimination matrix of witnesses by laws), and that every oracle agrees
with its closed form. Lesson 10 of research/EXISTING-MESHER-LESSONS.md, a guard that never fired, is
the argument for the negative half.

### 5.6 Shrinking

Shrinking a B-rep by deleting parts breaks closedness, so the precondition fails and the smaller
model is rejected. Two approaches work [J]:

- **Shrink the generator, not the model.** For parameterized witnesses
  (`Witness_ExtrudedStar(seed, n, height)`, `Witness_Torus(R, r)`) and transform stacks, shrink the
  parameters: fewer star points, rounder radii, height 1, rotation to the identity, scale exponent
  to 0. Every candidate is valid by construction. This is Hypothesis's integrated shrinking [W19];
  in C#, CsCheck and FsCheck provide generators with shrinking [W20], which argues for replacing the
  hand-written `ValueGen` rather than extending it.
- **Shrink by locality.** Most laws are per face, per edge, or per pair of faces. The smallest
  reproducer of a per-face failure is that face alone, as an open shell with its loops, edges, and
  surfaces. Section 7.2 extends this to STEP files.

A shrunk case must fail **the same law with the same diagnostic code**, or reduction drifts to an
unrelated failure, a known trap in test-case reduction (C-Reduce, Regehr and others, PLDI 2012).

### 5.7 Metamorphic tests

VALIDATION-MATH.md 6.4 lists twelve relations and marks nine of them as laws (cube rotations, `2^k`
scaling, edge reversal, face reversal, shell reversal, the negative test of a lone `SameSense` flip,
the trimmed-curve sense flip, renumbering, determinism). Each becomes one law over a witness and a transform, with the
transform as a sum type
(`CubeRotation(Index: Integer) | PowerOfTwoScale(K: Integer) | EdgeReversal(Edge: BrepEdgeIndex) | ...`)
so the runner can enumerate the 24 rotations and sample the rest. One family should be added: **far
from the origin**, a translation by up to 10^5 model units, which is where the existing mesher's
single-precision defect hid (EXISTING-MESHER-LESSONS.md, lesson 1). Metamorphic testing is the
standard answer to missing oracles in numerical software [W21].

### 5.8 Coverage reports

Per layer: deferred functions without a contract; invariants with no constructor; laws cited by no
spec, theorem, or check; laws that never ran (no input type could be built); the vacuity rate per
law; laws no mutant falsifies (section 7.5); oracles whose call graph reaches the layer they check
(SPEC-DSL: "An oracle never calls the code it is checking"), found from Navigation's references or
from the TIR call graph.

### 5.9 Floating-point tolerances in generated tests

The aim is a generated test that neither passes vacuously nor fails on rounding. Five measures [J]:

1. **Margin by tolerance scaling.** For a tolerance law, the runner reruns the law with its
   tolerance parameter scaled and finds by bisection the smallest scale `s` at which it holds. `s`
   is the measure divided by the tolerance, obtained without any new convention in the law. Report
   its distribution per law. A law whose `s` stays below 10^-3 on every witness may not be testing
   its tolerance; a law whose verdict is not monotone in the scale is itself a finding.
2. **Three-valued verdicts.** Evaluate at `tol - slack` and at `tol + slack`, where `slack` is a
   rounding bound: machine epsilon, times the magnitude of the coordinates involved, times a small
   factor calibrated once per law (or derived with an error analyser such as FPTaylor [W22]). Equal
   results give Holds or Fails; different results give **Indeterminate**, and the runner reports the
   indeterminate rate. With a 32-bit `Number` and coordinates of 10^5 mm, the slack is near 0.1 mm,
   larger than a typical model tolerance, so most geometric verdicts would be indeterminate: the
   precision problem shows up as a number instead of as flaky failures.
3. **Calibration pairs per law.** Perturb a correct result by twice the tolerance (move one
   discretization point off its curve along the normal): the law must fail. Perturb it by a quarter
   of the tolerance: the law must hold. These test the law, not the implementation, and run on
   oracle-built data before any algorithm exists.
4. **Rounding-only laws get rounding tolerances.** The identities of section 4.2 take their bound
   from an error analysis of the computation, never from the model's `epsL`; comparing an angle sum
   to `epsL` passes vacuously or fails depending on the length unit.
5. **Interval enclosures where a guarantee is wanted.** Sampling cannot bound a deviation between
   samples. Interval evaluation of a surface over a parameter box, refined by bisection, gives a
   sound upper bound on the deviation of an analytic surface (IEEE 1788 [W23]). Plato's interfaces
   are type classes, so a measure function written generically over a real-number interface could be
   instantiated at an interval type. Two obstacles are known: `? :` needs a two-valued `Boolean`,
   which an interval comparison does not give, and the open defect `plato-374` (interface-generic
   law bodies mix an interface's default with a type's override). This is stage 4 research.

## 6. Use cases, ranked by value to this project

Ranked by value now, while parallel agents write the design and before implementation starts [J].

| Rank | Use case | Artifact | Used by | Needs |
|---|---|---|---|---|
| 1 | Validate the design as it is written: names, types, signatures, authoring rules | `spec check` findings with spec-file lines; the stage 0 recipe | the nine layer authors, the Phase 3 reviewers, then CI | stages 0 and 1 |
| 2 | Run the validators before any algorithm exists: witnesses satisfy the model laws, negative witnesses fail exactly their laws, oracles match closed forms, calibration pairs behave | a discrimination matrix and an oracle table per layer | the design reviewers; the owner deciding whether the design is sound | stage 2; law and validator bodies compiling to C# with a 64-bit `Number` |
| 3 | A contract harness for the implementing agent | a harness per function; counterexample JSON naming the spec line, witness, parameters, measure, and a rerun command | the agent implementing a deferred function, at about one minute per loop (section 2) | stage 2 |
| 4 | Traceability and generated law tables | law tables in each layer README; a coverage report | readers, reviewers, the author of TASKS.md | stage 1 |
| 5 | Theorems as executable laws on witnesses | `Law_Theorem_` results with vacuity rates | CI; the owner | stage 1 lowering, stage 2 runner |
| 6 | Shrunk counterexamples and minimal STEP files | shrunk witness parameters; `.stp` files in a regression corpus, named by law | implementing agents; regression CI | stage 3 |
| 7 | A mutation score per law | a matrix of laws by mutants of library bodies | the owner, judging how strong the laws are | stage 3 and bodies |
| 8 | Bounded consistency of the combinatorial laws | satisfying models, unsatisfiable cores, a list of redundant laws | design reviewers (PLAN.md done condition 5) | stage 4 |
| 9 | Proofs of the index-level theorems | generated `.dfy` statements with written proofs | the owner | stage 4 |
| 10 | Differential testing against Open CASCADE | a per-face comparison report | CI before a release | stage 3 and an external dependency |

## 7. How executable specs could improve the project further

Each item says what it needs.

### 7.1 Witnesses generated from invariants

- **Topology from predicates.** Korat generates every non-isomorphic structure up to a size bound
  that satisfies a Boolean predicate, pruning the search by watching which fields the predicate reads
  [W24]. The 21 combinatorial laws, conjoined, are such a predicate over flat integer tables. An SMT
  encoding (section 4.3) does the same by model finding and reaches cases authors do not think of: a
  seam edge used twice in one loop, a vertex loop, a face with two inner bounds that touch.
  QuickChick derives generators from inductive relations, with proofs that they are sound [W25]; the
  flat-table design makes the simpler Korat or SMT route enough. Needs: the combinatorial laws in a
  form the generator can evaluate (generated C#) or translate (SMT).
- **Geometry stays constructive.** Giving a solver-built topology planar geometry is not always
  possible (Steinitz's theorem says which genus-zero graphs are convex polyhedra; higher genus has no
  such guarantee), and laws over transcendental surfaces are outside what solvers decide. So
  solver-built models serve the topology-only laws, and the parameterized witnesses of
  VALIDATION-MATH.md 7.3 serve the geometric ones.

### 7.2 Minimal failing STEP files

Needs: the provenance map from kernel indices back to STEP instance numbers (`ProvenanceMap`,
`03-step`) and a reducer that works on Part 21 instances.

1. Cut by locality: keep the failing face, edge, or pair of faces and everything it references (the
   reference closure of its STEP instances), and wrap it in a minimal shell and product context.
2. Delta debugging over the remaining instances (Zeller and Hildebrandt, TSE 2002): remove a set,
   restore the reference closure, and keep the removal if the file still parses and fails the same
   law with the same diagnostic code.
3. Simplify the numbers: round coordinates and parameters while the failure persists.
4. Commit the result to a corpus folder named after the law, as a regression witness.

The ABC dataset (about a million STEP files, VALIDATION-MATH.md 7.4) is the input that makes this
worth building.

### 7.3 The implementing agent's inner loop

Edit a Plato body; run `plato_check` for rungs 0 to 4 in seconds; run `spec test F` to build the
subset and the harness, about a minute by the triangulation timings; read the counterexample JSON;
rerun the one failing case by its command. Running only the laws that cite `F` (known from the
manifest) and building only the subset keep the loop fast; blame (section 5.2) and shrinking
(section 5.6) keep it accurate. Needs: stage 2, and the subset script generalized from
`regen-triangulation.ps1`.

### 7.4 Documentation driven by the specification

Generate each layer README's table of laws from the files: the name, the first sentence of its
comment, the parameters, the tolerance parameter, the kind and severity, the specs citing it, the
tests covering it, and the last run's status, vacuity rate, and mutation score. SPEC-DSL.md section 5
says a README never carries a rule that is not in a `.plato` file; generating the table makes that
checkable. Needs: Navigation's declaration spans, and the source text above them for comments.

### 7.5 Mutation testing of laws

Mutate library bodies in the AST or TIR (swap `<` and `<=`, add or remove `- 1` in index arithmetic,
swap the branches of a `? :`, drop a term from a sum, reverse an orientation flag) and record which
laws fail. A law that fails for no mutant is redundant or vacuous; a function with surviving mutants
is under-specified. Mutating Plato rather than the generated C# keeps the mutants meaningful, though
Stryker.NET [W26] on the C# could serve as a first approximation. Needs: bodies and the stage 2
runner.

### 7.6 Differential testing against a reference kernel

VALIDATION-MATH.md 7.4 describes the comparison with Open CASCADE. The specs contribute the laws
that make it a test (`Law_HausdorffToReferenceWithinSum`) and the report format; lesson 9 of the
existing mesher is the warning that agreement is evidence of parity, not of correctness. Needs: an
Open CASCADE build on the test machine, and faces matched by STEP instance number.

### 7.7 Totality of the decoder

Plato has no exceptions, but generated C# throws on an index out of range. For every function in
`03-step` and `08-pipeline`, generate the property "returns without throwing" over the corpus, a
grammar-based fuzzer of Part 21 text, and the shrunk failures. Decision D8 (diagnostics, never
exceptions) then has a test. Needs: stage 2.

### 7.8 Measures as growth tests

A `measure` clause names the quantity that cost is proportional to. Running a parameterized witness
over a range of criteria and fitting the slope of `log measure` against `log d` checks the
prediction of VALIDATION-MATH.md 6.1 (vertex count grows as `d^(-1/2)` per curved direction), as an
Info-level check. Needs: stage 2 and the witness family.

## 8. Open questions for the owner

Each with the fact that would settle it.

1. **`Number` width.** The design needs 64 bits; `src/Plato.Intrinsics/Number.cs` wraps a 32-bit
   `float`, while `stdlib/foundation/primitives.plato` says 64-bit. Settled by choosing between
   widening `Number` and adding a `Double` primitive, before any geometric law is executed.
2. **Where the tool lives**: Plato's repository (as `src/Plato.Spec`), this sandbox, or a repository
   of its own. Settled by whether the stdlib will write `spec` blocks too; if it will, Plato's
   repository, beside Navigation and the law runner.
3. **Prenex quantifiers and `exists ... by`.** Narrow SPEC-DSL.md section 3.4 to clause-level
   quantifiers and witnessed existentials? Settled by counting, after Phase 2, whether any layer
   author wrote a nested quantifier or an `exists` without a witness term.
4. **The spec file extension.** Rename `*.spec.plato` so Plato tools do not read the files as Plato?
   Settled by the Phase 3 gate: if it lints whole folders, as PLAN.md says, renaming is the cheaper
   fix.
5. **Exact equality on `Number`.** `Law_DiscretizationEndsAtVertices` needs bitwise equality, which
   SPEC-DSL.md section 2 forbids. An explicit helper (`SameBits`), a marker, or a listed exception?
   Settled by how many laws need it once the layers are written.
6. **The `deferred` string and the `// deferred:` comment** say the same thing twice. Keep both and
   check that they agree, or keep one? Settled by whether anything other than a person reads the
   comment.
7. **The law runner.** Extend `Plato.ForwardConformanceTests` (witnesses, dependent generation,
   vacuity, shrinking) for every Plato user, or give the sandbox its own harness? Settled by running
   `regen-forward-conformance.ps1 -Test` now and seeing whether laws over array-holding types run or
   are ignored (section 2).
8. **A property-testing library.** Replace `ValueGen` with CsCheck or FsCheck for generation and
   shrinking? Settled by a half-day spike that ports one law and one parameterized witness to each.
9. **How much proof.** Is any theorem worth a Dafny proof at a few days each? Settled by whether the
   first implementation cycle produces a defect that a missing theorem assumption explains (the
   candidates in section 4.7).
10. **Promotion into Plato.** Which constructs, if any, become Plato syntax, and when? Settled after
    one implementation cycle, by which constructs all nine layers used and whether any changed shape.
11. **Open CASCADE as a test dependency.** Acceptable on the test machine, given its LGPL licence and
    its build cost? Settled by the owner.

## Sources

- [W1] AdaCore, SPARK user's guide (contracts as Ada 2012 aspects; SPARK 2005 and earlier used `--#`
  annotations): https://docs.adacore.com/spark2014-docs/html/ug/
- [W2] Eiffel, Design by Contract: https://www.eiffel.org/doc/solutions/Design_by_Contract_and_Assertions
- [W2b] Wei and others, "Stateful testing: finding more errors in code and contracts" (AutoTest,
  with contracts as oracles): https://arxiv.org/abs/1108.1068
- [W3] Dafny: https://dafny.org/
- [W3b] Dafny test generation (Dafny workshop at POPL 2024):
  https://popl24.sigplan.org/details/dafny-2024-papers/7/Dafny-Test-Generation
- [W4] Whiley: https://whiley.org/
- [W5] Microsoft, Code Contracts (.NET Framework only):
  https://learn.microsoft.com/en-us/dotnet/framework/debug-trace-profile/code-contracts
- [W6] Frama-C, ACSL and the E-ACSL manual: https://frama-c.com/html/acsl.html and
  https://www.frama-c.com/download/e-acsl/e-acsl-manual.pdf
- [W7] OpenJML (tools for JML): https://www.openjml.org/
- [W8] Kani function contracts and `stub_verified`:
  https://rust-training.ferrous-systems.com/latest/book/kani; Creusot and Pearlite:
  https://github.com/creusot-rs/creusot/blob/master/ARCHITECTURE.md
- [W9] Prusti: https://github.com/viperproject/prusti-dev
- [W10] Liquid Haskell: https://ucsd-progsys.github.io/liquidhaskell/; F*: https://fstar-lang.org/
- [W11] Bradley, Manna, Sipma, "What's decidable about arrays?", VMCAI 2006; Z3:
  https://github.com/Z3Prover/z3
- [W12] Alloy and the small-scope hypothesis: https://alloytools.org/
- [W13] Dufourd, hypermaps, the genus theorem, and Euler's formula in Coq:
  https://rocq-prover.org/p/coq-euler-formula and https://arxiv.org/abs/0802.2853
- [W14] MetiTarski: https://www.cl.cam.ac.uk/~lp15/papers/Arith/
- [W15] Hales and others, "A formal proof of the Kepler conjecture" (Flyspeck):
  https://arxiv.org/abs/1501.02155
- [W16] Cimatti and others, "Satisfiability modulo transcendental functions via incremental
  linearization" (the method cvc5 implements): https://arxiv.org/abs/1801.08723
- [W17] dReal, delta-complete decision procedures: https://dreal.github.io/
- [W18] Lean language reference, floating-point numbers:
  https://lean-lang.org/doc/reference/4.30.0/Basic-Types/Floating-Point-Numbers/
- [W19] Hypothesis: https://hypothesis.readthedocs.io/; Löscher and Sagonas, "Targeted
  property-based testing", ISSTA 2017
- [W20] CsCheck: https://github.com/AnthonyLloyd/CsCheck; FsCheck: https://fscheck.github.io/FsCheck/
- [W21] Chen and others, "Metamorphic testing: a review of challenges and opportunities", ACM
  Computing Surveys 51(1), 2018
- [W22] Solovyev and others, FPTaylor, round-off bounds by symbolic Taylor expansions:
  https://users.cs.utah.edu/docs/techreports/2015/pdf/UUCS-15-001.pdf
- [W23] IEEE 1788-2015, the standard for interval arithmetic
- [W24] Boyapati, Khurshid, Marinov, "Korat: automated testing based on Java predicates", ISSTA 2002:
  https://web.cs.ucla.edu/~harryxu/research/papers/korat.pdf
- [W25] Lampropoulos, Paraskevopoulou, Pierce, "Generating good generators for inductive relations",
  POPL 2018:
  https://popl18.sigplan.org/details/POPL-2018-papers/11/Generating-Good-Generators-for-Inductive-Relations
- [W26] Stryker.NET: https://stryker-mutator.io/
