# The specification DSL

How this design states rules. Plato has types, interfaces (type classes), pure functions, and, by
stdlib convention, `Law_*` Boolean functions. It has no refinement types, no pre- or postconditions,
no quantifiers, and no way to state a theorem. This document adds exactly those, as little as
possible, and every added construct reduces to Plato functions so that a checker can be mechanical
once someone writes one. Until then the invented constructs are read, not run.

Read [PLATO-PRIMER.md](PLATO-PRIMER.md) first for the language itself.

## 1. Two kinds of file

| Kind | Files | Status |
|---|---|---|
| Real Plato | `*.concepts.plato`, `*.types.plato`, `*.library.plato`, `*.laws.plato` | Must parse and resolve against the stdlib. Written so that the Plato front end could be run over them with the stdlib tiers as context. |
| Invented | `*.spec.plato` | The constructs of section 3 only. Nothing else may appear in a spec file, and no spec construct may appear in a real Plato file. |

The split is deliberate: the real files carry the truth content (every invariant and contract is also
a `Law_` function), and the spec files carry the *status* of each statement: that it is an invariant
every value of a type satisfies, that it is a precondition a caller owes, that it is a theorem with a
justification. Deleting every spec file loses no law, only the knowledge of which laws are promises.

## 2. Conventions inside real Plato

These are naming and shape conventions. The compiler does not know them; the law runner and the
reviewers do.

### Laws

```plato
// Holds for every model and every loop index that is in range.
Law_LoopIsClosed(m: BrepModel, l: BrepLoopIndex): Boolean
    => m.IsLoopInRange(l) ? m.LoopChainsEndToStart(l) : true;
```

- A `Law_<Name>` function returns `Boolean` and is a statement about **all** values of its parameter
  types. The law runner supplies pseudorandom instances; the conformance harness supplies witnesses.
- Preconditions appear as a leading guard that makes the law vacuously true: `pre ? claim : true`.
  Never `pre && claim`: `&&` does not short-circuit in Plato, so an index guard written that way
  still indexes out of range.
- A law is **total**: it never indexes out of range, divides by zero, or evaluates a surface outside
  its domain. Guards do that work.
- A law over a continuous parameter is **pointwise**: it takes the sample as a parameter
  (`t: Number`, `uv: UvCoordinate`) and clamps or wraps it into the domain inside the body. The
  runner samples; the law does not loop.
- Every approximate comparison names a tolerance drawn from a `Tolerances` value or a criteria
  record that is a parameter of the law. **No literal epsilon appears in a law.** Exact `==` is
  used only on `Integer`, `Boolean`, typed indices, and sum tags, with one exception: a `Number`
  that a function **copies** rather than computes (the first parameter of a discretization is the
  domain's start, copied) may be compared with `==`, and the line carries the comment
  `// exact by construction` so a reader and a checker know the equality is bitwise on purpose.
- One statement per law. A law that says two things is two laws, so a failure names the one that
  failed.
- A law references only names declared in this sandbox or in the stdlib at the pinned commit.

### Witnesses, oracles, checks

```plato
// A unit cube as a B-rep model: 8 vertices, 12 edges, 6 planar faces, one closed shell.
Witness_UnitBox(_: BrepModel): BrepModel
    => ...;

// The area of a planar face by the shoelace formula over its outer loop, independent of any mesh.
Oracle_PlanarFaceArea(m: BrepModel, f: BrepFaceIndex): Number
    => ...;

// Law_VertexOnSurface evaluated over every vertex of one face mesh; Worst is the largest distance.
Check_VerticesOnSurface(m: BrepModel, fm: FaceMesh, tol: Tolerances): Check
    => ...;
```

- `Witness_<Name>(_: T, ...): T` builds a well-formed example value of `T`. Witnesses exist because
  pseudorandom instances of constrained types are garbage (see the preamble of the stdlib's
  `tests/triangulation.laws.plato`); a law that needs a well-formed input is run over witnesses.
  The first parameter is the ignored type-token receiver, the stdlib's constant idiom.
- `Oracle_<Name>` computes a quantity by an independent route: a closed-form area, a count-based
  Euler characteristic, a volume by the divergence theorem. Oracles are the second source of truth
  that validation compares the mesh against. An oracle never calls the code it is checking.
- `Check_<Name>` is a law made into evidence: it evaluates one named `Law_` over one value,
  sampling deterministically where the law is pointwise, and returns a `Check` record
  (`00-foundation`) holding the law's name, whether it held, the worst measure seen, and where.
  Every `Check_` names in its comment the `Law_` it evaluates, and the two agree by construction:
  a `Check_` with `Holds` false exhibits a sample on which the `Law_` is false.

### Deferred bodies

```plato
// deferred: constrained Delaunay triangulation of a simple polygon with holes, boundary fixed.
TriangulateRegion(r: UvRegion, interior: Array<UvCoordinate>): UvTriangulation;
```

A bodiless function is, to the Plato compiler, an intrinsic obligation whose body the host supplies.
In this sandbox it means *the algorithm is still to be written*, and its contract lives in the
matching `spec` block. The `// deferred:` comment names the algorithm family in a few words so a
reader can judge the implementation cost. A function whose body **is** its specification (a
predicate, a projection, a count) is written out in full.

### Partial operations

The stdlib's `CONVENTIONS.md` admits three styles and this design uses them in this order of
preference: a result record with a validity field (`ParseOutcome { Ok: Boolean; ... }`), a
concrete sum whose classification is the payload (`Periodicity = Aperiodic | Periodic(...)`), a
fallback parameter (`NormalOr(s, uv, fallback)`). There is no `Option<T>`; generic sums are
rejected by the compiler.

## 3. The invented constructs

All of them live in `*.spec.plato` files, inside a `spec` or `theorem` block. Grammar in EBNF, then
meaning. `Expr` is any Plato Boolean expression over the names in scope, plus the two words
introduced here: `self` inside a type spec, `result` inside a function spec.

### 3.1 Type invariants

```
spec <TypeName>
{
    invariant <Expr> ;            -- repeatable
    constructor <FunctionName> ;  -- repeatable, optional
}
```

```plato
spec EdgeDiscretization
{
    invariant self.Parameters.Count == self.Points.Count;
    invariant self.Parameters.Count >= 2;
    invariant Law_ParametersStrictlyIncreasing(self);
    constructor Discretize;
    constructor Reversed;
}
```

Meaning: every value of `<TypeName>` that exists at run time satisfies every `invariant`. The
constructor list names the only functions permitted to return the type; each of them carries an
`ensures` for each invariant (section 3.2), and the compiler-derived tuple constructor is treated as
unavailable outside those functions. When the list is empty the type is plain data and the
invariants are properties a validator checks rather than promises.

Reduction: each `invariant` is also stated as a `Law_` function over the type in the layer's
`.laws.plato`, and the spec cites it (`invariant Law_X(self)`), or states a short expression whose
`Law_` form would be a one-line wrapper.

### 3.2 Function contracts

```
spec <FunctionName> ( <params> ) : <ReturnType>
{
    requires <Expr> ;             -- repeatable
    ensures  <Expr> ;             -- repeatable; may mention result
    measure  <Expr> ;             -- optional: the quantity that bounds the work
    deferred "<algorithm family>" ;  -- optional: mirrors the // deferred: comment
}
```

```plato
spec Discretize(m: BrepModel, e: BrepEdgeIndex, c: DiscretizationCriteria): EdgeDiscretization
{
    requires m.IsEdgeInRange(e);
    requires c.IsWellFormed;
    ensures result.Edge == e;
    ensures result.Parameters[0] == m.EdgeDomain(e).Range.Start;   // exact by construction
    ensures result.Parameters[result.Parameters.Count - 1] == m.EdgeDomain(e).Range.End;   // exact by construction
    ensures Law_PointsLieOnCurve(m, result, m.Tolerances);
    ensures Law_SagittaWithinChordal(m, result, c);
    ensures Law_TurningAngleWithinAngular(m, result, c);
    measure result.Parameters.Count;
    deferred "adaptive subdivision by sagitta and turning angle, then length capping";
}
```

Meaning: `requires` is the caller's obligation; the function's behaviour is unspecified when it is
false (in practice it returns a value and the validator reports the misuse, since Plato has no
exceptions). `ensures` is the function's obligation whenever every `requires` held. `measure` is
the quantity the implementation's cost is proportional to, or that strictly decreases across a
recursion; it is a hint to the implementer and a hook for a complexity test, not a semantic claim.

Reduction: every `ensures` is a `Law_` applied to the inputs and the result, so a law runner can
check the contract on witnesses by calling the function and the law.

### 3.3 Theorems and conjectures

```
theorem <Name>          |  conjecture <Name>
{
    given   <name> : <Type> , ... ;   -- universally quantified variables
    assume  <Expr> ;                   -- repeatable: hypotheses, usually laws over the givens
    conclude <Expr> ;                  -- the claim
    because "<justification>" ;        -- a theorem has one; a conjecture has none yet
    tested by <Law_Name> , ... ;       -- optional: executable laws that cover instances of the claim
}
```

```plato
theorem WatertightByConstruction
{
    given m: BrepModel, o: MeshingOptions;
    assume Law_IndicesInRange(m);
    assume Law_EveryEdgeUsedTwiceWithOppositeOrientation(m);
    assume Law_LoopsChainEndToStart(m);
    conclude MeshModel(m, o).Mesh.IsClosed;
    because "Each coedge consumes the unique EdgeDiscretization of its edge, forwards or reversed,
             and the mesh vertex index of the k-th point of an edge is a function of (edge, k) alone
             (MeshVertexNumbering). The two faces adjacent to an edge therefore emit boundary segments over
             identical vertex index pairs, in opposite directions. Every interior segment is shared
             by the two triangles of one face by construction of a triangulation. Hence every mesh
             edge has exactly two incident elements with opposite traversal.";
    tested by Law_WitnessMeshesAreClosed;
}
```

Meaning: a theorem is a claim the designers believe follows from the stated laws and the definitions,
with a proof sketch good enough for an implementer to see what must not be broken. A conjecture is a
claim worth testing that nobody has justified. `tested by` names executable laws that check instances
(typically over witnesses); the theorem is stronger than its tests.

### 3.4 Quantifiers inside expressions

Two expression forms may appear inside any `<Expr>` of a spec block, and nowhere else:

```
forall ( <name> : <Type> ) [ in <Expr> ] : <Expr>
exists ( <name> : <Type> ) [ in <Expr> ] : <Expr>
```

`in` names a finite range or a continuous domain (`in m.EdgeDomain(e).Range`, `in n.Range` for the
integers 0 to n - 1, the stdlib's `Range` on `Integer`). The meaning is mathematical. The executable counterpart is a pointwise `Law_` taking the bound variable
as a parameter, plus a `Check_` that samples the domain; the spec block cites both.

## 4. From law to verdict

The chain every rule follows, with the types from `00-foundation`:

```
Law_X        a universally quantified Boolean function           (truth)
Check_X      Law_X evaluated over one value, sampled              (evidence: Check)
Diagnostic   a Check that failed, with severity and provenance    (a finding)
Report       the Checks and Diagnostics of one validation         (the record)
IsClean      no Diagnostic at severity Error                      (the verdict)
```

Severity is decided by which group the law belongs to (README, "The problem, from first
principles"): a topological or structural law failing is an `Error`; a geometric criterion exceeded
is a `Warning` when the exceedance is below ten times the criterion and an `Error` above; a quality
threshold is `Info`. A third rule, decided by layer 2 in the fix wave of 2026-10-17: a structural
defect that the design repairs exactly (a degenerate edge contracted, a redundant vertex loop
dropped, a pcurve on a surface that is not the face's) is a `Warning`, because the reduced model
is well formed and the counts after reduction are exact; `Law_EdgeHasPositiveExtent`,
`Law_NoRedundantVertexLoop` and `Law_PcurveSurfaceIsAFaceSurface` are graded so. Each `Check_`
states its severity rule in its comment.

## 5. Rules for authors

- Write the law before the function. If a function cannot be given an `ensures`, it is not yet
  understood.
- Name the tolerance. A reviewer rejects any comparison of two `Number`s or points that does not.
- Guard with `? :`. Never rely on `&&` to protect an index or a division.
- Prefer a `Law_` to a sentence. A README explains why a law exists; it never carries a rule that
  is not also in a `.plato` file.
- One declaration, one place. A type, law, or function is declared in exactly one layer, the lowest
  that can state it, and higher layers reference it by name.
- Reuse the stdlib name when the meaning is identical (`Point3D`, `Frame3D`, `NumberInterval`,
  `VertexIndex`, `TriangleFace`, `QuadFace`, `KnotVector`); declare a new name when the meaning
  differs in any way, and say in the comment what differs.
