# First target language, and the width of `Number`

Investigation for TKT-299 (this sandbox's STEP B-rep to mesh design), 2026-10-17. Two questions from
the owner. First: which Plato backend should the library be developed and verified on first, so that
the loop of editing Plato, generating, building, running laws and reading a counterexample is as fast
and as trustworthy as it can be, with a C++ build to follow. Second: should `Number` be "whatever the
backend has", as in GLSL, or something fixed?

Plato is at commit `f6e02cf0` (`C:\Users\cdigg\git\plato`). Every number marked *measured* was taken
on the owner's Windows 11 machine on 2026-10-17. Generated code, builds and logs went to the session
scratchpad (`...\scratchpad\target-language\`); nothing in the Plato repository was edited.

## The answer in brief

- **First target: C#**, as the owner leans, **on the condition that the C# `Number` becomes a 64-bit
  float before the first algorithm body is written.** C# is the only backend that emits sum types and
  `match`, which this design uses for every geometry and topology type. It is also the only backend
  whose foundation tier compiles and runs its laws today. The measured loop for the foundation tier
  and its laws, from edit to verdict, is 10.3 to 11.6 s.
- **`Number`: one width per compilation, 64-bit by default on every CPU backend** (C#, C++, Rust,
  TypeScript), and 32-bit only in an explicit GPU profile (GLSL, CUDA device code, a future WGSL). A
  library that needs 64 bits says so with a law that fails in a 32-bit compilation. The GLSL-style
  "whatever the backend has" is what Plato does today, by accident: the same program computes in
  32 bits in C# and in 64 bits in TypeScript.
- **The two facts most likely to change the owner's view.** First, C# `Number` is a 32-bit `float`
  today (`src/Plato.Intrinsics/Number.cs:21`). At 32 bits, coordinates in a 100 m building measured in
  millimetres are spaced 0.0078 mm apart, 78,000 times OpenCascade's coincidence tolerance. Second,
  "porting is regenerating" is not yet true for C++. The C++ writer skips every B-rep type because it
  has no sum types, it caps `Array<T>` at 64 elements, and its output for the forward foundation tier
  does not compile. Turning C++ on means work on the writer, not on the library.

## 1. Terms

- **Backend, writer.** A backend is a target language; its writer is the C# project under `writers/`
  that turns checked Plato into that language.
- **Tier.** One of the stdlib folders `foundation`, `geometry`, `graphics` (shipping) and `future`.
  This library needs `foundation` and parts of `geometry` (meshes, topology, splines, polygons).
- **Law, witness, law runner.** A `Law_*` function returns `Boolean` and must hold for all inputs; a
  `Witness_*` builds a well-formed example; the law runner (`tests/conformance/Plato.ForwardConformanceTests`)
  executes laws. Rungs 0 to 6 are the verification ladder of `stdlib/VERIFICATION.md`: rung 5 is "the
  generated code compiles", rung 6 is "the laws run and hold".
- **Inner loop.** Edit a `.plato` file, generate, build, run laws and tests, read the failure.
- **binary32, binary64.** IEEE 754 single and double precision: 24-bit and 53-bit significands.
- **ULP** (unit in the last place). The gap between adjacent representable numbers near `x`:
  2^(floor(log2 x) - 23) in binary32, 2^(floor(log2 x) - 52) in binary64.
- **Machine epsilon.** The ULP of 1: 2^-23 (about 1.19e-7) and 2^-52 (about 2.22e-16).
- **FMA contraction.** A compiler fusing `a * b + c` into one fused multiply-add, which rounds once
  instead of twice and so changes the last bits.

## 2. The state of each backend at `f6e02cf0`

### 2.1 What each writer emits (read from the writers)

| | C# | TypeScript | C++ | CUDA | Rust | GLSL |
|---|---|---|---|---|---|---|
| Writer | `writers/Plato.CSharpWriter`, 7,516 lines | `Plato.TypeScriptWriter`, 2,639 | `Plato.CppWriter`, 3,290 | the C++ writer, `CppDialect.Cuda` | `Plato.RustWriter`, 2,165 | `Plato.GlslWriter`, 1,181 |
| `Number` | struct wrapping `float`, math through `MathF` (`src/Plato.Intrinsics/Number.cs:21`, `CSharpWriter.cs:140,597`) | `number`, binary64 (`TypeScriptWriter.cs:133`) | `float` (`CppWriter.cs:161`; the class comment says float so that the C++ and CUDA outputs agree) | `float` | `f64` (`RustWriter.cs:145`) | `float` (`GlslWriter.cs:103`; GLSL ES has no double) |
| `Integer` | struct wrapping `int` (`Integer.cs:19`) | `number`; division is `Math.trunc(a / b)` | `int` | `int` | `i64` | `int` |
| Sum types and `match` | yes: tagged struct (`WriteSumType`, 102 lines, `CSharpConcreteTypeWriter.cs:429`); `match` lowers to tag tests | no: CHK320 comment (`TypeScriptTypeWriter.cs:103`) | no: a type with a sum field is "not representable" | no | no: CHK320 (`RustTypeWriter.cs:67`) | no |
| Loops (`var`, `while`) | yes | yes | yes | yes | yes | yes; no recursion |
| `List` and `Buffer` builders | yes (`PlatoList`, `PlatoBuffer`) | yes (prelude classes, `TypeScriptWriter.cs:265`) | no | no | no | no |
| `Array<T>` | `IReadOnlyList<T>` | JS array | fixed capacity 64; oversized results are clamped (`CppPrelude.cs:231`) | same | `Vec` | none |
| `String` | full | full | fixed capacity 64 | same | `String` | none |

There is no Python writer. CUDA output is the C++ output with a different preamble
(`tests/Plato.CppWriter.Tests/README.md`, test "Dialects_Differ_Only_In_The_Preamble").

### 2.2 What each backend does with the stdlib (measured)

Generation used the built `Plato.CLI.exe` (Release). Times are wall clock.

| | C# | TypeScript | C++ | Rust |
|---|---|---|---|---|
| foundation: generate | 4.5 to 4.9 s; 283 files, 32,239 lines, 3.2 MB | 3.9 s; 13,979 lines, 0.9 MB | 4.8 s; 21,941 lines; 5,014 functions emitted, 1,618 skipped | 3.9 s; 14,526 lines |
| foundation: compile | 3.3 to 3.8 s, 0 errors | (compiled together with the other tiers, below) | MSVC `cl /std:c++17` stopped at 100 errors (C2672) after 92.7 s, environment setup included | `cargo check`: 3,347 errors in 10.5 s |
| foundation + geometry: generate | 16.0 s; 751 files, 95,963 lines, 9.0 MB, no degraded bodies | 10.0 s; 43,592 lines | 12.9 s; 39,124 lines, 16.4 MB; 7,921 functions emitted, 6,498 skipped | not run |
| foundation + geometry: compile | four defects: a parameter named `base` is not escaped (20 syntax errors in `Sampling.g.cs` and `_Integer.g.cs`); with that escaped, two CS1929 (`Contains` on `ISignedDistanceField3D` and `IImplicitVolume3D`) and one CS0117 (`Constants.UniformWeights`) | with graphics as well: 2,476 type errors (1,559 TS2345, 385 TS2339, 363 TS2304, and others), hidden by a `// @ts-nocheck` stamp (`demos/typescript/geometry-samples/scripts/stamp-nocheck.mjs`) | not run | not run |
| executes | foundation tests 37 of 37 (`tests/Plato.Generated.Foundation.Tests`); law runner: 35 law cases, 25 trials each, all pass | demo tests 26 of 26 (`geometry-samples`: BVH, octree, convex hull, samples) on freshly generated code | no runtime test exists; `Plato.CppWriter.Tests` only compiles, and only `stdlib-legacy` | the demo crate uses a curated subset (`demos/plato-src`), not the stdlib |
| loop with laws | 10.3 to 11.6 s: generate 4.5 to 4.8 s, build and test 5.8 to 6.9 s | about 22 s for three tiers (generate 12.2, `tsc` 4.6, `node --test` 5.0), with no law runner | compiling alone takes over 90 s | none |

How these were obtained, and what they correct:

- **C# code generation, rung 5.** `tools/regen-foundation.ps1 -WhatIf` took 16.9 s and reported
  "changed 0, added 0, removed 0": the tracked `generated/Plato.Generated.Foundation.Unoptimized`
  matches the library. The real run was skipped because it rewrites that tracked folder; its three
  steps (generate, build, test) ran on a scratch copy instead. Most of the 16.9 s is `dotnet run`
  checking that the CLI is up to date; the CLI binary alone takes 4.7 s.
- **C# laws, rung 6.** The law runner works when it is given its own build. I merged
  `stdlib/foundation` with `stdlib/tests/foundation.laws.plato` and `sorting.laws.plato`, generated C#,
  and compiled it with `LawTests.cs` and `ConformanceSupport.cs` copied unchanged. NUnit discovered 35
  law cases plus the two guard tests, and all passed. The only driver script,
  `C:\Users\cdigg\git\studio\tools\regen-forward-conformance.ps1`, cannot run, because it passes
  `--scalar=float`, which the CLI now rejects (`PLATO-PRIMER.md`, section B). `easing.laws.plato` and
  `special-numerics.laws.plato` need the tiers above foundation (80 resolution errors without them).
- **C# geometry tier.** `stdlib/VERIFICATION.md` says the tiers above foundation "generate C# that does
  not yet compile". Without optimizer flags, foundation plus geometry is down to the four defects
  above. The `base` defect is a missing keyword escape in the writer. Graphics and the conformance
  recipe's flags (`--optimize --inline --loops` and the rest) were not tried.
- **TypeScript.** The tracked `src/plato/plato.g.ts` dates from 2026-08-04. Regenerating it at
  `f6e02cf0` gives a 7,793-line diff, and the demo tests still pass. The 102 sum types dropped from the
  three tiers include the stdlib's own `BrepCurve`, `BrepSurface` and `EdgeOrientation`.
- **C++.** In the skip list of the foundation-plus-geometry output, all five B-rep v1 types read
  "field type not representable in C++". Most other skips are cascades ("calls X, which is not
  emitted"). The CUDA toolkit 13.3 is now on `PATH`, so the writer tests' "no toolkit installed" note
  is out of date.

### 2.3 Semantics that already differ between backends, whatever the width

- **`Number.Round(digits)`.** C# calls `MathF.Round(v, digits)`, which rounds half to even at `digits`
  decimal places (`Number.cs:131`). C++ emits `roundf(a)`, which ignores `digits` and rounds half away
  from zero (`CppWriter.cs:1564`). TypeScript emits `Math.round(this)`, which ignores `digits` and
  rounds half toward positive infinity (`TypeScriptTypeWriter.cs:373`).
- **`Number.Epsilon` is the smallest positive subnormal, not the machine epsilon.** It is
  `float.Epsilon` (about 1.4e-45) in C# (`Number.cs:103`) and `Number.MIN_VALUE` (about 4.9e-324) in
  TypeScript. `matrices-ops.library.plato:66` uses it as a singularity threshold, which in effect means
  "determinant not zero".
- **The documents disagree.** `docs/SEMANTICS.md`, sections 1 and 8, says `Number` is 32-bit in every
  backend; `stdlib/foundation/primitives.plato:22` says 64-bit. The writers make it 32-bit in C#, C++,
  CUDA and GLSL and 64-bit in TypeScript and Rust. `tracker/issues/plato-449.md` records the TypeScript
  half of this.

## 3. Criteria for the first target

| Criterion | Weight | C# | TypeScript | C++ | Rust |
|---|---|---|---|---|---|
| The pipeline works for this design | decisive | sums and builders; foundation green; geometry four defects away | no sums; output type-checks only with checking off | no sums; 64-element arrays; foundation does not compile | 3,347 errors on foundation |
| Loop speed | high | 10 to 12 s | about 22 s, without laws | over 90 s to compile | none |
| Laws and property tests | high | runner works; needs witnesses and generators | no runner | none | none |
| Debugging a wrong mesh | medium | debugger on readable C#; GLB export exists | three.js directly | debugger, slow builds | none |
| Interop with the toolkit and an oracle | medium | STEP tokenizer, mesher, comparison harness and MCP servers are all C# | viewer and public pages | OCCT natively | weak |
| Floating-point determinism | medium | IEEE basic operations, no contraction (measured) | the same (measured); `Math.sin` varies by engine | depends on flags | strict basic operations |
| Feedback to an agent | medium | two type checkers; laws fail by name | errors surface at run time | long and noisy | noisy |

**3.1 Pipeline coverage decides it.** The design is built on closed sums: `BrepCurve`, `BrepSurface`,
`BrepLoop`, `BrepBody`, `Periodicity`, `Provenance`, `MeshVertexProvenance`, `BoundarySource`,
`StepAttribute`, `Severity` and `Limit` (`VOCABULARY.md`), with `match` in every algorithm (README,
"Closed sums for geometry"). Only the C# writer emits sums. In TypeScript a sum value would not exist,
and the tag tests that `match` lowers to (`IsLine()`) would fail at run time.

**3.2 Loop speed.** C# has the fastest measured loop that includes laws: about 4.7 s to generate,
3.5 s to compile, and 2.3 s to run NUnit without a rebuild. The library adds its own files to
foundation and part of geometry, so expect 15 to 25 s once geometry is in the compilation (16 s to
generate foundation plus geometry, 4.6 s to compile it). TypeScript's loop takes about as long and
checks less. A C++ single-header build of foundation takes longer than the whole C# loop.

**3.3 Laws and property tests.** The C# runner finds `Law_*` by reflection and feeds each law 25 seeded
pseudorandom instances. Three of its limits will bite this design at once:
- it cannot construct arrays or sums, so every law over `BrepModel` is witness-only (`PLATO-PRIMER.md`,
  section B);
- its numbers lie in [-10, 10] (`ConformanceSupport.cs:94-98`);
- it does not shrink a failing input to a smaller one.

The remedies in C# are small. Discover `Witness_*` functions, and add an `Integer` selector over
witnesses. For pointwise parameters, use a property-testing library that shrinks a failure to a
minimal counterexample and prints a replayable seed: CsCheck (PCG-based generation, seed replay,
regression mode) or FsCheck. TypeScript has fast-check and C++ has RapidCheck, but neither backend has
a runner, and neither can express the sums the laws are about.

**3.4 Debugging a wrong mesh.** In C#, the generated code is one readable `.g.cs` per type, so
breakpoints work. The toolkit exports GLB from C#
(`deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Gltf/BosGlb.cs`, through SharpGLTF), and the file
opens in the viewer or the studio's 3D pane. The comparison harness writes probe meshes and reads
`MeshDump` files. TypeScript can hand a mesh to three.js with no file in between, which is quicker for
poking at one mesh. The design's own `Check` records carry a `Provenance`, so they point at the failing
vertex in any language.

**3.5 Interop, and a reference reader for differential testing.** The toolkit side is C#:
- `deps/ara3d-sdk/src/Ara3D.IO.StepParser` tokenizes Part 21 files and reads reals as `double`
  (`StepToken.cs:69`).
- `Ara3D.Ifc.Mesher` is the mesher this library sits beside.
- The comparison harness `deps/bim-open-data/tests/data/Ara3D.IfcMeshingComparison` already has an
  `IMeshingBackend` interface, a `DumpBackend` for meshers read from dump files, `MesherMatrix`
  (every mesher compared with every other), and a web-ifc oracle.
- The MCP servers and node packs that would expose the library are C#.

Reference readers, by language:
- C++: OpenCascade (OCCT) reads AP214 and AP203 and parts of AP242; STEPcode generates EXPRESS readers.
- JavaScript: occt-import-js runs OCCT's importer in Node or the browser and returns meshes as JSON;
  opencascade.js exposes the full API.
- C#: OCCSharp, a SWIG wrapper of OCCT 7.8, still a preview.
- Python: pythonocc-core, the full OCCT API, including surface evaluation at (u, v).
- Rust: monstertruck (a fork of truck) with a STEP module, and ruststep, whose README calls it
  experimental.

Run the oracle out of process: a Node script around occt-import-js, or a Python script around
pythonocc, writes a dump file that `DumpBackend` reads. Then the target language does not constrain
the choice of oracle.

**3.6 Floating-point determinism.**

| | Basic operations (+ − × ÷ √) | FMA contraction | Transcendentals (`sin`, `atan2`, `pow`) |
|---|---|---|---|
| C# (.NET 8, x64) | IEEE binary32 and binary64 | none, measured: `a*b+c` with a = 1+2^-30, b = 1-2^-30, c = -1 gives 0 after 2 million tier-1 calls on an FMA-capable CPU; `Math.FusedMultiplyAdd` on the same inputs gives -8.67e-19 | the platform C math library; results can differ by an ULP between Windows and Linux |
| JavaScript (Node 22.13.1) | binary64 | none, measured: the same test gives 0 | "implementation-approximated" in ECMA-262; differs between engines, and even between V8 versions |
| C++ | IEEE when flags allow | MSVC `/fp:precise` stopped contracting in VS2022 (`/fp:fast` and `/fp:contract` turn it on); GCC contracts by default in GNU modes; `nvcc --fmad=true` is the default | the platform C math library |
| Rust | binary32 and binary64; no contraction unless `mul_add` is written | none | `f64::sin` calls the platform library; the `libm` crate makes it portable |

What this means for the design. When no backend contracts, the basic operations give bit-identical
results everywhere. Transcendentals, and any value computed through `Cos` or `Atan2`, may differ in
the last bits. So bit-identical meshes across backends can be required only of the integer parts
(element indices, provenance tags, the element-to-face map), and only if every decision that chooses
topology is computed from basic operations. Positions must agree within `LengthTolerance`. Section 5.5
turns this into laws.

**3.7 Feedback to an agent.** The number of compiler errors is a fair proxy for how much signal
Claude gets from each build:
- C#: 0 errors on foundation; four defects with geometry, each pointing at its cause.
- TypeScript: 2,476 type errors, switched off, so a mistake surfaces at run time, far from its cause.
- Rust: 3,347 errors.
- C++: the build stops at 100.

C# also checks twice: the wrapper scalars make the C# compiler re-derive Plato's typing
(`tracker/decisions/2026-08-01-wrapper-scalars-are-the-only-representation.md`). A failing law reports
its type, its name and up to five failing inputs.

**3.8 The cost of turning on C++ later.** Measured against this design, the C++ writer lacks:
1. sum types, which every kernel type needs;
2. a heap-backed `Array<T>` (fixed at 64 elements today; a model has thousands of faces);
3. the `List` and `Buffer` builders;
4. strings longer than 64 characters;
5. a forward-stdlib build that compiles (100 or more errors on foundation);
6. any runtime test, or a law runner;
7. any `Number` width other than `float`.

The reflection runner should not be ported. Make the cross-backend harness data-driven instead: each
backend reads witnesses from JSON and writes its results to JSON, and a comparator law compiled to C#
(`Law_MeshesAgree`, section 5.5) judges them. The C# runtime already has `PlatoJson.cs` and JSON
converters for the scalars. With that in place, a C++ build is checked against the same witnesses and
oracles on the day it compiles.

## 4. Recommendation and staged path

### 4.1 First target: C#, after widening `Number`

I agree with the owner's lean, for a narrower reason than familiarity: the C# writer is the only one
that can emit this design at all, and its foundation tier compiles and runs laws today. TypeScript is
already binary64 and draws straight into the toolkit's viewer, but it needs sum emission and
type-correct output before its compiler checks anything. It becomes the right second target when STEP
meshing is wanted on the public pages (PROJECT.md, workflow 1). Starting in C++ would mean writing the
writer and the library at the same time. Rust does not compile the foundation tier.

Where I differ from the lean is the order. Starting in C# as it stands would build and test a binary32
kernel: its laws would be tuned to binary32, every tolerance loosened, and all of them tightened again
later. So the first task is the precision change of section 5, scoped to C#.

The smallest Plato change that unblocks each candidate:

| Target | Change | Size |
|---|---|---|
| C# | Back `Number` with `double`. That touches `Number.cs` (16 `float` and `MathF` sites), the writer's scalar map and float-specific sites (9 sites in 7 files, among them `CSharpWriter.cs:140,597`, `CSharpWriterExtensions.cs:44`, `ComponentUnroller.cs`, `TirComponentUnroller.cs`), the runner's `NextFloat`, and the JSON converters. This is the goal of `plato-370`. | about a day, plus rerunning the gates |
| TypeScript | Emit sums (port the 102-line C# emitter as a tagged class with case predicates), then reduce the 2,476 type errors or accept running unchecked. | days to weeks |
| C++ | The seven items of 3.8. | weeks |

### 4.2 The first week in C#

1. **Width.** Add the 64-bit `Number` to C#, behind the compilation-wide setting of section 5.
   Regenerate foundation; the 37 foundation tests and the 35 law cases must pass. Add
   `Law_NumberIsBinary64` (section 5.5).
2. **A one-command sandbox gate.** Merge the three shipping tiers, minus the stdlib's three
   `brep.*.plato` files (`PLATO-PRIMER.md`, E.1), with the sandbox's real-Plato files; generate, build,
   and run the law runner. The scratch harness of section 2.2, made into one project with absolute
   paths, is the template. Fix the `base` escape and the three geometry errors in the Plato
   repository, or take the derived-subset route of `tools/regen-triangulation.ps1`.
3. **Runner extensions.** Discover `Witness_*` and run each law over every witness. Add
   `Integer`-selector laws. For pointwise parameters, use a CsCheck generator: magnitudes up to 1e9,
   shrinking, and the seed printed in the failure message.
4. **First bodies.** The closed-form part of `01-geometry`: evaluation, partial derivatives and
   inverse evaluation for the line, circle, plane, cylinder, cone, sphere and torus. Their laws:
   evaluating the inverse returns the point, the partials agree with central differences, and
   evaluation still holds far from the origin.
5. **Seeing it.** Dump the witness meshes to GLB. Wire one occt-import-js dump of three public STEP
   files into `DumpBackend`, so the oracle path exists before the face mesher does.

### 4.3 What to keep portable from the first day

- **Every algorithm body in Plato.** Host-language code is allowed only at a listed boundary: Part 21
  tokenizing, files, timing. Plato strings support only literals and `==` (`PLATO-PRIMER.md`, D.12),
  so `ParseStep` is a host function in every backend; in C# it wraps `Ara3D.IO.StepParser`. Keep the
  list in one file: it is the bill for the C++ port.
- **No interface-typed fields** (existentials, `PLATO-PRIMER.md`, D.3), and no lambdas stored in data.
  Lambdas only as arguments the inliner removes.
- **No `Round`, and no `Number.Epsilon` as a tolerance** (section 2.3).
- **Decisions that choose topology use only + − × ÷ √ and comparisons**, or a robust predicate, and
  never a transcendental. Add this rule to `SPEC-DSL.md`, section 5.
- **Witnesses and results serialize to JSON**, so a second backend is judged on the same data.
- **No dependence on a fixed `Array` capacity, on string length, or on recursion depth.** Those are
  writer limits to fix, not design constraints to adopt.

### 4.4 When to turn on C++

When all of these hold:
- the C++ writer emits sums and heap-backed arrays, and the forward foundation tier compiles and
  passes the JSON witness suite;
- the library is green in C# on every witness through `06-mesh`;
- a consumer needs native code: a C++ host, CUDA, or a speed the C# build cannot reach.

Turn it on first as a differential backend: one more column in `MesherMatrix`, built with
`/fp:precise` (or `-ffp-contract=off`, or `--fmad=false`) so that a difference points at a bug and not
at a flag. It becomes a shipping target once that column agrees.

## 5. The precision question

### 5.1 What `Number` is now

binary32 in C#, C++, CUDA and GLSL; binary64 in TypeScript and Rust (section 2.1). `Integer` is 32-bit
in C#, C++ and GLSL and 64-bit in Rust; in TypeScript it is a binary64 value, exact up to 2^53.

### 5.2 What binary32 costs a B-rep

The ULP at magnitudes a building model reaches, with coordinates in millimetres:

| Coordinate | binary32 ULP | binary64 ULP |
|---|---|---|
| 1e5 mm (a 100 m building) | 0.0078 mm | 1.5e-11 mm |
| 1e7 mm (10 km from the origin) | 1 mm | 1.9e-9 mm |
| 1e8 mm (100 km) | 8 mm | 1.5e-8 mm |
| 5e9 mm (a UTM northing of 5,000 km) | 512 mm | 9.5e-7 mm |

For comparison, OpenCascade's default coincidence tolerance, `Precision::Confusion()`, is 1e-7 in
model units, usually millimetres. The existing mesher's one tolerance is 1e-6 m
(`EXISTING-MESHER-LESSONS.md`). Allow 64 ULPs for an evaluation chain such as a de Boor evaluation or
a projection. Then binary32 holds a 1e-3 mm tolerance only within 256 mm of the origin, while binary64
holds 1e-7 mm out to about 8 km and 1e-3 mm out to about 137,000 km. So binary64 is necessary. For
georeferenced coordinates it is still not sufficient: the kernel must evaluate relative to a local
origin. Lesson 1 of `EXISTING-MESHER-LESSONS.md` reached the same rule from the other direction.

### 5.3 The four options

| | A. 64-bit everywhere | B. `Double` beside a 32-bit `Number` | C. One width per compilation | D. Whatever the backend has |
|---|---|---|---|---|
| Laws | one truth | kernel laws hold; stdlib laws stay 32-bit | a law's truth is relative to the compilation's width; laws about rounding scale with `MachineEpsilon`; a library that needs 64 bits asserts it | a law can pass in TypeScript and fail in C# on the same input |
| Cross-backend determinism | one width everywhere, so basic operations agree | the kernel agrees; mixed code converts at every call | same width in both builds, so basic operations agree | none: 32-bit C# and 64-bit TypeScript give different meshes |
| GPU (GLSL, CUDA, WGSL) | GLSL ES (WebGL) and WGSL have no double, so those backends break; CUDA doubles run at about 1/64 of float speed on GeForce cards | fine | GPU compilations choose 32-bit | fine |
| Stdlib | source unchanged | every type over `Number` needs a twin: `Point3D`, `Vector3D`, `Frame3D`, `NumberInterval`, `Bounds3D`, `KnotVector`, `UvCoordinate`, `TriangleMesh3D`, about 20 of the names `VOCABULARY.md` reuses. The alternative is a stdlib generic over its scalar, which `plato-252` calls "a large, invasive library change". | source unchanged; a few float-tuned constants to check | unchanged, and `SEMANTICS.md` stays false |
| Toolkit interop | matches `StepParser`'s doubles and TypeScript's numbers; meshes convert to binary32, or to the int32 fixed-point geometry of the BOS (BIM Open Schema) format (`BimGeometry.cs:63`), at the boundary | the kernel matches; conversion at every kernel-to-stdlib call | CPU builds match; same boundary as A | C# narrows the doubles it is given |
| Cost | changes to the C# and C++ writers; gives up the bit-identical binary32 CPU and GPU math that gpu-accel needs (`plato-449`) | large, permanent duplication | as A, plus one setting and `MachineEpsilon` | nothing now; a fork in every result later |

### 5.4 Recommendation

**Option C, with binary64 as the default for CPU backends.** In practice this is option A for every
CPU backend plus an explicit binary32 profile for GPU backends. It keeps one stdlib, unlike B, and
keeps GLSL and CUDA possible, unlike A. One rule also settles both `plato-449` and this library's
need: TypeScript rounds to binary32 with `Math.fround` only in a binary32 compilation. The B-rep
library declares, by law, that it needs binary64.

The switch is compilation-wide, not per type. A GPU kernel that shares code with the library is
therefore a second compilation, with an explicit conversion at the boundary. The decision belongs in
`plato-271` (the precision decision record) and the work in `plato-370` (double scalars). Section 8
of `SEMANTICS.md` and the comment in `primitives.plato` change with it.

Integer width is a separate and smaller decision (section 6, question 4). This library needs only
that indices below 2^31 are exact and that nothing relies on overflow.

### 5.5 Laws to add, so precision is tested rather than assumed

In `00-foundation`:

```plato
// The unit roundoff of Number in this compilation: the smallest power of two e with 1 + e != 1.
// Computed with basic operations only, so it means the same thing in every backend.
MachineEpsilon(_: Number): Number
{
    var e = 1.0;
    while (1.0 + e * 0.5 != 1.0)
        e = e * 0.5;
    return e;
}

// This library needs binary64; the law fails in a binary32 compilation (2^-52 = 2.22e-16).
Law_NumberIsBinary64(_: Number): Boolean
    => Number.MachineEpsilon <= 2.3e-16;
```

In `02-topology`, where `Extent` is the largest absolute coordinate among vertices and control points,
measured from the model's local origin:

```plato
// The file's tolerance lies above the rounding floor of an evaluation at the model's extent.
// Severity Error; the diagnostic says to move the model to a local origin.
Law_ToleranceAboveRoundingFloor(m: BrepModel): Boolean
    => m.Tolerances.Length.Value >= 64.0 * Number.MachineEpsilon * m.Extent;
```

In `07-validation`, over witnesses moved far from the origin. `k` selects a witness and `e` an offset
of 10^e mm, for e from 0 to 8 (up to 100 km):

- `Law_FarVertexReevaluates(k: Integer, e: Integer)`: every vertex of the moved witness re-evaluates
  on each adjacent surface within `LengthTolerance`.
- `Law_TranslationPreservesTopology(k: Integer, e: Integer)`: meshing the moved witness gives the same
  triangles, quads, `ElementFace` and provenance tags as meshing the witness and then moving it, with
  positions within `LengthTolerance`. A failure means some decision was taken in global coordinates.
- `Law_MeshesAgree(a: ModelMesh, b: ModelMesh, t: Tolerances)`: equal counts, equal integer arrays,
  positions within `t.Length`. The cross-backend harness of section 3.8 supplies `a` and `b` from two
  backends, or from one backend run on two machines.

Two checks belong in the host harness, because one Plato compilation cannot express them:

- **Output quantization.** Positions converted to the viewer's binary32, or to the BOS int32 fixed
  point, relative to a stated origin, stay within `LengthTolerance` of the binary64 positions.
- **Number parsing.** Every STEP real parsed by the host tokenizer equals a reference, correctly
  rounded parse of the same text, over the whole test corpus.

## 6. Open questions for the owner

1. **Option C or option A?** One fact settles it: does any consumer need GPU code compiled together
   with stdlib vocabulary (gpu-accel, or the WGSL writer of `plato-451`)? If none does, A is simpler.
   If gpu-accel does, C is required.
2. **Who makes the C# width change, and when?** It is a Plato change that blocks the first
   implementation task. Settled by whether `plato-370` can be scheduled before TKT-299 moves past
   design. The list of edits is in section 4.1.
3. **Must a mesh be bit-identical across machines, or only within tolerance?** PROJECT.md principle 4
   pins every run input by content hash. If meshes become run evidence, a hash over positions breaks
   between Windows and Linux wherever a transcendental is involved. Settled by whether the toolkit will
   hash meshes, or only the inputs and the topology.
4. **`Integer` width.** It is 32-bit in C#, 64-bit in Rust and exact to 53 bits in TypeScript.
   Settled by the largest index the corpus needs. Snowdon has about 450,000 instances, far below 2^31;
   STEP instance numbers fit too, unless an exporter numbers sparsely above 2^31.
5. **One `Round`.** Fix the three behaviours of section 2.3 in the writers, or remove `Round(digits)`.
   Settled by whether any stdlib body a law depends on calls it.
6. **Which oracle for layer 1?** occt-import-js returns meshes only; pythonocc evaluates surfaces at
   (u, v). Settled by whether the closed-form oracles of `07-validation` cover the surfaces the corpus
   uses, or whether B-spline and offset surfaces need a reference evaluator.
   **Decided by the owner, 2026-10-17: neither; no OpenCascade dependency in the library or its
   tests.** B-spline and offset surfaces are checked by quadrature against the mesh at two
   refinement levels (`research/VALIDATION-MATH.md` section 5) and by the re-evaluation law, not by
   a reference evaluator.
7. **When should TypeScript become the second target?** Settled by whether STEP meshing on the public
   pages (workflow 1) comes before a C++ consumer. If it does, sum emission in the TypeScript writer
   moves ahead of the C++ work of section 3.8.
8. **Is the stale verification prose worth fixing now?** `VERIFICATION.md` says the geometry tier's C#
   does not compile; it is four defects away. The conformance README says the runner cannot build; it
   builds and passes when driven directly. Settled by whether the sandbox gate of section 4.2, step 2,
   replaces the studio driver script.

## 7. Sized types: a storage vocabulary beside `Number`, not a second arithmetic one

Added 2026-10-17 after the owner asked whether Plato needs explicitly sized scalars, as C++ has,
beside an implementation-dependent `Number` and `Integer`, for cases where layout and scale must be
predictable.

### 7.1 Where width and layout matter

The cases split in two.

- **Arithmetic inside algorithms.** Section 5 applies. The stdlib is written over `Number` and is not
  scalar-polymorphic (`plato-252` calls generalizing `Vector3` over its scalar "a large, invasive
  library change"). A `Number64` used in library bodies is option B of section 5.3 under another
  name: every type over `Number`, from `Point3D` to `TriangleMesh3D`, needs a twin or a conversion
  at every call. The arithmetic scalar stays `Number`, one width per compilation, guarded by
  `Law_NumberIsBinary64`.
- **Boundaries, where bytes have a fixed shape.** GLB vertex buffers are float32. BOS geometry is
  int32 fixed point (`BimGeometry.cs:63`). glTF indices are uint32. GPU uploads, JSON witnesses,
  content hashes and a Philox round (`plato-451`, gpu-accel) all need a width that does not move
  with the compilation. Today Plato cannot name these, which is why section 5.5 pushes output
  quantization and number parsing to the host harness.

### 7.2 Proposal

Add sized types as storage and boundary types, not as a second vocabulary.

- **A small set of primitives:** `Float32`, `Float64`, `Integer32`, `Integer64`, `Unsigned32`;
  `Unsigned64` only if hashing moves into Plato. Each costs every backend a name (`plato-365` keeps
  the primitive set small), so the set stops there.
- **No literal syntax.** A sized value is made from `Number` or `Integer` by an explicit conversion
  and read back the same way. Narrowing and widening are both explicit: in a 32-bit GPU compilation
  `Float64` to `Number` is the lossy direction. The explicit step is also what a law can name.
- **Arithmetic only where the width fixes the semantics:** wraparound on `Integer32` and
  `Unsigned32`, bitwise operations, comparison. No `IReal` arithmetic on `Float32` or `Float64`;
  computation happens in `Number`.
- **Containers fall out of the existing generics.** `Array<Float32>` and `Buffer<Float32>` need no
  new machinery. The wrapper-scalar decision
  (`tracker/decisions/2026-08-01-wrapper-scalars-are-the-only-representation.md`) already relies on
  a single-field struct being layout-sound to reinterpret, so a `Float32` wrapper over `float` is a
  free view onto a GPU or GLB buffer whatever width `Number` has.
- **A backend without a width reports the type unsupported**, as GLSL does for `String`. A GLSL
  build that touches `Float64` fails, which is the honest outcome.

### 7.3 What it buys this library

The two host-side checks of section 5.5 become Plato laws: quantization to `Float32`, or to BOS
fixed point relative to a stated origin, stays within `LengthTolerance`, written once and judged in
every backend. The `ModelMesh` that leaves the kernel declares its wire layout in its own type instead
of in C# marshalling code. Nothing in `01-geometry` through `06-mesh` changes.

### 7.4 Guards

- **Drift back to option B.** Once `Float64` exists, a kernel type will be written over it "to be
  safe". A rule in `SPEC-DSL.md` that sized types appear only in boundary records, and a lint for it,
  keeps the arithmetic scalar single.
- **`Integer` is the weaker contract.** It wraps at 32 bits in C#, is exact to 53 bits in TypeScript,
  and is 64 bits in Rust, so no law may touch overflow. Stating in `SEMANTICS.md` that `Integer` is
  at least 32 bits with unspecified overflow, beside sized types that do define wraparound, settles
  question 4 of section 6 without a width decision.

### 7.5 Rejected alternative: a field annotation

`X: Number @float32`, in the style of GLSL precision qualifiers, solves layout but hides the rounding,
since a read silently widens again. A type makes the conversion a visible step that a law can name.

### 7.6 Effect on TKT-299

None on the critical path. The compilation-width change in C# (section 4.1) still blocks the first
algorithm body. Sized types block only the quantization laws, which arrive with `06-mesh`. The
proposal is filed under `plato-271` in the Plato tracker.

## Sources for external claims

- occt-import-js: <https://www.npmjs.com/package/occt-import-js>; opencascade.js: <https://ocjs.org>;
  OCCSharp: <https://www.nuget.org/packages/OCCSharp/>; monstertruck: <https://docs.rs/monstertruck>;
  ruststep: <https://github.com/ricosjp/ruststep>; pythonocc-core: <https://github.com/tpaviot/pythonocc-core>;
  STEPcode: <https://github.com/stepcode/stepcode>.
- OCCT `Precision::Confusion()` is 1e-7: <https://dev.opencascade.org/content/precisionconfusion>.
- CsCheck (PCG-based generation and shrinking, seed replay): <https://www.nuget.org/packages/CsCheck/2.8.1>;
  FsCheck: <https://github.com/fscheck/FsCheck>; fast-check: <https://github.com/dubzzz/fast-check>;
  proptest: <https://github.com/proptest-rs/proptest>; RapidCheck: <https://github.com/emil-e/rapidcheck>.
- MSVC's contraction default changed in VS2022:
  <https://devblogs.microsoft.com/cppblog/the-fpcontract-flag-and-changes-to-fp-modes-in-vs2022/>.
- `nvcc` contracts by default (`--fmad`): <https://forums.developer.nvidia.com/t/fma/32965>.
- .NET `Math.FusedMultiplyAdd` semantics:
  <https://learn.microsoft.com/en-us/dotnet/api/system.math.fusedmultiplyadd>.
- JavaScript `Math.sin` is implementation-approximated and varies: <https://github.com/tc39/ecma262/pull/903>,
  <https://codeberg.org/perplexdotgg/bounce/issues/8>.
- Platform `sin` differs by an ULP between C runtimes: <https://codereview.chromium.org/380903002>,
  <https://forums.factorio.com/viewtopic.php?p=28794>.
- Rust float functions call the platform libm, and the `libm` crate is the portable route:
  <https://users.rust-lang.org/t/f64-ln-1p-platform-specific-behavior/77113>, <https://docs.rs/libm>.
- WebGL has no double precision: <https://wikis.khronos.org/webgl/WebGL_and_OpenGL_Differences>,
  <https://blog.hvidtfeldts.net/index.php/2012/07/double-precision-in-opengl-and-webgl/>. FP64 on
  consumer GPUs: <https://forums.developer.nvidia.com/t/weekend-project-fp64-emulation-on-consumer-grade-gpus/291205>.
- That GCC contracts by default in GNU modes comes from the GCC manual's "Optimize Options" and was not
  re-checked for this document.
