# Plato primer for the STEP B-rep design

Written 2026-10-17 for the nine Phase 2 authors of this sandbox and for the Phase 3 gate. It
describes Plato as the Plato repository at `C:\Users\cdigg\git\plato`, commit `f6e02cf0`, actually
behaves, not only as its documents say. Every stdlib function this primer recommends was resolved
and type-checked by compiling a probe file against the stdlib (section E); where a document and the
compiler disagree, the compiler's answer is given and the document is named.

Paths in the form `stdlib/geometry/brep.types.plato:47` are relative to the Plato repository root.
"Probe Lnn" refers to an experiment in the scratch folder
`C:\Users\cdigg\AppData\Local\Temp\claude\C--Users-cdigg-git-bim-open-toolkit\5da41e98-0df3-498e-a994-ac6c1ed53928\scratchpad\primer-gate\`;
the scratch folder may be cleaned, so each result that matters is restated here.

Terms used throughout:

- **Front end**: the parser, the symbol resolver (binds every name to a declaration), the linter
  (`LINT0nn` findings), the type checker (`CHK1nn`/`CHK2nn`), the sum checker (`CHK30n`), and the
  style checker (`STY00n`). Nothing here runs code.
- **Tier**: one of the stdlib folders `foundation`, `geometry`, `graphics` (shipping) and `future`
  (aspirational, not used here). `stdlib/types-and-concepts.txt` indexes the three shipping tiers.
- **Receiver**: the first parameter of a function. `a.F(b)` is exactly `F(a, b)`.
- **Law**: a `Law_*` function returning `Boolean` that states a property for all values of its
  parameter types. **Witness**: a function that builds one well-formed example value.
- **Existential**: an interface used as a field or parameter *type* rather than as a constraint;
  it means "some value of some type implementing the interface".

## A. Declaration grammar

### A.1 Files

A Plato program is every `.plato` file of the folders handed to the compiler, compiled as one
program with one global namespace. There are no imports and no modules; declaration order never
matters; a `library` name does not scope the functions inside it (`docs/SEMANTICS.md` section 1).

| Rule | Authority | Enforced by |
|---|---|---|
| One kind of declaration per file: `<stem>.concepts.plato` holds interfaces, `<stem>.types.plato` holds types, `<stem>.library.plato` holds exactly one `library` block | `stdlib/README.md` "Structure", `stdlib/LIBRARIES.md` rule 1 | STY005 (Error) in `src/Plato.Navigation/StyleChecker.cs`; the CLI `lint` does not run it, the gate driver of section E does |
| `.laws.plato` holds one `library` block named `<Stem>Laws` (`triangulation.laws.plato` holds `library TriangulationLaws`; `surfaces-shapes.laws.plato` holds `library SurfacesShapesLaws`) | `stdlib/tests/*.laws.plato` | convention only; STY005 still forbids mixing kinds |
| The library block name is the stem in PascalCase, hyphens dropped (`brep.library.plato` holds `library Brep`) | `stdlib/LIBRARIES.md` rule 1 | convention only |
| Every declaration and every function gets a short `//` doc comment stating what it is and any non-obvious invariant | `stdlib/STYLE_GUIDE.md` "Comments and documentation" | review only |
| Section banners are `//==` lines; a file opens with `//==`, `// # Title`, and a "Sections, in order:" list | `stdlib/STYLE_GUIDE.md`; every stdlib file | review only |
| At most 10 fields in a product type (the generated `Tuple2`..`Tuple10` surface stops at 10) | `StyleChecker.cs` `MaxFields = 10` | STY002 (Error) |
| No identifier `New`; no token `implicit` | `StyleChecker.cs` | STY001, STY003 (Error) |

**The "at most twelve top-level declarations" limit is retired.** The comment at
`stdlib/geometry/curves.concepts.plato:90` ("a file holds at most twelve top-level declarations")
refers to rule STY006, which commit `40c85da6` ("chore(style): retire STY004 and STY006",
2026-08-01) removed. `src/Plato.Navigation/StyleChecker.cs` now says: "Deliberately absent: caps on
doc-comment length and on declarations per file." Nothing enforces a count; split a file when it
stops being about one subject.

The VOCABULARY.md field counts fit under STY002: `BrepModel` has 9 fields, `ModelMesh` 8, `FaceMesh` 7.

### A.2 `type`: products and sums

A product type declares fields and nothing else. From the field list the compiler derives a
constructor taking the fields in order, conversion from a same-shape tuple, and deconstruction.
`docs/SEMANTICS.md` also promises per-field setters (`c.WithRadius(2.0)`); **they are not derived**
(the layer 4 author probed it against the gate on 2026-10-17). To change one field, write the
constructor out with every field in declaration order. Real examples:

```plato
// A position in 3D Cartesian space.
type Point3D
    implements ICoordinate, IOriginBased<Vector3D>, IHashable, IMetricSpace, ITransformable3D
{
    X: Number;
    Y: Number;
    Z: Number;
}

// A planar angle, stored in radians (https://en.wikipedia.org/wiki/Angle).
type Angle implements IQuantity { Radians: Number; }
```

A sum type replaces the braced body with `=` and a case list. A case has named, typed payload
fields in parentheses, or no parentheses at all. A sum may implement interfaces, written before `=`:

```plato
// stdlib/geometry/brep.types.plato:18
type EdgeOrientation = Forward | Reversed;

// stdlib/graphics/scene3d.types.plato:64
type SceneLightBinding
    implements IValue
    = Directional(Index: ItemIndex)
    | Point(Index: ItemIndex)
    | Sphere(Index: ItemIndex)
    | Ambient(Index: ItemIndex);   // (cases abridged)
```

Sums are monomorphic: `type ProbeMaybe<T> = Just(Value: T) | Nothing;` is rejected with CHK306
(probe L05). Case names must be unique within one sum (CHK305); the same case name may appear in two
different sums (probe L09), and a case may share its name with a stdlib type (`Plane`, `Sphere`,
`Cylinder` as cases compile, and the stdlib `Plane` type is still constructible beside them: probe L08).

Generic product types take type parameters, optionally bounded with `where` before `implements`:

```plato
// stdlib/graphics/motion-graphics.types.plato:41
type Tween<T>
    where T: IInterpolatable
    implements ITimeVarying<T>
{
    From: T;
    To: T;
    Duration: Duration;
    Delay: Duration;
}

// stdlib/foundation/collections-jagged.types.plato
type JaggedArray<T>
    implements IValue, IJagged<T>
{
    Offsets: Array<Integer>;
    Values: Array<T>;
}
```

A field may be an array of the type being declared (`type TreeNode { Children: Array<TreeNode>; ... }`,
probe L02), a function value (`Mapping: Function1<Point3D, Point3D>;` in
`stdlib/geometry/deformations.types.plato:118`), or an interface (an existential, D.3). A type may
have zero fields (D.5). A type may not usefully contain itself directly (D.2).

Construct values with the type name, `Point3D(0.0, 0.0, 0.0)`, or with a tuple where the expected
type is known (A.5). Construct a sum value with the qualified case: `EdgeOrientation.Forward`,
`ProbeCurve.Segment(a, b)`. Bare `Segment(a, b)` also compiles when exactly one sum has that case
(the stdlib's `brep.library.plato` writes `Line(Line3D(...))`), but it becomes CHK203 "Ambiguous
call" as soon as two sums share the case name with the same payload types (probe L22). Always qualify.

### A.3 `interface`

An interface is a type class: a set of signatures over the implicit type variable `Self`. It is a
compile-time constraint, never a runtime type (except as an existential, D.3). `concept` is an
accepted alias for the keyword. Real examples:

```plato
// stdlib/foundation/collections.concepts.plato
interface IIndex
{
    Value(x: Self): Integer;
}

// stdlib/foundation/core.concepts.plato
interface IOrderable
    inherits IEquatable
{
    LessThanOrEquals(a: Self, b: Self): Boolean;
}

// stdlib/foundation/intervals-bounds.concepts.plato
interface IInterval<T>
    where T: IAdditive, T: IInterpolatable, T: IComparable
    inherits IValue
{
    Start(x: Self): T;
    End(x: Self): T;
}

// stdlib/foundation/functional.concepts.plato
interface IProcedural<TDomain, TRange>
{
    Eval(x: Self, input: TDomain): TRange;
}
```

A type satisfies an interface when a function with exactly the obligation's signature exists
somewhere (a library function, a field of the same name and type, or a generic body over another
interface). A field `Value: Integer` discharges `IIndex.Value`. A missing obligation is LINT001, a
*Warning* to the CLI whose generated C# member throws `NotImplementedException`; `docs/SEMANTICS.md`
section 2 says "Treat LINT001 as an error when authoring", and the gate driver does (probe L27:
`type ProbeRay implements IProcedural<Number, Point3D>` with no `Eval(ProbeRay, Number): Point3D`).

Consequence for the design: `IProcedural<Number, Point3D>` needs `Eval(c: Self, t: Number)`. An
arena-indexed evaluator `Eval(g: GeometrySet, c: CurveIndex, t: Number)` cannot discharge it,
because its receiver is the arena, not the curve.

### A.4 `library`: functions

```plato
library ProbeGate
{
    // deferred: inverse evaluation by Newton iteration from a coarse sample.
    ProbeProject(c: ProbeCurve, p: Point3D): Number;          // bodiless

    // A sample of the curve at t.
    ProbeSampleAt(c: ProbeCurve, t: Number): ProbeSample
        => (c.ProbeEval(t), t);                                // expression body
}
```

- **Expression body**: `Name(p: T, ...): R => expr;`.
- **Block body**: `{ var x = ...; ... return expr; }`. `var` locals are typed by their initializer
  (no annotation exists). Inside a block: `if (c) { ... } else { ... }`, `while (c) { ... }`, and
  assignment to a local already introduced by `var` (`i = i + 1;`). `do`, `for` and `foreach`
  desugar to the same loop node (`docs/SEMANTICS.md` section 3; the stdlib writes `while`, and this
  primer did not probe the others). There is no `++`, no `+=`, no `switch`, `break`, `continue`,
  `throw` or `try` (`docs/SEMANTICS.md` section 8). Example from
  `stdlib/geometry/brep.library.plato`:

  ```plato
  GridTriangleFace(k: Integer, cols: Integer): TriangleFace
  {
      var cell = k / 2;
      var col = cell % (cols - 1);
      var row = cell / (cols - 1);
      var a = row * cols + col;
      ...
      return k % 2 == 0
          ? (VertexIndex(a), VertexIndex(b), VertexIndex(c))
          : (VertexIndex(a), VertexIndex(c), VertexIndex(d));
  }
  ```

- **Bodiless function**: a signature ending in `;`. The language reads it as an intrinsic, a body
  the host runtime supplies. This sandbox reads it as "algorithm deferred" (SPEC-DSL.md). Every
  front-end gate accepts it silently; see D.7 for what codegen does with it.
- **Uniform function call syntax**: `F(a, b)` and `a.F(b)` are the same call; there is no other
  member lookup. A no-argument call needs no parentheses: `v.Length`, `m.Faces.Count`,
  `x.Degrees.Cos`. Literal receivers work: `3.Range`, `1.0.Turns`, `(0.25).Turns`.
- **Statics**: a first parameter named `_` marks a function that uses only its receiver's type; it is
  called on the type name. `Number.Pi`, `Vector3D.UnitZ`, `Bounds3D.Empty`. Constants and witnesses
  use this form (`Witness_UnitBox(_: BrepModel): BrepModel`, called `BrepModel.Witness_UnitBox`).
  `T.F(x)` passes the type token as the first argument, so it only works when `F`'s first parameter
  accepts a `T`: `Direction3D.FromVector(v)` is CHK201 because `FromVector`'s receiver is the
  vector; write `v.FromVector` (probe L23).
- **Overloads**: all functions of one name, in every library, form one overload group, resolved
  per call by exact match, then `$`-generic, then interface, then implicit conversion. A tie with
  different return types is CHK203. Two functions with identical parameter types in one library is
  LINT004 (Error).
- **Generic functions** spell type variables `$T` and may bound them after the return type:

  ```plato
  // stdlib/geometry/splines.library.plato:43
  DeCasteljau(xs: Array<$T>, t: Number): $T where $T: IInterpolatable
      => xs.Count <= 1
         ? xs[0]
         : (xs.Count - 1).MapRange(i => xs[i].Lerp(xs[i + 1], t)).DeCasteljau(t);
  ```

  A type variable that appears only in the return type is LINT005 (Error).
- **Interface parameters**: `Lerp(a: IInterpolatable, b: IInterpolatable, t: Number): IInterpolatable`
  means "any one implementing type"; all occurrences in one signature are the same type.
- **Recursion** is accepted and used by the stdlib (`DeCasteljau` above, `BasisFunction` in
  `splines.library.plato:189`); guard the base case with the conditional, which evaluates only the
  taken branch. It is not portable to the GLSL backend (`docs/plato-intrinsics-surface.md`, "What a
  body may not do is **recurse**"), which the stdlib's tree builders avoid with explicit work stacks.

### A.5 Expressions

| Form | Notes |
|---|---|
| Literals | `0` is `Integer`, `0.0` is `Number`, `1e-4` is `Number`, `true`/`false`, `"text"` is `String`. An `Integer` is never converted to `Number`: `Point3D(0, 0, 0)` and `n * 0.5` (n: Integer) are CHK201/CHK101 (probes L25, L11); write `n.ToNumber * 0.5`. |
| Operators | `+ - * / % == != < <= > >= && || ! -x` are calls to `Add`, `Subtract`, `Multiply`, `Divide`, `Modulo`, `Equals`, `NotEquals`, `LessThan`, ..., `And`, `Or`, `Not`, `Negative`. Defining the name defines the operator for your type. `&&` and `||` evaluate both sides (D.4). There is no `String` `+` (CHK201, probe L26). |
| Conditional | `c ? a : b`; both branches must unify to one type; only the taken branch is evaluated. |
| Tuples | `(a, b)` builds any type with the same field shape where the expected type is known: a return, an argument, or a field of a tuple being converted. `ProbeSampleAt` above returns `(c.ProbeEval(t), t)` as a `ProbeSample`; `i.Overlap((0.0, 1.0))` passes a `NumberInterval`. |
| Array literal | `[a, b, c]` of a unified element type. `[]` type-checks where the expected type is fixed (probe L14); the stdlib builds typed empties with `0.MapRange(...)` (`NoFaces` in `triangulation.library.plato`) or `xs.Take(0)` where context does not fix the type. |
| Lambdas | `x => expr`, `(a, b) => expr`; parameter types are inferred from the target; lambdas appear only as arguments; a named function passed as a value is eta-expanded. Up to 9 parameters (`Function0`..`Function9`). |
| Indexing | `xs[i]` is `At(xs, i)`. `xs[idx]` with a typed index works through `At(self: IIndexable<$T>, index: IIndex)` (`stdlib/foundation/collections.library.plato:259`). `i[t]` on a `NumberInterval` is `At(i, t)`, the lerp. |
| `match` | See below. |
| `default` | Avoid: probe L26 produced "Semantic Error: Could not resolve reference for default". |

`match` is an expression and the only way to consume a sum. It must list every case exactly once
(CHK300 missing, CHK301 unknown, CHK302 duplicate); there is no wildcard (an arm `_ => ...` is
read as an unknown case `_`: CHK301 plus CHK300, probe L17); binders are positional and their count
must equal the case's field count even when unused (CHK303). It lowers to a chain of conditionals,
so only the matched arm is evaluated, which makes it a safe guard. From
`stdlib/geometry/brep.library.plato`:

```plato
Eval(s: BrepSurface, uv: UvCoordinate): Point3D =>
    match (s) {
        Planar(patch) => patch.Eval(uv);
        Bilinear(patch) => patch.Eval(uv);
    };
```

A match subject may be any sum-typed expression (`match (d.Direction) { ... }`). Nested patterns
(`Some(Circle(r))`) are not supported; bind, then match again.

### A.6 Collections and builders

`Array<T>` is immutable and zero-indexed. Its host kernel is `Count`, `At`, `MapRange`, `Reduce`,
`FlatMap` (`stdlib/foundation/intrinsics.library.plato`); everything else is Plato in
`stdlib/foundation/primitives.library.plato` and `collections.library.plato`. Signatures verified by
probes L21 and L23:

| Function | Signature (receiver first) |
|---|---|
| `MapRange` | `MapRange(n: Integer, f: Function1<Integer, $T>): Array<$T>`, written `n.MapRange(i => ...)` |
| `Map` | `Map(xs: Array<$T1>, f: Function1<$T1, $T2>): Array<$T2>` |
| `Reduce` | `Reduce(xs: Array<$T>, acc: $U, f: Function2<$U, $T, $U>): $U` |
| `FlatMap` | `FlatMap(xs: Array<$T1>, f: Function1<$T1, Array<$T2>>): Array<$T2>` |
| `Zip` | `Zip(xs: Array<$T1>, ys: Array<$T2>, f: Function2<$T1, $T2, $T3>): Array<$T3>`; a three-array form exists |
| `All`, `Any` | `All(xs: Array<$T>, f: Function1<$T, Boolean>): Boolean`; folds, they do not stop early |
| `Slice` | `Slice(xs: Array<$T>, from: Integer, exclusiveTo: Integer)`, half-open by endpoint |
| `SubArray`, `Take`, `Skip`, `TakeLast`, `DropLast` | count-based sub-ranges |
| `Concatenate`, `Append`, `Prepend`, `Repeat(n, x)`, `AtModulo(xs, n)` | joining and wrapping |
| `Count`, `First`, `Last`, `IsEmpty`, `IsValidIndex(i)` | `First`/`Last` require non-empty |
| `Range` | `3.Range` is `[0, 1, 2]` |
| `Sort`, `SortedIndices` | `xs.Sort((a, b) => a <= b)`, stable merge sort (`sorting.library.plato`) |
| `SumOf` | `SumOf(values: Array<Number>): Number` (`collections.library.plato:425`) |
| `Fractions`, `LinearSpace` | `n.Fractions` is `n` values over [0, 1] inclusive; `FractionsExclusive` drops 1 (`collections.library.plato:392,399`) |

There is no `Filter`/`Where` and no element-wise array equality. Filter with
`xs.FlatMap(x => keep(x) ? [x] : xs.Take(0))` or a `List` builder (probe L23).

`Array2D<T>` is an ordinary type, row-major (`stdlib/foundation/primitives.types.plato:35`):

```plato
type Array2D<T>
    implements IIndexable2D<T>
{
    Elements: Array<T>;
    ColumnCount: Integer;
    RowCount: Integer;
}
```

Read with `g.At(column, row)`, `g.Row(r)`, `g.Column(c)`, `g.ColumnCount`, `g.RowCount`; build with
`MakeArray2D(columns, rows, (c, r) => ...)`. `JaggedArray<T>` (A.2) stores rows in CSR form
(Offsets has rowCount + 1 entries); read with `j.RowCount`, `j.Row(i)`, `j.RowLength(i)`,
`j.RowElement(row, k)`; build with `FromRows(rows: Array<Array<$T>>)`. `Array<Array<T>>` is also legal.

`List<T>` (growable) and `Buffer<T>` (fixed size) are the only mutable values, for use inside
block bodies. Rules from `stdlib/foundation/primitives.plato`:

- construct with `new List<T>()` or `new Buffer<T>(n)` at a concrete element type;
- rebind every mutator: `xs = xs.Add(p);`, `b = b.Set(i, v);` (`Count` and `At` only observe);
- finish with `xs.Freeze()` (parentheses required), after which the builder is dead;
- never store a builder in a field (LINT006) or a container (LINT007), never capture one in a lambda;
- never make a builder the first parameter of a function: the C# writer drops such functions
  (`triangulation.library.plato`, "PARAMETER ORDER", tracked as plato-416).

```plato
ProbeEvens(n: Integer): Array<Integer> {
    var xs = new List<Integer>();
    var i = 0;
    while (i < n)
    {
        if (i % 2 == 0)
        {
            xs = xs.Add(i);
        }
        i = i + 1;
    }
    return xs.Freeze();
}
```

The style guide ranks expression bodies and combinators first; reach for builders only for a real
accumulate-and-patch algorithm (`docs/SEMANTICS.md` section 3).

## B. The law convention

### B.1 What the stdlib does

`stdlib/tests/` holds `*.laws.plato` files, each one `library` of `Law_*` functions plus helpers.
It is not a tier: the stdlib gates never read it. The convention, quoted from
`stdlib/tests/foundation.laws.plato`:

> every function prefixed with Law_ returns Boolean and is a property that must hold for ALL values
> of its parameter types. The compiler monomorphizes each law onto every concrete type implementing
> the receiver interface; the C# reflection runner (Plato.ForwardConformanceTests) invokes each
> (type, law) pair with seeded pseudorandom instances. Helper functions (no Law_ prefix) are ignored
> by the runner.

Why a law needing a well-formed input is not run on random instances, from the preamble of
`stdlib/tests/triangulation.laws.plato`:

> The runner builds pseudorandom instances, and a pseudorandom Array<Point2D> is a self-intersecting
> ring; `Polygon2D` declares simplicity as an invariant that nothing in the tree can yet check
> (plato-415 item 5), so the runner cannot honour it. A law that fails on garbage is worse than no law.
>
> The tiling property is therefore enforced where the inputs can be chosen: the executable harness
> in tests/Plato.Triangulation.Tests [...]. What follows is the subset that holds for ANY input,
> well-formed or not.

How laws treat degenerate numbers, from the preamble of `stdlib/tests/surfaces-shapes.laws.plato`:

> A law is a statement about all instances, and the runner supplies pseudorandom ones — including
> instances that violate the preconditions the types state (a zero radius, an exponent of zero, a
> domain outside the branch where a logarithm is real). Those evaluate to a NaN or an infinity, and
> every law here is guarded to say nothing about them rather than to fail on them.

`stdlib/VERIFICATION.md` states the split as a general rule: "Laws that hold for *any* input live
there; the ones needing a well-formed polygon live in the harness."

The guards in practice:

```plato
// surfaces-shapes.laws.plato: a non-finite sample makes the law vacuously true.
SurfaceFinite(p: Point3D): Boolean
    => p.X.IsFinite && p.Y.IsFinite && p.Z.IsFinite;

SurfaceParameter(t: Number): Number
    => t.IsFinite ? t.Clamp(0.0, 1.0) : 0.0;          // pointwise law: clamp the sample

Law_CatenoidSeamsInU(s: Catenoid, v: Number): Boolean
    => SurfaceSeam(s.Eval((0.0, v.SurfaceParameter)), s.Eval((1.0, v.SurfaceParameter)));

// foundation.laws.plato: a degenerate interval is skipped by an || guard.
Law_ParameterOfInvertsAt(i: NumberInterval, x: Number): Boolean
    => i.Start.LawEq(i.End) || i[i.ParameterOf(x)].LawEq(x);
```

The `||` guards above are safe only because nothing on the right can fault: a NaN propagates
silently. An array index or an `Integer` division by zero throws in C#, so guard those with the
conditional (`pre ? claim : true`), as SPEC-DSL.md requires.

`Witness_*` is named in `stdlib/VERIFICATION.md` ("`Witness_*` functions are helpers that construct
example values for laws") but no file in `stdlib/tests/` declares one today; the stdlib tests
well-formed inputs in host-language harnesses instead. This sandbox's `Witness_X(_: T): T` form is
its own convention, consistent with the static-receiver idiom.

### B.2 What the runner can and cannot construct

From `tests/conformance/Plato.ForwardConformanceTests/ConformanceSupport.cs` and `LawTests.cs`:

- `N = 25` instances per (type, law), from a seed that is a stable hash of the type and law names.
- `Number`: 30 % drawn from {0, 1, -1, 0.5, -0.5, 2, -2, 0.25, 3, -3}, the rest uniform in
  [-10, 10]. Never NaN or infinity at input; those arise inside the body.
- `Integer`: uniform in [-8, 8]. A typed index (`{ Value: Integer }`) is therefore negative or out of
  range most of the time.
- `Boolean`: fair coin; `String`: 0 to 5 lowercase letters.
- A struct is built through its public constructor with the most parameters, recursively, to depth 6.
- **Not constructible, so any law taking such a parameter is skipped (`Assert.Ignore`), not failed**:
  anything holding an `Array<T>` (emitted as the C# interface `IReadOnlyList<T>`), any sum type (its
  C# constructor is private; values come from per-case factories, `_BrepCurve.g.cs:36`), any
  zero-field type (no constructor with parameters), any existential field, any type that contains
  itself.
- A thrown exception counts as a failure.

So the random-instance path only reaches laws whose parameters are scalars and small records of
scalars: `Point3D`, `Vector3D`, `Frame3D`, `NumberInterval`, `Angle`, `ComparisonTolerance`, typed
indices, and the sandbox's own tolerance and criteria records. Every law over `BrepModel`,
`ModelMesh`, a curve or surface sum, or a discretization is witness-only. One way to make a
witness-only law reachable by a random-`Integer` runner, offered as a suggestion, not stdlib
practice: take an `Integer` selector and pick a witness from it inside the body,
`Law_X(k: Integer): Boolean { var m = WitnessAt(k); ... }`, where `WitnessAt` reduces `k` into
range with a guarded modulo.

Status of the runner: `docs/gate-log.md` last records it on 2026-07-31 ("44 pass / 0 fail / 3
skip"). Its driver script, `C:\Users\cdigg\git\studio\tools\regen-forward-conformance.ps1`, still
passes `--scalar=float`, which `src/Plato.CLI/Program.cs` now rejects ("'--scalar=...' is no
longer supported"), so stage 2 cannot run as scripted today. Treat laws as checked by the front end
only until the implementation brings its own harness.

## C. The reusable vocabulary

Every name in VOCABULARY.md's "Stdlib names reused" table, with its declaration as written and the
functions an author is most likely to call. File and line refer to the definition. All calls listed
were type-checked in probes L21, L23 and L28 unless marked otherwise.

### C.1 Scalars

`Number`, `Integer`, `Boolean`, `String` are `primitive` declarations in
`stdlib/foundation/primitives.plato`:

```plato
// A 64-bit floating-point approximation of a real number.
primitive Number
    implements IReal
{ }

primitive Integer
    implements IWhole, IBitwise
{ }
```

The "64-bit" comment is wrong for the C# backend; see D.1. Useful `Number` functions:
`Abs`, `Sqrt`, `Square`, `Sign`, `Floor`, `Clamp(lo, hi)`, `Min`, `Max`, `Pow`, `IsFinite`,
`IsNaN`, `ToInteger` (rounds), `Number.Pi`, `Number.Tau`, `Number.Epsilon`, and the radians kernel
`Sin`/`Cos` on `Number`. `Integer`: `ToNumber`, `Range`, `MapRange`, `Abs`, `Min`, `Max`; `/`
truncates and `%` takes the sign of the dividend (C# `%`, `src/Plato.Intrinsics/Integer.cs:100`).
`String` supports literals and `==` only.

### C.2 Points, vectors, directions

```plato
type Point2D
    implements ICoordinate, IOriginBased<Vector2D>, IHashable, IMetricSpace, ITransformable2D
{
    X: Number;
    Y: Number;
}

type Point3D
    implements ICoordinate, IOriginBased<Vector3D>, IHashable, IMetricSpace, ITransformable3D
{
    X: Number;
    Y: Number;
    Z: Number;
}

type Vector2D
    implements IVector
{
    X: Number;
    Y: Number;
}

type Vector3D
    implements IVector
{
    X: Number;
    Y: Number;
    Z: Number;
}

// A 3D direction: a Vector3D with the invariant that its magnitude is one.
type Direction3D
    implements IValue
{
    Vector: Vector3D;
}
```

| Want | Write | Defined at |
|---|---|---|
| displacement from `a` to `b` | `b - a` (a `Vector3D`), or `a.Between(b)` | `algebra.library.plato:82` (`Subtract(a: IDifference<$D>, b: IDifference<$D>): $D`), `:122` |
| point moved by a vector | `p + v`, `p - v` | `algebra.library.plato:118`, `:77` |
| interpolate points | `a.Lerp(b, t)` (unclamped) | `algebra.library.plato:99` |
| distance | `a.Distance(b)`, `a.DistanceSquared(b)` | `numeric-structures.library.plato:426,430` |
| point as vector and back | `p.PositionVector`, `v.ToPoint` | `transforms.library.plato:928,936` |
| dot, cross | `u.Dot(v)`, `u.Cross(v)` (Vector3D); `u.Cross(v)` is the scalar perp-dot for Vector2D, `v.Perp` the left normal | `vectors.library.plato:182,188`; `numeric-structures.library.plato:821,815` |
| length | `v.Length`, `v.LengthSquared` (Vector3D, Vector2D); `v.Magnitude`, `v.MagnitudeSquared` (any IVector) | `vectors.library.plato:141,145`; `numeric-structures.library.plato:271,275` |
| unit vector | `v.Normalize`: no zero guard, a zero vector gives NaN components | `vectors.library.plato:150` |
| unit vector with fallback | `v.NormalizeOr(fallback)`: the fallback is taken only when `MagnitudeSquared` is exactly `0.0`, not when it is tiny | `numeric-structures.library.plato:772` |
| direction | `v.FromVector` (precondition non-zero), `v.TryFromVector(fallback)`, `v.FromVectorUnchecked`; read back with `d.Vector` | `numeric-structures.library.plato:849,853,859` |
| angle between | `u.AngleBetween(v)`, an `Angle` in [0, pi] | `numeric-structures.library.plato:744` |
| axis constants | `Vector3D.UnitX`, `.UnitY`, `.UnitZ`, `Vector3D.Zero` | `constants.library.plato:137-145` |
| near-equality of vectors | `a.AlmostEqual(b, tolerance: Number)` | `numeric-structures.library.plato:162` |

Almost nothing takes a `Direction3D` directly; arithmetic goes through `.Vector`, as the stdlib does
(`l.Origin + l.Direction.Vector * t`, `lines.library.plato:114`). `Direction3D(v)` wraps without
normalizing (same as `FromVectorUnchecked`).

```plato
// A normalized 2D surface parameter: texture lookup, patch evaluation.
// Convention: see CONVENTIONS.md - UV origin (origin top-left, U right, V down).
type UvCoordinate
    implements ICoordinate, IOriginBased<Vector2D>
{
    U: Number;
    V: Number;
}
```

`b - a` gives a `Vector2D`, `uv + v` a `UvCoordinate`, `a.Lerp(b, t)` works. There is no
`Distance` on `UvCoordinate` (it is not `IMetricSpace`): use `(b - a).Length`. Its doc comment says
"normalized"; the design stores natural parameters in it, which VOCABULARY.md should state.

### C.3 Frames and lines

```plato
// An orthonormal coordinate frame in space: an origin and three mutually
// perpendicular unit axes.
type Frame3D
    implements IValue, IRigid3D
{
    Origin: Point3D;
    XAxis: Direction3D;
    YAxis: Direction3D;
    ZAxis: Direction3D;
}

// An infinite straight line in space: all points Origin + Direction * t for any real t.
type InfiniteLine3D
    implements IGeometry3D, IConnected, INearestPoint3D
{
    Origin: Point3D;
    Direction: Direction3D;
}
```

A frame maps local coordinates (x, y, z) to `Origin + x * XAxis + y * YAxis + z * ZAxis`:

| Want | Write | Defined at |
|---|---|---|
| local point to world | `f.PointInFrame(local: Point3D)` | `geometry/solids.library.plato:87` |
| local coordinates to world | `f.FramePoint(x, y, z)` | `geometry/curves-shapes.library.plato:420` |
| right-handed frame with a given Z axis | `AxisFrame(center: Point3D, axis: Direction3D)` | `geometry/solids.library.plato:96` |
| local-to-world matrix | `f.Matrix4x4` (row-vector convention, CONVENTIONS.md "Matrices") | `transforms.library.plato:662` |
| rigid pose, affine map | `f.Pose3D`, `f.AffineTransform3D` | `transforms.library.plato:684,688` |
| world point to local | `f.Pose3D.Inverse * p` (no named function exists), or dot products of `p - f.Origin` with the three axis vectors | `transforms.library.plato:1018,998` |
| point on a line | `l.PointAt(t)` | `geometry/lines.library.plato:113` |

`Frame3D -> Matrix4x4`, `Frame3D -> Pose3D` and `Frame3D -> AffineTransform3D` are implicit
conversions (`tests/PlatoTests/implicit-cast-inventory.txt`). Orthonormality and right-handedness
are documented, never checked; a frame decoded from STEP needs its own law.

### C.4 Intervals, angles, bounds, tolerances

```plato
// A directed interval of unitless numbers.
type NumberInterval
    implements IInterval<Number>
{
    Start: Number;
    End: Number;
}

type AngleInterval
    implements IInterval<Angle>
{
    Start: Angle;
    End: Angle;
}

type Angle implements IQuantity { Radians: Number; }

type Bounds2D
    implements IBounds<Point2D, Vector2D>
{
    Min: Point2D;
    Max: Point2D;
}

type Bounds3D
    implements IBounds<Point3D, Vector3D>
{
    Min: Point3D;
    Max: Point3D;
}

type ComparisonTolerance
    implements IValue
{
    Absolute: Number;
    Relative: Number;
}
```

`NumberInterval` (bodies in `stdlib/foundation/intervals.library.plato`):

| Want | Write | Line |
|---|---|---|
| value at fraction t (unclamped) | `i.Lerp(t)`, `i.At(t)`, `i[t]` | 215, 315 |
| fraction of a value | `i.ParameterOf(x)`; precondition `Start != End` | 321 |
| remap between intervals | `x.Remap(from, to)` | 328 |
| membership, closed | `i.Contains(x)`: `Start <= x && x <= End` | 224 |
| clamp | `i.Clamp(x)` | 240 |
| signed length | `i.Extent` = `End - Start` | 201 |
| orientation | `i.IsForward`, `i.IsReversed` | 205, 209 |
| intersection as a NumberInterval | `a.Overlap(b)`; inverted when disjoint | 337 |
| samples | `n.Fractions.Map(t => i.Lerp(t))` (endpoints included) | `collections.library.plato:392` |

Empty encoding: `CONVENTIONS.md` "Bounds" says `Start > End` is empty and is the identity for
`Union`; `intervals-bounds.concepts.plato` says the same shape "encodes a reversed interval".
Both readings exist; `Contains` is false everywhere on an inverted interval, so it behaves as
empty. State which one a sandbox field means. `Union`, `Intersection`, `Reverse`, `Translate`,
`Grow` return `Self` and cannot be chained directly: `i.Reverse.Start` is CHK203 (12 ambiguous
overloads), while `ReverseOf(i: NumberInterval): NumberInterval => i.Reverse;` followed by
`i.ReverseOf.Start` type-checks (probe L23).

`Angle` (bodies in `stdlib/foundation/angles.library.plato`): build with `x.Degrees`, `x.Turns`,
`x.Gradians` (lines 27-47 for `Number`, 57-73 for `Integer`) or `Angle(x)` for radians (line 185);
read with `a.Radians`, `a.Degrees`, `a.Turns`. Trigonometry: `a.Sin`, `a.Cos`, `a.Tan`, `a.SinCos`;
inverses return `Angle`: `x.Acos`, `x.Asin`, `x.Atan`, `y.Atan2(x)` (lines 276-297). Arithmetic:
`a + b`, `a - b`, `a * x`, `a / x`; comparison `a <= b`, `a.Compare(b)`. Reduction:
`a.Normalize` into (-pi, pi], `a.Wrap(period)` into [0, period) (lines 135, 143). `Angle(x: Number)`
is an implicit conversion, so a bare `Number` passed where an `Angle` is expected is silently taken
as radians (probe L25; `Number -> Angle` in the cast inventory). `AngleInterval` has wrap-aware
`Span`, `Contains`, `Center` (`intervals.library.plato:356-375`).

`Bounds3D`: `Bounds3D.Empty` (line 120), `b.Union(p)`, `b.Union(other)`, `b.Contains(p)`,
`b.Contains(other)`, `b.Overlaps(other)`, `b.Expand(amount)`, `b.IsEmpty`, `b.Center`, `b.Extent`
(lines 120-157 and the `IBounds` generics at 47-62). `Bounds2D` has the same set.

`ComparisonTolerance`: `x.AlmostEqual(y, tol)` tests `|x - y| <= Absolute + Relative * max(|x|, |y|)`
(`algebra.library.plato:195`). The overload `AlmostEqual(x, y, tolerance: Number)` is a plain
absolute test (line 187).

### C.5 Knots

```plato
// A non-decreasing sequence of parameter values partitioning a B-spline or
// NURBS domain. For a curve with N control points of degree D the knot count must be N + D + 1.
type KnotVector
    implements IValue
{
    Knots: Array<Number>;
}
```

`k.Count`, `k.KnotAt(i)`, `k.Domain(degree)` = [knot `degree`, knot `Count - degree - 1`]
(`stdlib/geometry/splines.library.plato:127,131,137`). `BasisFunction(knots, domainEnd, i, degree, t)`
(line 189) is the Cox-de Boor recurrence in the knot parameter; it recomputes shared terms, so its
cost is exponential in the degree. `KnotRatio` and `ZeroDegreeBasis` are its helpers. Do not reuse
`Eval(BSplineCurve3D, t)`: it takes a unit parameter in [0, 1] and clamps it onto the knot domain,
where STEP uses the knot parameter itself.

### C.6 Mesh indices, elements, meshes

```plato
type VertexIndex
    implements IValue, IHashable, IComparable, IIndex
{
    Value: Integer;
}
// FaceIndex, UndirectedEdgeIndex, CornerIndex, HalfEdgeIndex: the same shape.

type TriangleFace
    implements IFace
{
    A: VertexIndex;
    B: VertexIndex;
    C: VertexIndex;
}

type QuadFace
    implements IFace
{
    A: VertexIndex;
    B: VertexIndex;
    C: VertexIndex;
    D: VertexIndex;
}

type TriangleMesh3D
    implements IValue, ITriangulatedGeometry3D, IIndexedTriangleGeometry3D, IMeshElementCounts, IDeformable3D
{
    Positions: Array<Point3D>;
    Faces: Array<TriangleFace>;
}

type QuadMesh3D
    implements IValue, IMesh3D, IIndexedQuadGeometry3D, IMeshElementCounts, IDeformable3D
{
    Positions: Array<Point3D>;
    Faces: Array<QuadFace>;
}

type PolygonMesh3D
    implements IValue, IMesh3D, IMeshElementCounts, IMeshIncidence, IDeformable3D
{
    Positions: Array<Point3D>;
    Faces: JaggedArray<VertexIndex>;
}

type HalfEdgeMesh
    implements IValue, IMeshElementCounts, IHalfEdge, IDeformable3D
{
    Positions: Array<Point3D>;
    HalfEdges: Array<HalfEdge>;
    FaceHalfEdges: Array<HalfEdgeIndex>;
    VertexHalfEdges: Array<HalfEdgeIndex>;
}
```

Every `IIndex` type gets, from `collections.library.plato:215-263`: `i.IsNone` (`Value < 0`),
`i.IsPresent`, `Hash`, `LessThanOrEquals`/`Compare`, `xs[i]`, `xs.IsValidIndex(i)`. A sandbox index
declared `type BrepEdgeIndex implements IValue, IHashable, IComparable, IIndex { Value: Integer; }`
owes nothing more (probe G02).

Faces (`IFace` inherits `IValue, IHashable, IIndexable<VertexIndex>`; `meshes.library.plato`):
`f.Count`, `f.At(i)`, `f.Vertices`, `f.Edge(i)`, `f.Edges` (directed `VertexPair`s in winding order),
`f.HasVertex(v)`, `q.FanTriangles` (the A-C diagonal split). Faces wind counter-clockwise seen from
outside (CONVENTIONS.md "Winding").

Meshes (`meshes.library.plato`, `meshes-polygon.library.plato`): `VertexCount`, `FaceCount`,
`UndirectedEdgeCount` on all three; `EulerCharacteristic` = V - E + F and `GenusIfClosed` =
(2 - chi) / 2 for any `IMeshElementCounts` (lines 727, 734); `ToTriangleMesh` on `QuadMesh3D`
(A-C split) and `PolygonMesh3D` (fan). `UndirectedEdgeCount` on `TriangleMesh3D` and `QuadMesh3D`
is a quadratic census (lines 200-212). `PolygonMesh3D` answers incidence:
`VerticesOfFace`, `UndirectedEdgesOfFace`, `FacesOfUndirectedEdge`, `IsBoundaryUndirectedEdge`,
`IsNonManifoldUndirectedEdge`, `TwinCorner`. `TriangleMesh3D` has `TopologyOf` and
`Welded(tolerance)` (`remeshing.library.plato:135,317`). **No stdlib predicate says whether a
mesh is manifold, closed, or consistently oriented**; `topology.types.plato` has a `Manifoldness`
sum and a `TopologySummary` record but no function computes them. The design's `06-mesh` owns those.

### C.7 Polylines, polygons, triangulation

```plato
type Polyline2D
    implements IGeometry2D, IConnected, IBounded2D, ILength, IPointSet2D, IDeformable2D
{
    Points: Array<Point2D>;
    Closed: Boolean;
}
// Polyline3D: the same with Point3D, IGeometry3D, IBounded3D, IPointSet3D, IDeformable3D.

type Polygon2D
    implements IGeometry2D, IClosedShape, IConnected, IArea, IBounded2D, IPointSet2D, ICentroid2D, IContainsPoint2D, INearestPoint2D, IDeformable2D, IMesh2D
{
    Points: Array<Point2D>;
}

type PolygonWithHoles2D
    implements IGeometry2D, IClosedShape, IConnected, IArea, IBounded2D, ICentroid2D, IContainsPoint2D, IDeformable2D, IMesh2D
{
    Boundary: Polygon2D;
    Holes: Array<Polygon2D>;
}

type TriangleMesh2D
    implements IValue, IMesh2D, IIndexedTriangleGeometry2D, IMeshElementCounts, IDeformable2D
{
    Positions: Array<Point2D>;
    Faces: Array<TriangleFace>;
}
```

`p.Triangulate` and `r.Triangulate` return a `TriangleMesh2D` (`stdlib/geometry/triangulation.library.plato:581,603`).
What they do, from that file: ear clipping, not Delaunay; no Steiner points and no quality
guarantee; positions are exactly the input points (for a region: the boundary's points, then each
hole's, see `PointPool` and `HoleStarts`), so face indices map back to the input; the outer ring is
made counter-clockwise and every hole clockwise whatever the stored winding; coincidence is exact;
a flat corner is clipped without emitting a face, so a ring of n points gives at most n - 2 faces.
Also `p.SignedArea`, `p.Area`, `p.Contains(point)`, `ShoelaceArea(points)`, and `VectorArea(points3D)`
(Newell's normal times the area, `polygons.library.plato:235`).

### C.8 The v1 B-rep names

```plato
type EdgeOrientation = Forward | Reversed;

// One oriented citation of an undirected edge inside a face boundary loop.
type BrepEdgeUse
    implements IValue
{
    Edge: UndirectedEdgeIndex;
    Orientation: EdgeOrientation;
}
```

`u.IsForward` is in `brep.library.plato:60`. Note that `BrepEdgeUse.Edge` is a **mesh** index
(`UndirectedEdgeIndex`), not a kernel `BrepEdgeIndex`; see G.2.

### C.9 Interfaces new types implement

```plato
interface IEquatable
{
    Equals(a: Self, b: Self): Boolean;
    NotEquals(a: Self, b: Self): Boolean;
}

interface IValue
    inherits IEquatable
{ }

interface IOrderable
    inherits IEquatable
{
    LessThanOrEquals(a: Self, b: Self): Boolean;
}

interface IIndex
{
    Value(x: Self): Integer;
}

interface IProcedural<TDomain, TRange>
{
    Eval(x: Self, input: TDomain): TRange;
}
```

`implements IValue` is what makes `==` available on a product type (D.6). `IOrderable` on a type
that is not an `IIndex` obliges a `LessThanOrEquals` body.

## D. Language limits that shape the design

**D.1 `Number` is a 32-bit float in the C# backend.** `src/Plato.Intrinsics/Number.cs:21` declares
`[DataMember] public readonly float Value;`; `writers/Plato.CSharpWriter/CSharpWriter.cs:140` maps
`{ "Number", "float" }`; `writers/Plato.CSharpWriter/CSharpWriterExtensions.cs:44` calls
`writer.WriteAll("float")`, the only call site. `CSharpWriter.WriteAll(string floatType)` has a
`"double"` branch (namespace `Ara3D.Geometry.DoublePrecision`) that nothing calls, and the runtime
wrapper is float-only, so switching needs both. The generated `Point3D` stores three `Number`s
(`generated/Plato.Generated.Foundation.Unoptimized/_Point3D.g.cs`). Other backends: C++ and CUDA
`float` (`writers/Plato.CppWriter/CppWriter.cs:161`), GLSL `float`, Rust `f64`
(`writers/Plato.RustWriter/RustWriter.cs:145`), TypeScript JavaScript `number`. So
`docs/SEMANTICS.md`'s "32-bit float in all current backends" is right for C#, C++, CUDA and GLSL
and wrong for Rust and TypeScript; `primitives.plato`'s "A 64-bit floating-point approximation" is
wrong for the primary backend. `Integer` is a 32-bit `int` (`src/Plato.Intrinsics/Integer.cs:19`).
Write the design for a real-number `Number`, and never state a tolerance smaller than float can
honour without saying so.

**D.2 A type cannot contain itself directly; it can through `Array<T>`.** The front end accepts
`type SelfDirect { Inner: SelfDirect; Value: Number; }` with no diagnostic (probe L01), but the C#
writer emits `public readonly SelfDirect Inner;` in a struct and the C# compiler stops with
`error CS0523: Struct member 'SelfDirect.Inner' of type 'SelfDirect' causes a cycle in the struct
layout` (probe C01, built). Through an array it works end to end: `type TreeNode { Children:
Array<TreeNode>; ... }` and `type ProbeExpr = Leaf(Value: Number) | Group(Terms: Array<ProbeExpr>);`
type-check, generate `IReadOnlyList<TreeNode>` fields, and compile (probes L02, L03, C01).
`docs/design/plato-sum-types-design-2026-07-27.md:508-511` says the same: "Indirection through
`Array<Tree>` works today; direct recursion needs a boxing/reference story, deferred." Recursive
functions over such types work (`ProbeTotal`, `ProbeSize` in C01). The README's flat-table,
typed-index design avoids the question; keep it that way.

**D.3 An interface-typed field is an existential with dynamic dispatch.** In
`type TrimmedSurface { Base: IParametricSurface; ... }`, `Base` holds one value of some type that
implements `IParametricSurface`, unknown statically. Decision
`tracker/decisions/2026-07-29-existential-concepts-dual-interface.md` defines it: the C# writer
emits a non-generic "view" interface holding the interface's object-safe members (those where
`Self` appears only as the receiver), and the field gets that type. Generated output confirms it:
`public readonly IParametricSurface Base;` (`generated/Plato.Generated.Unoptimized/_TrimmedSurface.g.cs`)
against `public interface IParametricSurface: IProcedural<UvCoordinate, Point3D> { Boolean ClosedU(); Boolean ClosedV(); }`
(`Interfaces.g.cs:1822`); probe C01 got `public readonly IParameterDomain Source;` the same way and
compiled. Consequences: a boxed value and a virtual call per use (the "no runtime dispatch" of
`docs/SEMANTICS.md` section 1 does not hold here); members that take or return `Self` are not
reachable through the field; an interface with no object-safe member cannot be used this way
(CHK308, `tests/plato-test-existential/negatives/viewless-interface-field.plato`); `match` cannot
see inside it; the law runner cannot construct it. The README's choice of closed sums for geometry
is the right one.

**D.4 `&&` and `||` evaluate both operands.** They are the ordinary functions `And` and `Or`
(`docs/SEMANTICS.md` section 6, "**`&&` and `||` DO NOT SHORT-CIRCUIT.**"); `All` and `Any` are
folds that visit every element (`docs/plato-intrinsics-surface.md`). `triangulation.library.plato`
nests two `if`s for exactly this reason ("The nesting is load-bearing"). Guard with `c ? x : y`,
`if`, or `match`, which all take a real branch.

**D.5 A type may have zero fields.** `type ProbeMarker implements IValue { }` with a static
`Answer(_: ProbeMarker): Integer` and a call `ProbeMarker.Answer` type-checks (probe L04;
`tests/plato-test-existential/stored-interface-ok.plato` declares `type Scalar { }`). The C# struct
has `Equals => true` (C01, `_ProbeMarker.g.cs:35`). The law runner cannot construct one. Use it as a
type token only.

**D.6 Equality.** `==` on two `Array<T>` values is CHK201 "No overload of 'Equals' matches
argument types (Array<Number>, Array<Number>)" (probe L13). `==` on a product type requires
`implements IValue` (or `IEquatable`): without it, CHK201 (probe L21); with it, accepted. `==` on a
sum type is accepted with no `implements` clause (probe L21). In the generated C#, record equality
compares array fields by reference: `Children.Equals(other.Children)` on `IReadOnlyList<TreeNode>`
(C01 `_TreeNode.g.cs:44`, and `Holes.Equals(other.Holes)` in `_TrimmedSurface.g.cs`), and the
runtime's `ReadOnlyList<T>` does not override `Equals`. Sum equality compares the tag and every
flattened case field (`_BrepCurve.g.cs:48`). So a law comparing two models, meshes, or
discretizations must compare counts and then elements, with a tolerance for `Number`s.

**D.7 A bodiless library function passes every gate and degrades at codegen.** No LINT rule
mentions it (`src/Plato.Compiler/Analysis/Linter.cs` lists LINT001-016; none applies), the type
checker accepts it, and the gate driver reports nothing for it (probe `gate`). In C#, a bodiless
function on a sandbox type becomes `public Integer ProbeTriangulate() => throw new NotImplementedException();`
(probe C02, compiled), and one on `Number` becomes a self-calling stub
`public static Number ProbeDeferred(this Number x) => x.ProbeDeferred();` that compiles and would
overflow the stack (probe C01). Harmless for a design; an implementation must replace every one.

**D.8 No generic sums, so no `Option<T>`.** CHK306 (probe L05). Partial results use one of the three
styles in `stdlib/CONVENTIONS.md` "Partial operations": a fallback parameter, a record with a
validity field, or a concrete sum whose classification is the payload.

**D.9 Names are global, and a duplicate is fatal.** A type or library name declared twice stops the
compilation before linting: "Symbol resolution error: Duplicate type or library definition:
BrepFace." then "Halting further computation" (probes L06, L20). A library may share its name with a
type: `library BrepValidation` beside the stdlib type `BrepValidation` compiles (probe L07), and the
C# writer renames the class (`library NumberInterval` became `public static class NumberIntervalLibrary`,
probe C03, compiled). A function may share its name with a payload-free case (`Reversed(d)` beside
`ProbeDirection.Reversed`, probe L24).

**D.10 `Self`-returning generic functions need a concrete boundary before chaining.** `i.Reverse.Start`
on a `NumberInterval` is CHK203 (12 equally specific `Start` overloads); returning `i.Reverse` from a
function declared to return `NumberInterval` works (probe L23). `stdlib/VERIFICATION.md` notes the
related permissiveness: "`Self` in return position is not arity-checked".

**D.11 Implicit conversions are inferred from names.** A one-parameter function named after its
return type is an implicit conversion (`stdlib/CONVENTIONS.md` "Conversions"). The sandbox must not
name a function after a type unless the conversion is faithful; use `ToX` otherwise (VOCABULARY.md
already says this). The stdlib's own `Angle(x: Number): Angle` is one such conversion; see F.

**D.12 Strings are minimal.** Literals and `==` work; `+` on `String` is CHK201 (probe L26). A
`Diagnostic.Message` or `Check.Law` is a literal; no message can be composed from values. Put the
numbers in `Measure`/`Worst` fields.

**D.13 What the front end does not check.** The CLI `lint` command (section E) stops at symbol
resolution and the linter: it catches unknown types and unknown function names, but not a known
name used with wrong argument types (`a.Distance(3.0)`), a field read on the wrong type (`p.Radius`
on a `Point3D`), `Integer * Number`, `==` on arrays, a missing match arm, or a wildcard arm. Those
need the type checker and the sum checker, which only the gate driver of section E runs from the
command line (probes L11-L17).

## E. The front-end gate

Two commands, both verified on 2026-10-17 against commit `f6e02cf0`. The first is the documented
CLI and checks parse, resolve and lint only. The second is a 94-line driver over the same compiler
assemblies that adds the type checker, the sum and existential checkers, and the style checker:
the same gates as the `plato_check` MCP tool, which cannot be used here because its server indexes
only `C:\Users\cdigg\git\plato\stdlib` and its binary dates from 2026-08-02. **Phase 3 should use
the driver.**

### E.1 What both commands must be given

- The three shipping tiers, `stdlib/foundation`, `stdlib/geometry`, `stdlib/graphics`. Not
  `stdlib/future`, not `stdlib/tests` (the sandbox's laws do not use the stdlib's law helpers).
- **Minus `geometry/brep.types.plato`, `brep.library.plato`, `brep.concepts.plato`** whenever the
  sandbox declares `BrepCurve`, `BrepSurface`, `BrepEdge`, `BrepFace`, `BrepLoop`,
  `BrepValidation` (as a type), `EdgeOrientation` or `BrepEdgeUse`, which VOCABULARY.md does (G.1).
  No other stdlib file references those names (searched: only the three brep files match), so the
  exclusion leaves a closed program. Probe G02 declared `EdgeOrientation`, `BrepEdgeUse` and a sum
  `BrepLoop` and passed with the exclusion, and failed with "Duplicate type or library definition:
  BrepLoop." without it.
- Every sandbox `.plato` file **except `*.spec.plato`**: the parser cannot read the invented
  constructs, and one parse failure halts the whole run ("Parsing failed for one of the input files,
  halting").

### E.2 The CLI gate (parse, resolve, lint)

Build once (36 s on this machine; the binary lands in the Plato repository's git-ignored `bin/`):

```bash
dotnet build C:/Users/cdigg/git/plato/src/Plato.CLI/Plato.CLI.csproj -c Release
```

`lint` reads each folder top level only, so merge into two flat folders first (Git Bash; `G` is any
scratch folder, `D` the sandbox):

```bash
P=/c/Users/cdigg/git/plato
D=/c/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh
G=<scratch>/gate-run
rm -rf $G && mkdir -p $G/stdlib $G/design
cp $P/stdlib/foundation/*.plato $P/stdlib/geometry/*.plato $P/stdlib/graphics/*.plato $G/stdlib/
rm $G/stdlib/brep.*.plato
find $D -name "*.plato" ! -name "*.spec.plato" -exec cp {} $G/design/ \;   # sandbox file names must be unique across layers
dotnet $P/src/Plato.CLI/bin/Release/net8.0/Plato.CLI.dll lint $G/stdlib $G/design --strict > gate.log 2>&1
echo exit=$?; grep "symbol resolution errors\|Ratchet" gate.log
```

The 154 tier files have unique names (the stdlib's own conformance script merges them flat the same
way). Runtime: 11 to 15 s. A clean run exits 0 and logs `Found 0 symbol resolution errors`; the
sandbox's findings are the lines whose path starts with the design folder. `--strict` fails only on
Error-severity lint findings; LINT001 is a Warning and does not fail it.

A resolution error (probe err-fieldtype, `Position: Point3d;`) exits 1:

```
[0:04.278] [Info] Symbol resolution error: Could not find type Point3d
[0:04.279] [Info] C:\...\primer-gate\err-fieldtype\probe.plato(408..415)
[0:04.279] [Info]     Position: Point3d;
[0:04.280] [Info] Found 1 symbol resolution errors
[0:04.280] [Info] Halting further computation
Compilation was not completed; cannot lint
```

The `(408..415)` is a character offset range, not a line. An unknown function in a body
(probe err-call, `c.ProbeEvaluate(t)`) gives three errors, "Could not find symbol ProbeEvaluate",
"Could not find function (AstIdentifier=ProbeEvaluate)", and the same as an exception trace. A parse
error (a missing `;`) gives `[Error] Error at (10,0,12,4) while parsing ImplementsList, expected
Rule failed __ ::= '}'` with no file name; the file is the one named by the preceding `Reading <file>`
log line.

### E.3 The driver gate: all front-end checks (use this one)

Create a folder with these two files and build it once (8 s; it builds the referenced Plato
projects too):

`PlatoGate.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>disable</Nullable>
    <Platforms>AnyCPU;x64</Platforms>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="C:\Users\cdigg\git\plato\src\Plato.Navigation\Plato.Navigation.csproj" />
  </ItemGroup>
</Project>
```

`Program.cs`:

```csharp
using System.Diagnostics;
using Ara3D.Geometry.AST;
using Ara3D.Geometry.Compiler;
using Ara3D.Geometry.Compiler.Analysis;
using Ara3D.Geometry.Compiler.Checking;
using Ara3D.Geometry.Navigation;
using Ara3D.Utils;

// Usage: PlatoGate <plato-repo> <design-folder> [--exclude <stdlib file name> ...]
// Compiles <plato-repo>/stdlib/{foundation,geometry,graphics} (top level) plus every *.plato under
// <design-folder> (recursive, *.spec.plato excluded) as ONE program, then runs the plato_check
// gates. Prints findings located in <design-folder> only. Exit 1 on any error in scope.
var timer = Stopwatch.StartNew();
var plato = args[0];
var design = Path.GetFullPath(args[1]);
var excluded = args.SkipWhile(a => a != "--exclude").Skip(1).ToHashSet(StringComparer.OrdinalIgnoreCase);
var files = new List<FilePath>();
foreach (var tier in new[] { "foundation", "geometry", "graphics" })
    files.AddRange(Directory.GetFiles(Path.Combine(plato, "stdlib", tier), "*.plato")
        .Where(f => !excluded.Contains(Path.GetFileName(f))).Select(f => new FilePath(f)));
var designFiles = Directory.GetFiles(design, "*.plato", SearchOption.AllDirectories)
    .Where(f => !f.EndsWith(".spec.plato", StringComparison.OrdinalIgnoreCase)).ToList();
files.AddRange(designFiles.Select(f => new FilePath(f)));
Console.WriteLine($"files: {files.Count} ({designFiles.Count} in design folder; {excluded.Count} stdlib file(s) excluded)");

bool InScope(string path) => !string.IsNullOrEmpty(path)
    && Path.GetFullPath(path).StartsWith(design, StringComparison.OrdinalIgnoreCase);
string Rel(string path) => Path.GetRelativePath(design, Path.GetFullPath(path));
var errors = 0;

var snapshot = SourceSnapshot.FromFiles(files);
var cache = new ParseCache();
var parsed = CheckSupport.Parse(snapshot, cache);
foreach (var p in parsed.Where(p => !p.Parsed || p.ParseErrors.Count > 0))
{
    errors++;
    foreach (var e in p.ParseErrors)
        Console.WriteLine($"PARSE {p.File.Path}: {e}");
    if (p.ParseErrors.Count == 0) Console.WriteLine($"PARSE {p.File.Path}: no AST");
}
if (errors > 0) { Console.WriteLine($"FAIL parse ({timer.Elapsed.TotalSeconds:F1}s)"); return 1; }

var comp = CheckSupport.Compile(parsed);
foreach (var e in comp.SymbolFactory?.Errors ?? new())
{
    errors++;
    var r = e.Node?.GetRange();
    var where = r != null ? $"{Rel(r.FilePath.ToString())}({r.BeginLineIndex + 1})" : "?";
    Console.WriteLine($"RESOLVE {where}: {e.Message}");
}
foreach (var m in comp.InternalErrors) { errors++; Console.WriteLine($"INTERNAL {m.Split('\n')[0]}"); }
foreach (var m in comp.SemanticErrors) Console.WriteLine($"SEMANTIC {m}");
if (!comp.CompletedCompilation) { Console.WriteLine($"FAIL resolve ({timer.Elapsed.TotalSeconds:F1}s)"); return 1; }

var linter = new Linter(comp);
foreach (var f in linter.SortedFindings.Where(f => InScope(f.File)))
{
    // LINT001 is a Warning to the CLI, but SEMANTICS.md says to treat it as an error when authoring.
    if (f.Severity == LintSeverity.Error || f.Code == "LINT001") errors++;
    Console.WriteLine($"LINT {Rel(f.File)}({f.Line}) {f.Code} [{f.Severity}] {f.Message}");
}

var results = new TypeChecker(comp).CheckAll();
foreach (var r in results.Where(r => !r.Succeeded))
    foreach (var d in r.Errors)
    {
        // Scope by the function under check: a diagnostic's origin may sit in the stdlib.
        var fnode = comp.GetAstNode(r.Function)
            ?? (r.Function?.OwnerType?.Methods.FirstOrDefault(m => m.Function == r.Function) is { } m ? comp.GetAstNode(m) : null);
        var frange = fnode?.GetRange();
        var onode = d.Origin != null ? comp.GetAstNode(d.Origin) : null;
        var orange = onode?.GetRange();
        var range = orange != null && InScope(orange.FilePath.ToString()) ? orange : frange;
        var file = range?.FilePath.ToString() ?? "";
        if (!InScope(file)) continue;
        errors++;
        Console.WriteLine($"TYPE {Rel(file)}({(range?.BeginLineIndex ?? -1) + 1}) {r.Function?.Name}: {d.Code} {d.Message}");
    }

var sums = new SumTypeChecker(comp).Check().Concat(new ExistentialConceptChecker(comp).Check()).ToList();
foreach (var d in sums.Where(d => d.Severity == DiagnosticSeverity.Error))
{
    errors++;
    Console.WriteLine($"SUM {d.Code} {d.Message}");
}

foreach (var f in StyleChecker.Check(parsed.Where(p => InScope(p.File.Path.ToString()))))
{
    if (f.Severity == LintSeverity.Error) errors++;
    Console.WriteLine($"STYLE {Rel(f.File)}({f.Line}) {f.Code} [{f.Severity}] {f.Message}");
}

Console.WriteLine($"{(errors == 0 ? "PASS" : "FAIL")}: {errors} error(s) in scope; {results.Count} functions type-checked ({timer.Elapsed.TotalSeconds:F1}s)");
return errors == 0 ? 0 : 1;
```

Build and run (the scratch copy used here is at `...\scratchpad\primer-gate\driver\`):

```bash
dotnet build <driver-folder>/PlatoGate.csproj -c Release
dotnet <driver-folder>/bin/Release/net8.0/PlatoGate.dll C:/Users/cdigg/git/plato \
    C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh \
    --exclude brep.types.plato brep.library.plato brep.concepts.plato
```

It recurses into the layer folders, skips `*.spec.plato`, needs no copying, reports with line
numbers relative to the sandbox, and exits 1 on any parse, resolve, Error-level lint, LINT001, type,
sum, existential, or Error-level style finding in the sandbox. Runtime: 12 to 15 s on an idle
machine, up to a minute under load; about 3,850 stdlib functions are type-checked each run. The
stdlib itself type-checks with zero diagnostics at this commit, so every finding printed is the
sandbox's.

The requested probe file (`gate/probe.plato`: a product type with a `Point3D` field, a sum type, a
library with one bodiless function and one `Law_`) produced:

```
files: 155 (1 in design folder; 0 stdlib file(s) excluded)
LINT probe.plato(12) LINT003 [Info] field 'ProbeSample.Position' is never read by any library function, ...
LINT probe.plato(13) LINT003 [Info] field 'ProbeSample.Parameter' is never read by any library function, ...
STYLE probe.plato(1) STY005 [Error] file mixes declaration kinds (types + library); one kind per file - ...
FAIL: 1 error(s) in scope; 3854 functions type-checked (12.5s)
```

STY005 is expected: the probe mixes kinds on purpose; a sandbox file must not. LINT003 (a field no
function reads) is Info and expected in a declarations-first design. The same file passes the CLI
gate (exit 0, 13.0 s). What failures look like:

```
RESOLVE probe.plato(12): Could not find type Point3d
INTERNAL Halted after 1 symbol resolution error(s); see SymbolFactory.Errors for the details
FAIL resolve (5.2s)

TYPE p.plato(4) ProbeBad: CHK201 No overload of 'Distance' matches argument types (Point3D, Number)
TYPE p.plato(4) ProbeHalf: CHK101 Cannot unify 'Integer' with 'Number'
SUM CHK300 non-exhaustive match on sum type 'ProbeKind': missing case(s) 'KindC' - add an arm for each (v1 has no default arm)
SUM CHK306 generic sum type 'ProbeMaybe<T>' is not supported in v1; declare a monomorphic sum or await the generics follow-up
LINT p.types.plato(2) LINT001 [Warning] type 'ProbeRay' implements 'IProcedural' but no implementation was found for 'Eval(ProbeRay, Number):Point3D'; ...
RESOLVE ...\stdlib\geometry\brep.types.plato(64): Duplicate type or library definition: BrepFace.
```

`SUM` lines carry no file location; search the sandbox for the named sum. A duplicate-name error
points at the stdlib's copy of the name, not the sandbox's.

### E.4 Codegen, if Phase 3 wants it

Not part of the gate, but cheap for foundation-only probes: `dotnet <Plato.CLI.dll> <plato>/stdlib/foundation <probe-folder> --out=<out> --csharp-style=extensions`
(5 s), then build `<out>` with a project that imports
`C:\Users\cdigg\git\plato\src\Plato.Intrinsics\Plato.Intrinsics.projitems` and references
`Ara3D.SDK.Core` 1.6.1, as `generated/Plato.Generated.Foundation.Unoptimized/*.csproj` does. The
geometry tier's generated C# does not compile today (`stdlib/VERIFICATION.md`, rung 5), so a sandbox
that uses geometry types cannot be compiled to C# yet.

## F. Pitfalls checklist

Two limits found by the layer 1 author with small test files on 2026-10-17, confirmed by probe:

- **`match` only on a parameter or a local, never on an index expression.** The sum checker cannot
  type `match (g.Curves[i.Value]) { ... }`; bind the element to a `var` first, or take it as a
  parameter, the way the stdlib does.
- **A call types only when the callee's library was compiled earlier in file order.** A `match` arm
  calling a function from a library file that sorts later leaves the arm untyped. Keep the
  libraries a function depends on in files that sort before it, or expect the sum checker to miss
  the arm.

- Write `0.0`, not `0`, wherever a `Number` is meant: Integer never converts to Number (CHK201/CHK101).
- Never guard an index, a division, or a sum projection with `&&`/`||`: both sides run. Use `? :`.
- A bare `Number` passed as an `Angle` is taken as radians without a word: build angles with
  `.Degrees`, `.Turns` or `Angle(x)` on purpose.
- Qualify every sum case constructor (`BrepSurface.Plane(f)`): bare names turn ambiguous (CHK203)
  when another sum gains the same case.
- A `match` lists every case, binds every payload field positionally, and has no `_` arm.
- Never declare a type, interface, or library whose name the stdlib already declares; it halts the
  compiler. Check `stdlib/types-and-concepts.txt` (types and interfaces only; sums appear with empty
  braces, functions not at all) and grep the library files for function names.
- A type must not contain itself except through `Array<T>` (CS0523 in C#, accepted by the front end).
- Put `implements IValue` on every product type whose values a law compares with `==`.
- Compare arrays element by element with a count check first; `==` on arrays does not type-check
  and record equality compares arrays by reference in C#.
- Give a typed index `implements IValue, IHashable, IComparable, IIndex { Value: Integer; }` and use
  `xs[idx]`, `idx.IsNone`, `xs.IsValidIndex(idx)` instead of `.Value` arithmetic.
- `v.Normalize` of a zero vector is NaN; `NormalizeOr` falls back only at exactly zero length.
- Static calls `T.F(...)` need `F(_: T, ...)`; `Direction3D.FromVector(v)` is wrong, `v.FromVector` right.
- Do not chain a member onto a `Self`-returning generic result (`i.Reverse.Start`); pass it through a
  concrete return type first.
- `Eval(BSplineCurve3D, t)` takes a unit parameter; STEP knots are natural parameters. Use
  `BasisFunction` or the sandbox's own evaluator.
- Ear clipping in `Triangulate` keeps the input points and may emit fewer than n - 2 faces; it is not
  a constrained Delaunay triangulation.
- No `Filter`, `Sum` (use `SumOf`), `+` on strings, or `default`; no `++`, `+=`, `switch`,
  `break`, `throw`.
- A builder is never a function's first parameter, never stored, never captured; rebind after every
  `Add`/`Set` and end with `Freeze()`.
- Keep a product type at 10 fields or fewer (STY002).
- Never name anything `New` (STY001); never write the token `implicit` outside comments (STY003).
- A function named after a type (`Point3D(v: Vector3D)`) is an implicit conversion; name lossy or
  choice-making conversions `ToX`.
- An interface-typed field means boxing and dynamic dispatch; use a closed sum instead.
- A `Law_` over a type holding an array, a sum, or an interface is never run on random instances;
  plan a witness for it.
- Laws receive `Integer`s in [-8, 8] and `Number`s in [-10, 10] including 0 and negatives: guard
  negative tolerances, zero radii, and out-of-range indices.
- No literal epsilon in a law (SPEC-DSL.md); `ComparisonTolerance` and `AlmostEqual` exist for
  scalars, the sandbox's `Tolerances` for geometry.
- One kind of declaration per file; the `.spec.plato` files stay out of the gate.

## G. Collisions found in VOCABULARY.md

Found while preparing this primer; each needs a decision before or during Phase 2.

1. **The v1 B-rep names.** `BrepCurve`, `BrepSurface`, `BrepEdge`, `BrepFace`, `BrepLoop` and
   `BrepValidation` (a type) are declared in `stdlib/geometry/brep.types.plato`; redeclaring any of
   them in the sandbox halts the compiler unless the three `brep.*.plato` files are excluded from the
   compilation (section E.1). With the exclusion, `EdgeOrientation` and `BrepEdgeUse` disappear too,
   so VOCABULARY.md's "reused as they are" row for those two cannot stand: the sandbox must declare
   them itself, or rename its v2 types and keep the v1 file.
2. **`BrepEdgeUse.Edge` is a mesh index.** The stdlib declaration is
   `{ Edge: UndirectedEdgeIndex; Orientation: EdgeOrientation; }`; VOCABULARY.md's kernel uses
   `BrepEdgeIndex` for edges. Reusing `BrepEdgeUse` unchanged puts a mesh-side index in the kernel,
   against the naming rule that mesh indices stay on the mesh side.
3. **`VertexLayout` already exists** in `stdlib/graphics/render.types.plato:202`
   (`{ Attributes: Array<VertexAttributeDescriptor>; ByteStride: Integer; }`). Layer 6's
   `VertexLayout` is a fatal duplicate; rename it (for example `MeshVertexNumbering`).
4. **Library block `BrepValidation`** (layer 7) beside the stdlib type `BrepValidation` compiles
   (D.9). Harmless, but if G.1 is resolved by keeping the v1 files, the shared name will read badly.
5. **`UvCoordinate`** is documented as "A normalized 2D surface parameter"; the design stores natural
   parameters in it. Say so in VOCABULARY.md, or declare a sandbox type.
6. Fields named `Length` and `Angle` (`Tolerances`) and a library function named like a field
   elsewhere produce LINT014 (Info) about C# call syntax (plato-323); harmless to the gate.

Other names in VOCABULARY.md that were checked against the index and are free: `Tolerances`,
`Check`, `Diagnostic`, `Report`, `Severity`, `Provenance`, `Periodicity`, `CurveDomain`,
`SurfaceDomain`, `DomainSide`, `LengthUnit`, `Limit`, `Pcurve`, `GeometrySet`, `ElementIndex`,
`ShellIndex`, `BodyIndex`, `ModelMesh`, `FaceMesh`, `UvLoop`, `UvRegion`, `ConformanceLevel`,
`MeshEdgeTable`, `TriangleQuality`, `QuadQuality`, `MeshingOptions`, `LengthTolerance`,
`AngleTolerance`, `ParameterTolerance`, `FaceBound`, `BrepVertex`, `BrepShell`, `BrepBody`,
`BrepModel`, `MeshVertexProvenance`, `BoundarySource`, `UvTriangulation`, `EdgeDiscretization`,
`DiscretizationCriteria`. Case names that equal stdlib type names (`Plane`, `Cylinder`, `Cone`,
`Sphere`, `Torus`, `Circle`, `Ellipse`) compile when qualified (probe L08).
