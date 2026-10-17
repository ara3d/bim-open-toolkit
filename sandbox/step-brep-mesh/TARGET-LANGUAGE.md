# First target language, and what `Number` means

Investigation for TKT-299 (this sandbox's STEP B-rep to mesh design). Version 2, 2026-10-17. The
first version asked which Plato backend works today; the owner rejected that framing (PLAN.md,
"Decided by the owner") and corrected it further while this version was being written: assume every
writer emits the full language (sum types and `match`, loops and builders, a 64-bit `Number`,
unbounded arrays, generics), and choose the first target and the order of the others purely by what
makes the **creation and validation** of the library efficient and what serves its users. The
`Number` question is likewise a question of language design: what `Number` should mean for Plato and
its users, not what is cheap to change.

So the first version's measurements of the writers are kept, as notes, in section 7, without effort
estimates, and they do not enter the recommendation. New measurements, of what the candidate
languages do once generated code compiles, are in section 3.

This document is the partner of [SPEC-EXECUTION.md](SPEC-EXECUTION.md), revised under the same
premise. That document designs the verifier: specifications in Plato, a TIR evaluator for the inner
loop, one orchestrator (`plato verify`, the Plato.Verify engine), choice-sequence generators, and thin
per-backend kernels. This one chooses the compiled backends that verifier drives and defines the
arithmetic they must agree on. Where the two differ, section 0 says so.

Evidence tags, as in SPEC-EXECUTION.md: **[R]** read in a named file; **[M]** measured for this
document (method stated); **[W]** an external source, numbered in "Sources"; **[J]** judgement, with
reasons. Plato is at commit `f6e02cf0` (`C:\Users\cdigg\git\plato`), unchanged. Measurements were
taken on the owner's machine: Intel Core Ultra 7 155H (22 logical processors), 64 GB, Windows 11;
.NET SDK 10.0.400 targeting net8.0 with Roslyn 4.11; Node 22.13.1 with esbuild 0.25.12 and
TypeScript 5.9.3; Rust 1.96.0; MSVC 14.44 (Visual Studio 2022). Other agent sessions were running
throughout, using about 20 % of the processor, so every time is a range over at least three runs, and
the low end is the better guide. Benchmark sources and logs are in the session scratchpad,
`...\scratchpad\target-language-v2\bench\`.

## 0. The answer in brief

**First target and order [J].**

1. **C# first.** It is where the library is debugged, where heavy validation runs, and where its
   first users live. Four reasons, none of them the writer's maturity today:
   - **The verifier, the compiler and the generated code are all .NET.** A warm verifier compiles a
     changed 150-module library to IL in 0.50 to 0.65 s against a prebuilt stdlib assembly [M], and
     runs it in a warm worker with no build tool, no new executable and no process start. No other
     backend gets a compiled verdict into an MCP tool result that cheaply.
   - **Its first consumers are C#:** the IFC MCP server, the flow host and its node packs, the
     IFC-to-BOS converter, and the comparison harness the existing mesher is tested in (section 3.5).
   - **Value types.** The same law over 2,000,000 triangles takes 109 to 111 ms in C# and 168 to
     207 ms in Node [M]. Rust is faster (80 to 89 ms), but rebuilds in 2.9 to 3.6 s after an edit and
     cannot map its code back to Plato lines.
   - **A failure points at Plato source.** `#line` spans put `.plato` lines into the debugger and
     into stack traces [W18]; array indexing is always checked.
2. **TypeScript beside it from day one, on every push.** It rebuilds the whole program in 0.5 to
   0.8 s [M], its consumers exist (the viewer, the 3D pane, the notebook, the public pages), and a
   second compiled semantics in the gate catches non-portable code the day it is written.
3. **Rust third**, nightly from the first numeric bodies of layer 1. It brings the strictest
   semantics by language rule, panics on out-of-range indexing (and, in debug builds, on integer
   overflow), the fastest corpus runs, and bounded model checking with Kani.
4. **C++ fourth**, nightly once `06-mesh` is green on C# and TypeScript, or as soon as a native
   consumer is named. Its floating-point meaning depends on compiler flags (measured: `/fp:contract`
   and `/fp:fast` change the bits), its cold builds are among the slowest, and nothing in the toolkit
   consumes it yet.
5. **One standing gate for all of them:** the same statements on the same choice sequences on every
   backend, verdicts and values compared **bitwise**. The precision design below is what makes bitwise
   comparison possible.

**What `Number` means [J].** `Number` is an abstract real, and a **profile**, chosen per
compilation and recorded in the output and in every run record, binds it to one exact arithmetic.
- **`cpu64`, the default**, makes `Number` IEEE 754 binary64 with correctly rounded basic operations,
  no contraction and no reassociation, and Plato's own correctly rounded elementary functions (`Sin`,
  `Atan2` and the rest). Every backend on every operating system then computes the same bits.
- **`gpu32`** is for shaders and **`cpu32`** for CPU twins of shader code.
- **A library states what it needs as a compile-time requirement** checked against the profile; for
  this library, `requires Number.ResolutionAt(1.0e8) <= 1.0e-6`. Stdlib laws check that each backend
  honours its profile.
- **`Integer`** holds the integers within ±(2^53 − 1) on CPU profiles. Leaving that range is a defect,
  trapped in checked builds. Sized types (`Float32`, `Unsigned32` and the rest) carry fixed widths at
  boundaries.

**What changed from the first version, and why.**

| | First version | This version | Why |
|---|---|---|---|
| The question | Which backend can run this design today | Which backend makes creating and validating the library fastest once every writer works | The owner's premise and correction |
| First target | C#, because it alone emits sums and `match` and has a law runner | C#, because verifier, compiler and code share one .NET process, its consumers are C#, it has value types, and it maps to `.plato` lines | The old reasons vanish under the premise; the new ones are measured or read |
| TypeScript | Second, "when STEP meshing is wanted on the public pages" | Beside C# from day one, every push | Cheapest build (0.5 s); browser consumers; a second semantics catches non-portable code early |
| C++ | To follow, after writer work | Fourth, behind Rust | Rust is stricter, faster and better tooled for validation; C++ results depend on flags (measured) |
| Transcendental functions | May differ by backend; positions compared within tolerance; only integer parts bitwise | Plato's own, correctly rounded; positions bitwise in `cpu64` across backends and machines | Measured: V8's `cos` and `sin` differ from the Windows C runtime's in the last bit, and that alone separated the results |
| `Number` | One width per compilation, binary64 default, binary32 GPU profile; `Law_NumberIsBinary64` | Profiles as a language feature that fix the whole arithmetic; library-level `requires`; profile conformance laws | A language-design question, not a cost question |
| `Integer` | A separate, smaller decision | Exact within ±(2^53 − 1), trapping outside; sized types for wraparound and bits | JavaScript is exact to 2^53 and BigInt is 14 times slower (measured); `Integer` to `Number` becomes exact |
| Measurements of the writers | The deciding constraint | Notes, section 7 | The owner's correction |

**Where this document differs from SPEC-EXECUTION.md** (each is an open question in section 6):
TypeScript on every push rather than nightly (its section 1.4); a 5 s rather than 30 s budget for
confirming one layer on compiled C# (its section 1.4); and the `Integer` range of section 5.6 rather
than 64-bit two's complement (its question 12).

## 1. Terms

- **Backend, writer.** A backend is a target language; its writer is the C# project under `writers/`
  that turns checked Plato into that language.
- **Evaluator.** The TIR interpreter that SPEC-EXECUTION.md (D4) adds to the compiler: Plato's
  definitional semantics, and the engine of the inner loop. TIR is Plato's typed intermediate
  representation.
- **Verification build, kernel, checked build.** A verification build is a backend's compiled program
  that answers the orchestrator's JSON requests (`manifest`, `run`, `call`); its request handler is
  the kernel. A checked build adds the writer's own checks of index ranges, `Integer` range,
  invariants and contracts. All three are defined in SPEC-EXECUTION.md sections 1 and 5.
- **Choice sequence.** The list of integers a generator consumes; a counterexample is a generator
  name plus a choice sequence, and shrinking shortens the sequence (SPEC-EXECUTION.md 2.8).
- **Profile.** A compilation-wide binding of `Number` and `Integer` to one exact arithmetic, with its
  rounding, contraction, evaluation-order and elementary-function rules (section 5.4).
- **binary32, binary64.** IEEE 754 single and double precision, with 24-bit and 53-bit significands.
- **ULP** (unit in the last place). The gap between adjacent representable numbers near a value.
  **Unit roundoff** `u` is half the ULP of 1: 2^-53 in binary64, 2^-24 in binary32.
- **Correctly rounded.** The result is the exact mathematical value rounded once to the format.
  There is then exactly one right answer, so two correct implementations agree bit for bit.
- **Contraction.** A compiler fusing `a * b + c` into one fused multiply-add (FMA), which rounds once
  instead of twice and changes the last bits.
- **Elementary function.** `Sin`, `Cos`, `Tan`, `Asin`, `Acos`, `Atan2`, `Exp`, `Log`, `Pow`.
  `Sqrt` is not one here: IEEE 754 requires it correctly rounded.
- **Bitwise conformance.** Two backends agree when every compared value has the same bit pattern.
- **Inner loop.** Edit, check, generate, build, run laws and tests, read a counterexample, see the
  mesh.

## 2. The target experience

Two actors run the loop. The **author** is a person in Visual Studio (the `visualstudio-plato`
extension) or VS Code (`vscode-plato`). The **implementing agent** is Claude in Claude Code, working
through the MCP tools `plato_check` and `plato_verify` (SPEC-EXECUTION.md 7.2) and the viewer's MCP
bridge. Steps 1, 2 and 7 below are SPEC-EXECUTION.md's loop and are the same for every backend; this
document adds the compiled backend, the picture and the debugger.

### 2.1 The loop, with budgets per backend

The task is the one SPEC-EXECUTION.md 1.3 uses: implement `Discretize` in `04-discretization`.
Budgets are for a warm session; the measured basis of each is in section 3.1.

| # | Step | Command (MCP tool) | C# | TypeScript | Rust | C++ |
|---|---|---|---|---|---|---|
| 1 | Check the edit | `plato check --changed` (`plato_check`) | 2 s, the front end, the same for every backend | | | |
| 2 | Verify on the evaluator | `plato verify --changed` (`plato_verify`) | 10 s, the same for every backend | | | |
| 3 | Generate the changed layer | inside step 4 | 1 s, the writer over one layer in the warm compiler | 1 s | 1 s | 1 s |
| 4 | Build | inside step 6 | 0.50 to 0.65 s: Roslyn in the warm verifier, against a prebuilt stdlib assembly | 0.49 to 0.79 s: esbuild over the whole program; no type check, since Plato has checked | 2.9 to 3.6 s: `cargo build` of the library crate | 2.9 to 5.4 s: one translation unit and a link, the compiler environment already set |
| 5 | Start | inside step 6 | none: load into a warm worker's collectible assembly context; only new code is JIT-compiled | 0.57 to 0.76 s per Node process, or a warm worker | 0.1 to 0.9 s, plus 0.6 to 2.3 s on the first run of a newly linked executable | 0.2 s, plus the same first-run delay |
| 6 | Confirm the layer on compiled code | `plato verify 04-discretization --backends cs` | **5 s** | **5 s** | **10 s** | **10 s** |
| 7 | Read the counterexample | the tool result | The JSON of SPEC-EXECUTION.md 1.3, the same for every backend: choice sequence, shrunk, explained, blamed, with a replay command | | | |
| 8 | See the mesh | `plato verify --replay <id> --dump`, then the viewer | 5 s for every backend: the dump of 2.3, opened in the viewer, captured as a picture | | | |
| 9 | Step through | `plato verify --replay <id> --backend <b> --debug` | Visual Studio stops at the failing clause in the `.plato` file (`#line`) | VS Code or Chrome DevTools stop at the same line (source map) | The debugger stops in generated `.rs` | Visual Studio stops in the `.plato` file (`#line`) |

The C# budget of step 6 is 5 s where SPEC-EXECUTION.md 1.4 sets 30 s. The measurements of 3.1 put
the build and the start under 1.5 s for C# and TypeScript, which leaves the rest of the budget for
running cases. Code under test runs in a worker process, not in the verifier: a stack overflow ends
a .NET process and cannot be caught, and Plato allows recursion.

### 2.2 The two loops in practice

**The agent.** It edits `Discretize` and calls `plato_check` (2 s), then `plato_verify` with
`function: "Discretize"` on the evaluator (10 s), and fixes what the explained counterexample shows.
When the evaluator is green, it calls `plato_verify` with `backends: ["cs", "ts"]` (5 s each).
- **A topological failure** (a count, an index, an orientation) is read from the JSON alone.
- **A geometric failure** (a sagitta above the chordal bound) gets a picture. The agent replays the
  case with `--dump`, opens the dump through the viewer's MCP tools (`@bim-open-viewer/mcp`, which
  exposes the viewer's commands as tools over a browser session [R]), and looks at a capture: the
  offending segment is highlighted beside the exact curve's samples.
- The agent seldom needs a debugger. The explanation trace (the value of every subexpression of the
  failing clause, SPEC-EXECUTION.md 1.1) covers most cases; the rest go to the person.

**The author.** Saving runs the check, and a command runs the verifier. On a failure the author
presses F5 on the replay. The C# verification build starts under the debugger, stops at the failing
clause's line in `discretization.library.plato`, and shows the generated types' values in the watch
window. The same replay with `--backend ts` does the same in VS Code.

For a person poking at one mesh, a TypeScript variant goes further. A viewer page runs the layer's
laws in the browser and redraws after every rebuild (0.5 s), with no file in between.

### 2.3 Seeing a wrong mesh, the same way on every backend

The display is the toolkit's viewer, whatever the backend: `@bim-open-viewer/formats` already reads
GLB [R], and the studio's 3D pane can show the same file. Every backend's harness writes the same two
files on `--dump`.

- `<case>.glb` holds the mesh:
  - positions as `Float32` relative to a stated origin; the quantization law of 5.7 bounds the error;
  - indices as `Unsigned32`;
  - failing elements in a separate primitive, so the viewer's per-instance colour picks them out;
  - for each element, the model face or edge it came from (its provenance) in the primitive's extras;
  - the exact model's sample points along the failing edge or face.
- `<case>.checks.json` holds every failed check: the law, its worst measure, the bound, and the
  provenance.

The arrays are built by Plato code, using the sized types of 5.7, so every backend writes the same
bytes. The host writes only the file.

## 3. Criteria weighed on the long-run premise

### 3.1 Build and run speed

**Method [M].** The C++, Rust and TypeScript writers cannot yet compile the stdlib (section 7). So
build times were measured on a synthetic stand-in, emitted in all four languages by one script
(`bench/gen.py`). The script writes 750 modules, each containing:
- a three-field value type with thirteen methods;
- a four-case sum type with a `match`;
- a loop over an array;
- a generic map with a lambda;
- one law;
- a reference to the next module's type.

750 matches the 751 files of the real C# output for the foundation and geometry tiers. The line
counts fall between the real TypeScript output (43,592 lines) and half the real C# output (95,963
lines, which carries more attributes per type).

**A whole program, edited in one module.**

| Backend and route | Lines, files | Cold build | Rebuild after editing one module | Start and run |
|---|---|---|---|---|
| C#, `dotnet build` | 48,760, 751 | 9.8 s | 3.7 to 18.2 s | 2.4 to 2.8 s, most of it JIT-compiling everything |
| C#, Roslyn in a warm process | the same | 3.0 to 3.5 s to bind and emit, after 0.25 to 0.40 s to parse | 2.0 to 2.7 s | |
| TypeScript, esbuild bundle | 39,752, 751 | 0.49 to 0.79 s (3.2 s on the first, cold run) | the same: it rebuilds everything | 0.57 to 0.76 s in Node in four of six runs; 1.3 and 2.9 s in two |
| TypeScript, `tsc --noEmit` (full type check) | the same | 3.7 to 11.6 s | | |
| Rust, `cargo build` (debug), one crate | 38,254, 752 | 29.5 s | 9.2 to 20.3 s | 0.3 to 0.8 s |
| C++, MSVC `/Od /Zi /MP`, one translation unit per module | 66,006, 1,501 | 52.8 s (42.5 s compile, 10.3 s link) | 2.9 to 5.4 s (1.4 to 1.9 s compile, 1.3 to 4.0 s link) | 0.2 s |
| C++, MSVC, one unity translation unit | the same | 38.5 s | everything | |

**The inner loop's real shape: a prebuilt stdlib and an edited library.** The same code split into
600 "stdlib" modules and 150 "library" modules that use them:

| Backend and route | Cold build | Rebuild after editing one library module | Start and run |
|---|---|---|---|
| C#, `dotnet build` of the library project | 12.7 s | 4.4 to 11.4 s | 0.80 to 0.87 s |
| C#, Roslyn in a warm process, library only (9,760 lines) against the stdlib DLL | 0.94 to 1.0 s | **0.50 to 0.65 s** | |
| Rust, a workspace of a stdlib crate and a library crate | 107.7 s (under load) | **2.9 to 3.6 s** in four of six runs; 13.5 and 31.1 s in two runs taken while other sessions were building | 0.1 to 1.1 s |

**Real generated code.** The foundation tier as C# (295 files, 33,471 lines with the intrinsics),
compiled by Roslyn in a warm process: 2.4 to 3.0 s to bind and emit (4.2 s the first time), and 1.4
to 1.9 s after editing `_Point3D.g.cs` [M]. Binding cost grows with what is compiled, which is why
the stdlib must be a prebuilt assembly and only the library recompiled.

**Throughput of a law.** A Gauss-Bonnet check over a 1,000 by 1,000 torus grid (1,000,000 vertices,
2,000,000 triangles): the sum of angle defects and the total area, written in each language as
generated code is written, with a value type with methods and three runs per build [M]:

| Build | ms |
|---|---|
| Rust, release | 80 to 89 |
| C#, .NET 8, Release | 109 to 111 |
| C++, MSVC `/O2 /fp:precise` | 120 to 149 |
| JavaScript, Node 22.13.1 | 168 to 207 |
| Rust, debug | 369 |
| C#, Debug | 974 |
| C++, MSVC `/Od` | 1,085 |

What these numbers say [J]:

- **For a library-sized edit, C# in-process and TypeScript build in under a second; Rust takes about
  3 s; C++ about 3 to 6 s plus its environment** (`vcvars64.bat` alone took 3.6 to 10.3 s per
  call). Cold builds differ more (C# 10 to 13 s, TypeScript under 1 s, Rust 30 to 108 s, C++ 39 to
  53 s), which matters in CI, not in the loop.
- **The in-process route is what makes C# fast.** Through MSBuild the same edit costs 4 to 18 s, and
  `dotnet test` adds about half a second per run over a test executable [W25]. A fresh .NET process
  also JIT-compiles everything it touches (2.4 to 2.8 s for 750 modules), which a warm worker avoids.
- **Rust's rebuilds are a known cost:** in the Rust project's 2025 survey, 55 % of respondents waited
  more than 10 s for a rebuild [W24].
- **Generated TypeScript needs no type check in the loop:** `tsc` (3.7 to 11.6 s) re-checks what
  Plato has checked. TypeScript 7's native compiler claims 8 to 12 times faster checking, which
  helps CI [W23].
- **Native executables paid a first-run delay after each relink:** 0.6 to 2.3 s for Rust, 6.5 s once
  for C++, against 0.1 to 0.9 s on later runs. The likely cause is an on-access malware scan of a new
  file; not confirmed.
- **Verification builds must be optimized builds with the writer's checks added.** Unoptimized builds
  were 4 to 10 times slower (C# Debug 974 ms against Release 110 ms). Debug builds are for stepping
  only. JavaScript has one build for both.
- **Throughput ranks Rust, C#, C++ (with precise flags), then Node.** The gap from C# to Node, 1.5 to
  1.9 times, is the cost of allocating an object for every point.

### 3.2 Debugging a wrong mesh

| | C# | TypeScript | Rust | C++ |
|---|---|---|---|---|
| Map generated code to `.plato` | `#line (l, c) - (l, c) "file"` spans. The documentation says DSLs typically use this form; Razor uses it, and the spans become the PDB's sequence points [W18] | Source maps, standardized as ECMA-426 in 2024; the `names` field maps identifiers [W19] | Nothing: three pre-RFCs since 2017, none accepted [W21] | `#line`, which GCC documents as being for "compiler error messages and symbolic debuggers" [W20] |
| Breakpoints and stepping in `.plato` | Visual Studio (Razor's route); Rider and VS Code not confirmed | VS Code and Chrome DevTools [W19] | In the generated `.rs` only | Visual Studio and gdb, through `#line` |
| Where a crash outside the checks is reported | The `.plato` line, through the PDB | The `.plato` line, with `node --enable-source-maps` | The `.rs` line | Nowhere without a debugger |
| Showing a mesh | GLB through SharpGLTF, as the toolkit already does (`deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Gltf/BosGlb.cs`) | three.js in the same runtime, or GLB | GLB; the Rerun logging SDK (Rust, C++ and Python) [W22] | GLB; Polyscope (C++, Python) or Rerun [W22] |

No writer emits `#line` or source maps today [M, a search of `writers/`]; under the premise they do.
The evaluator's explanation trace answers most "why did this fail" questions with no debugger at all,
so the debugger is for the rest: loops over many elements, a wrong branch deep in a call. **Verdict:
C# and TypeScript tie; C++ is close; Rust is behind, for want of source mapping.** The picture is the
same everywhere, because the dump of 2.3 goes to one viewer.

### 3.3 Property testing and shrinking

| Library | Language | Shrinking | Replay | Saved failures | Latest release |
|---|---|---|---|---|---|
| CsCheck | C# | From the PCG seed, no shrink tree; parallel; model-based and metamorphic samplers [W1] | Seed string or `CsCheck_Seed` | No | 4.9.1, 2026-09-17 |
| Hedgehog | .NET | Integrated with generators, "preserves invariants by construction" [W3] | Seed | Not confirmed | 2.0.0, 2025-12-08 |
| FsCheck | .NET | Type-based, through the Arbitrary [W2] | Seed pair | Not confirmed | 3.4.0, 2026-08-20 |
| fast-check | TypeScript | Integrated per arbitrary; model-based testing [W4] | Seed and path | Not documented | 4.10.2, 2026-09-19 |
| Hegel | Rust, TypeScript, C++, Go, Java, OCaml | Hypothesis's engine, now native (libhegel, a C API) [W6] | Example database | Yes | 0.50.1, 2026-10-16; no .NET binding |
| proptest | Rust | Per strategy, respecting its constraints [W5] | Seed | Regression files, meant to be committed [W5] | 1.12.0, 2026-10-10 |
| RapidCheck | C++ | Not confirmed | `reproduce` string [W7] | No | No tagged releases; commits in 2026-10 |
| FuzzTest | C++ | Coverage-guided fuzzing of property tests [W8] | Reproducer files | Corpus | Linux and Clang only |

**Verdict: this criterion barely separates the candidates.** SPEC-EXECUTION.md puts generation and
shrinking in Plato itself. Generators are Plato code over choice sequences, and Plato.Verify shrinks
the sequence: the internal reduction of MacIver and Donaldson [W9]. So the laws use none of these
libraries, and a counterexample replays on any backend. The libraries matter only for host-boundary
code, such as the Part 21 tokenizer and file reading. There Rust (proptest with saved regressions,
Hegel, and Kani for bounded proofs [W29]) and TypeScript (fast-check, Hegel) are better served than C#
(CsCheck). Hegel's engine, with its C API, is a candidate for the shrinking core of Plato.Verify
itself, through P/Invoke; that is SPEC-EXECUTION.md's decision.

### 3.4 Floating-point determinism

**Measured [M].**
- **Basic operations agree on all four backends.** The synthetic program (basic operations and `Sqrt`
  only) printed 4651.252008915035 in C#, Node, Rust and C++ `/Od`.
- **The torus law did not.** Positions there come from `Cos` and `Sin`, and angles from `Acos`:

| Build | Sum of angle defects | Total area |
|---|---|---|
| C# Release and Debug; Rust release and debug; C++ `/O2 /fp:precise` and `/Od` | −2.454720871014615e−10 | 118.4345709514878 |
| C++ `/O2 /fp:precise /fp:contract /arch:AVX2` | −2.4917579111161103e−10 | 118.4345709514878 |
| C++ `/O2 /fp:fast /arch:AVX2` | −2.4062796200041703e−10 | 118.43457095149176 |
| Node 22.13.1 | −2.4983748403428763e−10 | 118.43457095148784 |

**Why the results split [J].**
- **C#, Rust and C++ with precise flags agree** because on Windows all three call the same C runtime
  for `cos`, `sin` and `acos`.
- **Node uses V8's own library.** It differs in the last bit of some positions, which moves the area
  by one ULP and the defect sum by 2 %. The defect sum is a residue of a million cancelling terms, so a
  last-bit change in its inputs moves it by that much.
- **On the C++ side, contraction and fast-math each change the result.** Every verdict agrees: all
  defect sums are within 2.5e−10 of the theorem's 0. Every bitwise comparison of values fails.

**What each language promises:**

| | Basic operations | Contraction | Elementary functions |
|---|---|---|---|
| JavaScript | Each operation rounded once to binary64, ties to even, by the specification's definitions (section 6.1.6.1) [W10] | Excluded by those definitions; my reading, as the specification has no explicit rule | "Implementation-approximated" [W10]. V8 bundles its own: an fdlibm port in 2014, glibc's `sin` and `cos` about 2023, LLVM's libm from 2026 [W11]. So one V8 build gives the same results on every OS, and different V8 versions do not. |
| C# | ECMA-335 I.12.1.3 lets values carry extra internal precision [W12]; RyuJIT on x64 and ARM64 computes in binary64 | A request for implicit FMA was declined as "not a safe/legal optimization to do by default" [W13]; none measured | `Math.Sin` calls the C runtime and "may differ between different operating systems or architectures" [W14] |
| Rust | RFC 3514: basic operations exactly as IEEE 754; NaN payloads nondeterministic [W16] | Precluded [W16] | `f64::sin`'s precision is "non-deterministic" and varies by platform and Rust version [W16] |
| C++ | IEEE when the flags allow | GCC: `fast` outside ISO C modes; Clang 14 and later: `on` (within a statement) by default; MSVC in Visual Studio 2022: none under `/fp:precise` [W15] | The platform's library. MSVC 14.52 adds an experimental LLVM-libc `<cmath>` under `/Zc:cmath` [W17] |

**What follows [J].**
1. **Basic operations are already portable bit for bit**, once C++'s flags are pinned.
2. **Elementary functions are the only remaining source of difference.** No language's standard
   library guarantees them, and the libraries differ across engines, operating systems and versions.
3. **So bitwise agreement across backends and machines needs Plato's own elementary functions**
   (section 5.8). With them, the comparator of 4.5 can compare positions bitwise, and the first
   version's rule, "only integer parts bitwise, positions within tolerance", is needed only in a
   profile that uses the host's functions.
4. **Determinism then does not separate C#, TypeScript and Rust.** C++ is behind only in that its
   meaning lives in build flags, which the writer must pin.

### 3.5 Interop with the toolkit's consumers

| Consumer | Language | How it gets the library |
|---|---|---|
| `BimOpenMcp.Ifc`, the IFC MCP server (`ifc_mesh`, `ifc_export_glb`, `ifc_meshing_diagnostics`) | C# | The C# backend, in process |
| The flow host, the flow MCP server, and the studio's `Geometry` node pack (`src/flow/BimOpenFlow.Nodes.Geometry`) | C# | The C# backend |
| The IFC-to-BOS converter and BOS geometry, int32 fixed point (`BimGeometry.cs:63`) | C# | The C# backend, quantized by the law of 5.7 |
| `Ara3D.Ifc.Mesher` and the comparison harness `deps/bim-open-data/tests/data/Ara3D.IfcMeshingComparison` (`IMeshingBackend`, `MesherMatrix`, `DumpBackend`) | C# | The C# backend. IFC4's advanced B-rep entities are adapted from ISO 10303-42, so once an IFC decoder feeds the kernel, this library becomes one more column in that matrix |
| The viewer (`deps/bim-open-viewer`, three.js), the 3D pane, the notebook, the public pages | TypeScript | GLB or BOS produced by C#; or the TypeScript backend, to mesh STEP in the browser with nothing installed (PROJECT.md workflow 1) |
| gpu-accel (WGSL kernels and TypeScript twins) | WGSL, TypeScript | The stdlib's vector math under `gpu32` and `cpu32`, not this library |
| A native host, CUDA | C++ | The C++ backend; none is named today |

**Verdict [J]:** Plato makes a foreign-function layer unnecessary, because each consumer gets the
library in its own language. Without Plato, the browser would take a native core through WebAssembly,
or C# through the .NET WebAssembly runtime, about 0.8 MB compressed for a trimmed application by one
secondary source [W28]. That is the strongest argument against choosing a native core first. The
consumers come in the order C# (the agent-facing workflows 2 and 3 run through C# servers), then
TypeScript (workflows 1 and 3 in the browser), then native code.

### 3.6 Feedback to an agent

| When something goes wrong outside the writer's checks | C# | TypeScript | Rust | C++ |
|---|---|---|---|---|
| Index out of range, release build | An exception with a stack trace [W26] | `undefined`, which becomes `NaN` later [W26] | A panic naming the index and length, in every build [W26] | Undefined behaviour [W26]; AddressSanitizer in MSVC catches it [W26] |
| Integer overflow | Wraps unless `CheckForOverflowUnderflow` is set (it defaults to false) [W26] | Loses exactness above 2^53, silently | Panics in debug builds [W26] | Undefined behaviour for signed types |
| Where it is reported | `.plato` line (PDB) | `.plato` line (source map) | `.rs` line | Not at all without a debugger |
| How the verdict reaches the agent | In the verifier's process | Through the JSON kernel | Through the JSON kernel | Through the JSON kernel |

In checked builds the writer emits the same checks in every backend, so the first two rows matter
only for release builds and for faults the checks do not cover. **Verdict: C# and TypeScript report
the most useful location, Rust the strictest native checks, C++ the least.** The verifier's own
report is identical for every backend (SPEC-EXECUTION.md 1.3).

### 3.7 The cost of keeping every backend green

- **CI minutes are not the constraint.** GitHub-hosted runners cost $0.006 a minute on Linux, $0.010 on
  Windows and $0.062 on macOS [W27]. A nightly hour across four backends on Linux is $0.36. Cold
  builds measured here: C# 10 to 13 s, TypeScript under 1 s, Rust 30 to 108 s, C++ 39 to 53 s, on 22
  threads; a two-core runner is slower. sccache caches Rust and MSVC compilations, except incremental
  crates [W27].
- **Triage is the cost.** Each disagreement needs someone to find its cause. The design keeps that
  small in three ways:
  - comparison is bitwise in `cpu64`, so there is no tolerance to argue about;
  - the orchestrator reports the first TIR node whose value differs (SPEC-EXECUTION.md 5);
  - a backend joins only after passing the readiness test of 4.4.
- **Measure each backend's worth.** Keep a ledger of the defects each backend found that no other
  did, and lower a backend's cadence when its column stays empty for a release cycle. The owner asks
  for this of every checker.

### 3.8 Scorecard

| Criterion | C# | TypeScript | Rust | C++ |
|---|---|---|---|---|
| Compiled confirmation in the loop | **0.5 to 0.65 s** in the verifier's process | **0.5 to 0.8 s** bundle, 0.6 s start | 2.9 to 3.6 s | 2.9 to 5.4 s and an environment |
| Throughput (torus law) | 110 ms | 168 to 207 ms | **80 to 89 ms** | 120 to 149 ms |
| Debugging at the `.plato` line | **yes** | **yes** | no | yes |
| Seeing the mesh | dump, viewer | dump, viewer, **live in the page** | dump, viewer, Rerun | dump, viewer, Polyscope |
| Property testing for host code | CsCheck, Hedgehog | fast-check, Hegel | **proptest, Hegel, Kani** | FuzzTest (Linux), Hegel |
| Basic-operation determinism | by implementation (measured) | **by specification** | **by specification** | by flags (measured) |
| Native runtime checks | indexing; overflow by a switch | none | **indexing; overflow in debug** | none without sanitizers |
| Consumers in the toolkit | **MCP servers, host, BOS, mesher harness** | **viewer, pane, notebook, pages** | none | none |
| Cold build in CI | 10 to 13 s | **under 1 s** | 30 to 108 s | 39 to 53 s |

## 4. Recommendation and schedule

### 4.1 First target: C#

**The recommendation is still C#, for different reasons.** The first version chose it because its
writer alone could emit this design and its law runner alone worked. Under the premise those reasons
are gone. Three new ones decide it, and a fourth supports them (sections 3.1 to 3.6):
- **Compiled verdicts in the verifier's own process.** 0.50 to 0.65 s to recompile the library,
  with no process start.
- **The first users are C#.**
- **Value types.** 1.5 to 1.9 times Node's throughput at the same code shape.
- **Supporting: debugging and stack traces at `.plato` lines.**

Conditions that make the choice pay:
- **Run verification builds optimized, with the writer's checks.** Debug builds only for stepping; they
  are 9 times slower.
- **Compile in the warm verifier, execute in a warm worker process** that loads each new assembly into
  a collectible `AssemblyLoadContext` and is restarted when a case kills it.
- **Keep the stdlib a prebuilt assembly per profile,** so an edit recompiles only the library.

What would change the answer:
- **A fast evaluator.** If it runs within about 20 times of C#, heavy runs can stay on it and the
  first compiled target matters less. Consumers and debugging would still favour C#.
- **STEP meshing in the browser as the first deliverable.** Then TypeScript comes first.
- **A named C++ consumer.** That moves C++ ahead of Rust, not ahead of C#.

### 4.2 TypeScript from day one

TypeScript is not a later port. It joins the gate with C#:
- **It adds a second compiled semantics** on a different engine, which is what catches code that
  leans on something the profile does not define.
- **It serves the browser consumers.**
- **It costs least in CI.**

Its weaknesses are known and bounded:
- 1.5 to 1.9 times slower than C#, because it allocates an object per point;
- out-of-range reads that return `undefined`, which the checked build must turn into failures;
- `Integer` as a JavaScript number, which the range of 5.6 makes exact.

For Node to run the output with no transform step, the writer must emit erasable syntax only: no
parameter properties, namespaces or enums [W23]. Today's output uses parameter properties, and Node's
type stripping rejects it (section 7.3).

### 4.3 Rust third, C++ fourth

- **Rust's role is the strict, fast checker.**
  - **Language rules:** basic operations are IEEE and contraction is precluded by the language, not by
    flags.
  - **Native checks:** indexing panics in every build, and integer overflow in debug builds, as a
    second net under the writer's checks.
  - **Speed:** the fastest corpus runs.
  - **Proof:** Kani proves properties of the generated code for all inputs up to a bound [W29]. That
    suits the index-level laws, though Kani approximates `sin` and `cos` [W29].
  - **Cost:** about 3 s per rebuild, and stepping in generated code.
- **C++'s role is the native consumer:** a C++ host, CUDA kernels sharing code with the CPU build,
  Polyscope for a person inspecting meshes. It follows Rust because, for validation, it adds nothing
  Rust lacks, and its arithmetic depends on flags the writer must pin.

### 4.4 What a backend provides to join the gate

Under the premise the writer emits the whole language. What remains per backend is this list, built
in parallel with the library so that each backend is ready when its trigger in 4.6 fires.

1. **A verification kernel** that answers SPEC-EXECUTION.md 5's JSON protocol (`manifest`, `run`,
   `call`), with the generators compiled in.
2. **A checked build:** index range, the `Integer` range of 5.6, invariants and contracts, each
   failure reported with its `.plato` location.
3. **The `cpu64` profile exactly:**
   - binary64 arithmetic;
   - no contraction (C++: `/fp:precise`, `-ffp-contract=off`, no fast-math [W15]; `nvcc --fmad=false`
     for CUDA, which contracts by default [W32]);
   - Plato's elementary functions;
   - left-to-right evaluation;
   - numbers that round-trip exactly through JSON.
4. **Source mapping where the language allows it:** `#line` in C# and C++, source maps in TypeScript.
   Rust has no mechanism.
5. **The mesh dump of 2.3.**

**The test that admits a backend:** `plato verify 00-foundation --backends eval,<b>` reports a status
for every statement, and every compared value agrees bitwise with the evaluator on every case. This is
milestone M1's item 3 in SPEC-EXECUTION.md 7.4, applied to each backend.

### 4.5 The cross-backend conformance gate

This is the standing gate, built on SPEC-EXECUTION.md section 5 (one orchestrator, thin kernels).

- **Inputs.** Every statement (law, contract, invariant) runs on the same witnesses and the same
  choice sequences on every backend.
- **What is compared.**
  - Verdicts, on every case.
  - Integers, Booleans, tags and indices, bitwise.
  - Numbers, bitwise under `cpu64`; within a per-function envelope under `cpu64-host`.
  - Pipeline output: mesh integer arrays and positions, by content hash.
- **Machines.** C# runs nightly on Windows and Linux as well, because `cpu64` claims the same bits on
  every operating system, and that claim is what makes a mesh hash usable as run evidence.
- **Failure.** Any disagreement fails the gate, and the report names the first TIR node whose value
  differs.
  - **One backend differs from the evaluator and the rest:** that backend's writer has a defect.
  - **Every compiled backend agrees and the evaluator differs:** the evaluator has a defect.
  - **Under `cpu64-host`, a verdict differs between backends:** a decision depends on the host's last
    bits, which 4.7 forbids, so the library is fixed. Under `cpu64` this case cannot arise.

### 4.6 Schedule and triggers

| When (library milestone) | In the gate, cadence | What lands |
|---|---|---|
| Now, before the first body | evaluator; C# and TypeScript kernels | The profile conformance laws of 5.5; portable `Atan2`, the one elementary function `00-foundation` reaches, through `AngleBetweenDirections`; the dump format of 2.3 |
| M1: `00-foundation` in the new syntax (SPEC-EXECUTION.md 7.4) | evaluator, C#, TypeScript, **every push** | Bitwise agreement of all three on every statement |
| First numeric bodies of `01-geometry` | **+ Rust, nightly** | Portable `Sin`, `Cos`, `Tan`, `Asin`, `Acos`, `Pow`; the Rust kernel; the far-from-origin generators; Kani on the index-level laws of `02-topology` |
| M2: `Discretize` implemented (`04-discretization`) | as above | Mesh dumps in the viewer; C# runs over the witness corpus and the public STEP files |
| `06-mesh` green on C# and TypeScript, or a native consumer named | **+ C++, nightly**; C# also on Linux nightly | Pipeline mesh hashes compared across backends and operating systems |
| M3: release conformance, layers 0 to 6 | all four at every release | The report of SPEC-EXECUTION.md 1.4, committed with the release |

A backend moves to every push when its ledger shows a defect the others missed. It moves to release
only when its column has stayed empty for a release cycle.

### 4.7 Rules that keep the library portable from the first day

- **Every algorithm body is Plato.** Host code is allowed only at a listed boundary: Part 21
  tokenizing, file bytes, timing. List the boundary in one file; it is the work each new backend
  must supply.
- **No interface-typed fields, and no lambdas stored in data** (PLATO-PRIMER.md D.3).
- **Decisions that choose topology use only basic operations and comparisons, or a robust
  predicate,** never an elementary function. SPEC-EXECUTION.md 2.9's branch-stability report finds
  the exceptions.
- **No `Round(digits)` and no `Number.Epsilon` as a tolerance** until 5.9 lands; both mean different
  things in different backends today (7.3).
- **Witnesses and results serialize exactly:** hexadecimal floats or 17 significant digits, with
  explicit NaN, infinities and −0.
- **No reliance on a capacity limit, string length or recursion depth.**

## 5. What `Number` means

### 5.1 What binary32 costs a B-rep

The ULP at magnitudes a building model reaches, with coordinates in millimetres:

| Coordinate | binary32 ULP | binary64 ULP |
|---|---|---|
| 1e5 mm (a 100 m building) | 0.0078 mm | 1.5e-11 mm |
| 1e7 mm (10 km from the origin) | 1 mm | 1.9e-9 mm |
| 1e8 mm (100 km) | 8 mm | 1.5e-8 mm |
| 5e9 mm (a UTM northing of 5,000 km) | 512 mm | 9.5e-7 mm |

For comparison, OpenCascade's coincidence tolerance, `Precision::Confusion()`, is 1e-7 model units
[W30], and the existing mesher's single tolerance is 1e-6 m (`research/EXISTING-MESHER-LESSONS.md`).
Allow 64 ULPs for an evaluation chain such as a de Boor evaluation or a projection:
- **binary32** holds a 1e-3 mm tolerance only within 256 mm of the origin;
- **binary64** holds 1e-7 mm out to about 8 km, and 1e-3 mm out to about 137,000 km.

So this library needs binary64. Georeferenced coordinates also need evaluation relative to a local
origin.

### 5.2 The options, re-examined

| | A. binary64 everywhere | B. a second scalar type beside `Number` | C. one arithmetic per compilation (profiles) | D. whatever the backend has | E. a stdlib generic over its scalar |
|---|---|---|---|---|---|
| Meaning of a program | One | Two arithmetic vocabularies | One per profile, stated in the output | One per backend | One per instantiation |
| GPU backends | Impossible: GLSL ES and WGSL have no binary64 [W31]; CUDA's binary64 runs at a small fraction of binary32's speed on consumer cards [W31] | Fine | A GPU profile | Fine | Instantiate at binary32 |
| Stdlib source | Unchanged | Every type over `Number` twice; about 20 of the names VOCABULARY.md reuses | Unchanged | Unchanged | Every type over `Number` gains a scalar parameter; `plato-252` calls this "a large, invasive library change" |
| Other arithmetics in one run (reference, interval, dual numbers) | No | No | The compiler re-instantiates the TIR internally: the evaluator's reference and interval profiles (SPEC-EXECUTION.md 2.9), automatic differentiation as a TIR pass (`plato-252` route B) | No | Yes, in source |
| Author's burden | None | A type choice at every declaration | None, plus stating requirements | None, but results differ | Type parameters everywhere |

**Option C, made a full language feature.** A profile fixes the whole arithmetic, not only a width.
The compiler, not the author, instantiates a program at another arithmetic where verification or
differentiation needs it. That keeps the reach of option E without its signatures.
- **Option A is ruled out by Plato's GPU users:** gpu-accel needs WGSL and bit-exact CPU twins
  (`plato-449`, `plato-451`).
- **Options B and D are rejected as before:** B doubles the vocabulary, and D makes a law's truth
  depend on the backend.

### 5.3 The recommendation

`Number` is an abstract real. A Plato program means one thing per profile, and SEMANTICS.md says
which. The profile is:
- chosen per compilation (`plato build --profile cpu64`);
- written into the generated code's header;
- recorded in every run record, so that a result names the arithmetic that produced it (PROJECT.md
  principle 4).

A library compiled under a profile it cannot live with fails to compile (5.5). Two compilations of
the same source under different profiles meet only through sized types (5.7). A GPU kernel that
shares code with the CPU library is therefore a second compilation, with an explicit conversion at
the buffer.

### 5.4 The profiles

| Profile | `Number` | Basic operations | Elementary functions | Contraction | `Integer` | For |
|---|---|---|---|---|---|---|
| `cpu64` (default on CPU backends) | binary64 | Correctly rounded, ties to even, left to right, no reassociation | Plato's, correctly rounded (5.8) | Forbidden | Exact within ±(2^53 − 1) (5.6) | Development, verification, release conformance, run evidence |
| `cpu64-host` | binary64 | As `cpu64` | The host's library, compared with `cpu64`'s within a per-function envelope | Forbidden | As `cpu64` | Production builds, if the spike of section 6, question 4, shows the portable functions too slow |
| `cpu32` | binary32: every operation rounded to binary32 (`Math.fround` in TypeScript) | Correctly rounded | Plato's binary32 versions, correctly rounded | Forbidden | 32-bit | CPU twins of GPU code; settles `plato-449` |
| `gpu32` | binary32 | As the shading language's accuracy table states | The GPU's built-ins | Allowed: GPUs fuse | 32-bit | GLSL, WGSL, CUDA device code |
| `reference` (verifier only) | Double-double or MPFR | At least 20 bits beyond binary64 | Same | n/a | n/a | Three-valued verdicts (SPEC-EXECUTION.md 2.9) |
| `interval` (verifier only) | Intervals over binary64, rounded outward | Enclosing | Enclosing | n/a | n/a | Sound bounds, such as a sagitta over a parameter span |

The profile also fixes the details that differ between backends today (7.3):
- `Min` and `Max`: IEEE 754-2019's `minimum` and `maximum`, which propagate NaN and order −0 below +0;
- `Round`: ties to even, to an integer;
- signed zero as IEEE 754 defines it: −0 equals +0 under `==`, and `===` (bitwise identity,
  SPEC-EXECUTION.md 2.3) tells them apart;
- the left-fold order of `Sum`, `Aggregate` and `Reduce`.

The optimizer may not reassociate floating-point operations in any CPU profile.

### 5.5 Stating a precision requirement

Three layers, each checking a different thing.

**(a) What the library needs: a requirement on the library, checked at compile time.** Shown in the
syntax SPEC-EXECUTION.md proposes; illustrative:

```plato
// Coordinates up to 10^8 model units from the local origin (100 km in millimetres), resolved to
// 10^-6 units. Evaluated at compile time in the profile's arithmetic.
library BrepFoundation
    requires Number.ResolutionAt(1.0e8) <= 1.0e-6
{
    ...
}
```

`ResolutionAt(m)` is `00-foundation`'s `max(32 u |m|, SmallestNormal)`, moved into the stdlib.
- **Under `cpu64`** the requirement evaluates to 3.6e-7, which holds.
- **Under `cpu32` or `gpu32`** it evaluates to 190.7, and the compile stops:
  `BrepFoundation requires Number.ResolutionAt(1.0e8) <= 1.0e-6; profile gpu32 gives 190.7`.

Requirements hold over the dependency closure, so a library that uses `BrepFoundation` inherits this
one. A profile exposes the constants such a requirement reads: `Number.Precision` (53 or 24),
`Number.RoundingUnit` (2^-53 or 2^-24), `Number.SmallestNormal`, `Number.MaxValue` and
`Integer.MaxValue`. `Number.Precision >= 53` is also allowed, but the form in domain units says why
the library needs it.

The first version's `Law_NumberIsBinary64` is superseded: a requirement stops the compile, where a law
could only fail a run.

**(b) Whether the backend honours its profile: profile conformance laws in the stdlib**, run on every
backend as part of its readiness test (4.4). Illustrative:

```plato
// The rounding unit, computed with basic operations only, equals the profile's constant.
law RoundingUnitMatchesProfile()
    => ComputedRoundingUnit() === Number.RoundingUnit;

// a * b + c is rounded twice. With a = 1 + 2^-30, b = 1 - 2^-30, c = -1, the product is
// 1 - 2^-60, which rounds to 1, so the sum is exactly 0. A fused multiply-add gives -2^-60.
// 9.313225746154785e-10 is 2^-30 exactly.
law NoContraction()
    => (1.0 + 9.313225746154785e-10) * (1.0 - 9.313225746154785e-10) + -1.0 === 0.0;

// Plato's elementary functions return the correctly rounded value on a committed table of hard
// cases, produced once by MPFR.
law ElementaryFunctionsMatchTable(k: Integer in HardCases.Range)
    => HardCases[k].Evaluate() === HardCases[k].Expected;
```

Also in this set: `Sqrt` correctly rounded on hard cases; ties to even; signed-zero arithmetic;
`Integer` traps at the edge of its range in checked builds.

**(c) Whether the data fits the arithmetic: resolution laws over models**, which already exist or
were proposed:
- `Law_LengthToleranceResolvable` in `00-foundation`;
- the first version's `ToleranceAboveRoundingFloor`, for `02-topology` (the file's tolerance at least
  64 rounding units times the model's extent from its local origin);
- the far-from-origin transform generators of SPEC-EXECUTION.md 2.8.

They read `Number.RoundingUnit`, so they are right in every profile.

### 5.6 `Integer`

| | 32-bit two's complement | 64-bit two's complement | Exact within ±(2^53 − 1), trapping outside | Arbitrary precision |
|---|---|---|---|---|
| JavaScript | Exact with `\|0` and `Math.imul` | BigInt: 950 to 1,060 ms for 20 million operations, against 68 to 74 ms with numbers, 14 times slower [M] | A number, plus a range check in checked builds: 114 to 161 ms [M] | BigInt |
| GPU languages | Native | Absent in WGSL and GLSL ES | Narrowed to 32 bits in GPU profiles | No |
| `Integer` to `Number` | Exact | Rounds above 2^53 | Always exact | Rounds |
| This library | Indices fit (Snowdon has about 450,000 instances), but STEP instance numbers and corpus counters are not bounded by 2^31 | Fits | Fits | Fits |

**Recommendation [J]: the third column.**
- **Storage.** On CPU profiles `Integer` is stored in 64 bits by native backends and as a number by
  JavaScript.
- **Value set.** The integers within ±(2^53 − 1). A result outside is a defect, trapped at the same
  threshold by every backend's checked build.
- **Exact conversion.** Every `Integer` converts to `Number` exactly, which removes a class of silent
  rounding in geometry code: an index or count becoming a coordinate.
- **GPU profiles** narrow `Integer` to 32 bits. A library that needs more says so:
  `requires Integer.MaxValue >= 2147483648`.
- **Division and remainder.** Division truncates toward zero, and the remainder takes the dividend's
  sign, which is what C#, JavaScript, Rust and C++ already do with their native integers.
- **Wraparound, bit patterns and hashes** use the sized types of 5.7.

This differs from two earlier positions.
- **SPEC-EXECUTION.md question 12 recommends 64-bit two's complement.** That costs TypeScript BigInt
  or emulation in every index computation, for a range nothing in the library uses.
- **The first version's sized-types section (7.4, now 5.7)** called `Integer` "at least 32 bits with
  unspecified overflow". Unspecified overflow makes a program's meaning depend on the backend, which
  defeats bitwise conformance and the evaluator's role as the definition. A trap turns the same fault
  into a defect report with a location.

### 5.7 Sized types at the boundaries

Proposed in this document on 2026-10-17 at the owner's request (commit `39aba744`), and filed under
`plato-271`. Kept here, with three changes marked below.

**Where width and layout matter.**
- **Inside algorithms, it does not:** the arithmetic scalar is `Number`, one arithmetic per profile.
  A `Number64` used in library bodies would be option B under another name.
- **At boundaries, bytes have a fixed shape.** GLB vertex buffers are binary32, and glTF indices
  unsigned 32-bit. BOS geometry is int32 fixed point. GPU uploads, JSON witnesses, content hashes and
  a Philox round (`plato-451`, gpu-accel) all need a width that does not move with the profile.

**The proposal.**
- **A small set of primitives:** `Float32`, `Float64`, `Integer32`, `Integer64`, `Unsigned32` and
  `Unsigned64`. Each costs every backend a name, so the set stops there.
- **No literal syntax.** A sized value is made from `Number` or `Integer` by an explicit conversion
  and read back the same way. Narrowing and widening are both explicit, and the explicit step is
  what a law can name.
- **Arithmetic only where the width fixes the semantics:** wraparound on the integer types, bitwise
  operations, shifts, comparison, and, changed here, `MultiplyHigh` on `Unsigned64`. No real-number
  arithmetic on `Float32` or `Float64`; computation happens in `Number`.
- **Changed here: bit casts.** `Float64.Bits(): Unsigned64` and `Float64.FromBits(Unsigned64)`, and
  the same for `Float32` with `Unsigned32`. Exact serialization needs them. So do the portable
  elementary functions of 5.8, which reduce arguments on bit patterns.
- **Containers come from the existing generics:** `Array<Float32>` and `Buffer<Float32>` need no new
  machinery. A single-field wrapper is already relied on to be layout-sound
  (`tracker/decisions/2026-08-01-wrapper-scalars-are-the-only-representation.md`).
- **A backend without a width reports the type unsupported**, as GLSL does for `String`.

**What it buys this library.**
- **Output quantization becomes a Plato law,** written once and judged in every backend: positions
  converted to `Float32`, or to BOS fixed point relative to a stated origin, stay within
  `LengthTolerance`.
- **The mesh that leaves the kernel declares its wire layout in its own type,** and the dump of 2.3 is
  written with it.

**Guards.**
- **Sized types appear only in boundary records and in the stdlib's elementary-function library,**
  enforced by a lint, so that the arithmetic scalar stays single.
- **Changed here:** `Integer`'s contract is the one in 5.6, not "unspecified overflow".
- **Rejected alternative: a field annotation**, `X: Number @float32`, in the style of GLSL precision
  qualifiers. It solves layout but hides the rounding, since a read silently widens again.

### 5.8 Elementary functions: Plato's own, correctly rounded

**Which.** The written layers call `Sin` at 44 sites, `Cos` 59, `Tan` 14, `Atan2` 6, `Acos` 2,
`Asin` 1 and `Pow` 1, and no `Exp` or `Log` [M, a search of the sandbox's `.plato` files on
2026-10-17]. The portable set is these seven plus `Atan`, `Exp` and `Log`, on which `Pow` and
others rest.

**How [J].**
- **Where they live:** a stdlib library, `Elementary`, with Plato bodies that follow CORE-MATH's
  algorithms. CORE-MATH gives correctly rounded binary64 and binary32 versions of all of these
  functions [W17].
- **Precedent:** a managed C# port of CORE-MATH exists (AndanteSoft.CoreMathSharp) [W17], so the
  algorithms survive leaving C.
- **What the port needs from the language:** the bit casts and `Unsigned64` arithmetic of 5.7.
- **Which profiles use them:** `cpu64` and `cpu32`. `cpu64-host` and `gpu32` use the host's or the
  GPU's functions.

**Why correctly rounded, and not merely deterministic.**
- **One right answer.** A correctly rounded function has exactly one correct result. The Plato
  version can therefore be checked against any other correctly rounded implementation, and host
  libraries are converging on the same results:
  - glibc took CORE-MATH's binary32 functions in 2.41 and 2.42, and some binary64 ones in 2.43;
  - LLVM's libc aims at correct rounding in every rounding mode;
  - MSVC ships LLVM-libc's `<cmath>` experimentally [W17].
  So on such platforms `cpu64-host` may in time equal `cpu64` bit for bit.
- **No new standard.** A deterministic but not correctly rounded implementation would be a
  Plato-only standard that nothing else matches.

**Verification.** The conformance law of 5.5(b) runs on every backend against a committed table of
hard cases. MPFR or CORE-MATH computes that table once, offline: it is data, not a dependency of the
library or its tests. Random samples are also compared with the `reference` profile.

### 5.9 What changes in the stdlib, SEMANTICS.md and the tracker

**SEMANTICS.md and the stdlib's own documents:**
- **SEMANTICS.md sections 1 and 8:** `Number` is an abstract real bound by a profile; the table of
  5.4; `Integer` as in 5.6; division and remainder; `Min`, `Max`, `Round`, signed zero; fold order;
  no reassociation; the sized types.
- **`stdlib/foundation/primitives.plato:22`:** the comment says what `Number` means per profile.

**New in the stdlib:**
- **Profile constants:** `Number.Precision`, `Number.RoundingUnit`, `Number.SmallestNormal`,
  `Number.MaxValue`, `Integer.MaxValue`, and `ResolutionAt`, moved from `00-foundation`.
- **The `Elementary` library (5.8).** The host intrinsics for these functions remain only in
  `cpu64-host` and `gpu32`, the direction of `plato-378` (shrink the host intrinsic kernel).
- **The sized types and their conversions and bit casts (5.7).**
- **The profile conformance laws (5.5(b)),** in the stdlib's law files.

**Fixed:**
- **`Number.Epsilon`** is the smallest subnormal today; rename it `SmallestSubnormal`, and fix
  `matrices-ops.library.plato:66`, which uses it as a singularity threshold.
- **`Round(digits)`** is removed: a decimal digit count has no exact binary meaning. `Round()` rounds
  ties to even.
- **Float-tuned constants** are reviewed, such as the law helper `LawEq`'s 1e-4.
- **Literals** are emitted by every writer as exact round-trip strings or hexadecimal floats.

**The tracker:**
- `plato-271` becomes the decision record this section drafts.
- `plato-370` is superseded: binary64 is the `cpu64` profile, not a C# switch.
- `plato-449` is settled by `cpu32`.
- `plato-451` targets `gpu32`.
- `plato-252` route B becomes one use of TIR re-instantiation.

## 6. Open questions for the owner

Each with the fact that would settle it. The OpenCascade question is decided and not reopened.

1. **C++ before Rust?** Settled by naming a native consumer of this library (a C++ host, a CUDA
   kernel, a Python binding) and the date it needs the library. If one comes before `06-mesh` is
   green, C++ takes Rust's place in the order.
2. **`Integer`: exact within ±(2^53 − 1), or 64-bit two's complement** (SPEC-EXECUTION.md question
   12)? Settled by a search of the stdlib and the sandbox for an `Integer` computation, other than
   hashing and bit manipulation, that needs values beyond 2^53. None is known; if none exists, the
   narrower range costs nothing and keeps TypeScript exact without BigInt.
3. **Correctly rounded or only deterministic elementary functions?** Settled by a spike that ports
   CORE-MATH's `sin` and `cos` to Plato, times them against the host's in C# and Node on the torus
   law of 3.1, and checks them against MPFR on hard cases. Correct rounding is recommended unless the
   spike shows it makes corpus runs impractical.
4. **Does `cpu64-host` need to exist?** Settled by the same spike. If the portable functions cost
   under about a tenth of the pipeline's run time on the witness corpus, drop the host profile, and
   with it every envelope comparison.
5. **Hash meshes as run evidence?** `cpu64` makes positions reproducible bit for bit across backends
   and operating systems. Settled by whether the toolkit's run records (PROJECT.md principle 4) should
   pin outputs as well as inputs. If they should, the hash records its profile.
6. **TypeScript on every push, or nightly** (SPEC-EXECUTION.md 1.4)? Settled by the per-push CI time
   with TypeScript included, measured over the first month: keep it on every push while the evaluator,
   C# and TypeScript together stay inside the 10-minute budget.
7. **The C# confirmation budget: 5 s or 30 s** (SPEC-EXECUTION.md 1.4)? Settled by building the
   warm-worker path of 4.1 and timing one layer.
8. **A browser law runner?** A viewer page that runs a layer's laws and redraws on every rebuild.
   Settled by whether people, not only agents, will debug meshes interactively; agents work from the
   dump and a captured picture.
9. **What `gpu32` promises.** Settled by gpu-accel's experiment (its TKT-11): whether WGSL agrees
   with a `cpu32` twin to 0 ULP for addition, subtraction and multiplication, and for which operations
   it does not.
10. **Requirements on libraries, or a profile manifest per project?** Settled by whether any library
    is compiled under more than one profile. The stdlib will be (`cpu64`, `cpu32`, `gpu32`), which
    favours declarations on libraries, checked over the dependency closure.
11. **Where corpus validation runs: C# or Rust?** Settled by timing a 1,000-file run on both once
    `06-mesh` exists. Rust was 1.3 times faster on the torus law.

## 7. Current state, fixes assumed (notes)

The first version's measurements, kept as notes on the gap between today and the premise. Per the
owner's correction they carry no effort estimates and do not enter the recommendation.

### 7.1 What each writer emits at `f6e02cf0` [R]

| | C# | TypeScript | C++ | CUDA | Rust | GLSL |
|---|---|---|---|---|---|---|
| Writer | `writers/Plato.CSharpWriter`, 7,516 lines | `Plato.TypeScriptWriter`, 2,639 | `Plato.CppWriter`, 3,290 | the C++ writer, `CppDialect.Cuda` | `Plato.RustWriter`, 2,165 | `Plato.GlslWriter`, 1,181 |
| `Number` | struct wrapping `float`, math through `MathF` (`src/Plato.Intrinsics/Number.cs:21`) | `number`, binary64 | `float` | `float` | `f64` | `float` |
| `Integer` | struct wrapping `int` (`Integer.cs:19`) | `number`; division `Math.trunc(a / b)` | `int` | `int` | `i64` | `int` |
| Sum types and `match` | yes (`WriteSumType`, `CSharpConcreteTypeWriter.cs:429`) | no: a CHK320 comment | no: "not representable" | no | no: CHK320 | no |
| Loops | yes | yes | yes | yes | yes | yes; no recursion |
| `List` and `Buffer` builders | yes | yes | no | no | no | no |
| `Array<T>` | `IReadOnlyList<T>` | a JavaScript array | fixed capacity 64, oversized results clamped (`CppPrelude.cs:231`) | same | `Vec` | none |
| Lambdas | yes | yes | functors where the inliner leaves them | same | closures | no |
| Source mapping | none | none | none | none | none | none |

### 7.2 What each backend did with the stdlib [M, first version]

| | C# | TypeScript | C++ | Rust |
|---|---|---|---|---|
| foundation: generate | 4.5 to 4.9 s; 283 files, 32,239 lines | 3.9 s; 13,979 lines | 4.8 s; 21,941 lines; 1,618 functions skipped | 3.9 s; 14,526 lines |
| foundation: compile | 3.3 to 3.8 s, 0 errors | with the other tiers, below | MSVC stopped at 100 errors after 92.7 s | `cargo check`: 3,347 errors in 10.5 s |
| foundation + geometry | 16.0 s to generate, 751 files, 95,963 lines; four compile defects (an unescaped `base` parameter, two CS1929, one CS0117) | 10.0 s, 43,592 lines; with graphics, 2,476 type errors hidden by `// @ts-nocheck` | 12.9 s, 39,124 lines; 6,498 functions skipped | not run |
| executes | foundation tests 37 of 37; law runner 35 cases, 25 trials each, all pass | demo tests 26 of 26 | no runtime test | a curated demo subset only |
| loop with laws | 10.3 to 11.6 s | about 22 s for three tiers, no law runner | over 90 s to compile | none |

The law runner's driver script passes `--scalar=float`, which the CLI rejects; driven directly, the
runner builds and passes. The C++ writer skips every B-rep v1 type as "field type not representable
in C++".

### 7.3 Semantics that differ between backends today [R, M]

- **`Number.Round(digits)`.** C#: `MathF.Round(v, digits)`, half to even. C++: `roundf(a)`, which
  ignores `digits` and rounds half away from zero. TypeScript: `Math.round(this)`, which ignores
  `digits` and rounds half toward positive infinity.
- **`Number.Epsilon`** is the smallest positive subnormal (`float.Epsilon` in C#, `Number.MIN_VALUE`
  in TypeScript), not the machine epsilon.
- **The documents disagree.** `docs/SEMANTICS.md` says `Number` is 32-bit everywhere;
  `stdlib/foundation/primitives.plato:22` says 64-bit; the writers make it 32-bit in C#, C++, CUDA and
  GLSL and 64-bit in TypeScript and Rust.
- **New in this version [R].** The generated TypeScript:
  - **Out-of-range reads.** `Arr.At(n)` calls the array's element function for any `n`, so an
    out-of-range index on a lazily built array returns a computed value rather than an error
    (`plato.g.ts`, class `Arr`).
  - **Overloads are dropped** ("Skipped: overload or duplicate member 'Transform'").
  - **Methods are installed on `Number.prototype`.**
  - **Node cannot run it directly.** It uses parameter properties and namespaces, which Node's
    strip-only mode rejects (`ERR_INVALID_TYPESCRIPT_SYNTAX`, measured on the synthetic program).
    `--experimental-transform-types` runs it, at 3.8 s per start, and Node 26 removes that flag
    [W23].

### 7.4 What each backend lacks for this library, and the test that closes it

| Backend | Missing at `f6e02cf0` |
|---|---|
| C# | binary64 `Number`; the geometry tier's four compile defects; a law runner that builds arrays, sums and zero-field types and knows witnesses; `#line`; a JSON kernel |
| TypeScript | sum types and `match`; type-correct output; overloads under distinct names; checked indexing; source maps; erasable syntax |
| Rust | sum types and `match`; a foundation tier that compiles; a JSON kernel |
| C++ | sum types; heap-backed arrays and strings beyond 64; builders; binary64; a foundation tier that compiles; any runtime test; `#line`; a JSON kernel |
| All | one meaning for `Round` and `Epsilon`; the profiles of 5.4; Plato's elementary functions; the evaluator of SPEC-EXECUTION.md |

**The test that closes each row is the same:** the readiness test of 4.4,
`plato verify 00-foundation --backends eval,<b>`, with every statement reported and every value
bitwise equal to the evaluator's.

### 7.5 Fixes assumed

The fixes this document assumes are those listed in SPEC-EXECUTION.md 9.2, plus the rows of 7.4 and
the TypeScript items of 7.3.

## 8. Section map from the first version

SPEC-EXECUTION.md cites the first version by section number. The citations map as follows.

| First version | This version |
|---|---|
| 1 Terms | 1 |
| 2.1 to 2.3, the state of each backend | 7.1 to 7.3 |
| 3.1 pipeline coverage decides it | withdrawn under the premise |
| 3.2 loop speed | 3.1 |
| 3.3 laws and property tests | 3.3 |
| 3.4 debugging a wrong mesh | 3.2 |
| 3.5 interop | 3.5 |
| 3.6 floating-point determinism (cited by SPEC-EXECUTION.md 5) | 3.4 |
| 3.7 feedback to an agent | 3.6 |
| 3.8 a data-driven cross-backend harness (cited by SPEC-EXECUTION.md 5) | 4.4, 4.5 |
| 4.1 first target (cited by SPEC-EXECUTION.md 7.1) | 4.1, 4.2 |
| 4.2 the first week in C# | 4.6 |
| 4.3 what to keep portable (cited by SPEC-EXECUTION.md 2.9) | 4.7 |
| 4.4 when to turn on C++ | 4.3, 4.6 |
| 5.1 to 5.5 precision (5.4 cited by SPEC-EXECUTION.md 5) | 5.1 to 5.5 |
| 6 question 3, bit-identical meshes (cited by SPEC-EXECUTION.md 8) | 6, question 5 |
| 6 question 4, `Integer` width (cited by SPEC-EXECUTION.md 8) | 5.6; 6, question 2 |
| 7 sized types | 5.7 |

## Sources

- [W1] CsCheck: <https://github.com/AnthonyLloyd/CsCheck>; releases <https://www.nuget.org/packages/CsCheck>.
- [W2] FsCheck: <https://fscheck.github.io/FsCheck/QuickStart.html>, <https://fscheck.github.io/FsCheck/RunningTests.html>.
- [W3] Hedgehog for .NET: <https://github.com/hedgehogqa/fsharp-hedgehog>.
- [W4] fast-check failure reports and model-based testing:
  <https://fast-check.dev/docs/tutorials/quick-start/read-test-reports/>,
  <https://fast-check.dev/docs/advanced/model-based-testing/>.
- [W5] proptest: <https://proptest-rs.github.io/proptest/proptest/failure-persistence.html>,
  <https://proptest-rs.github.io/proptest/proptest/vs-quickcheck.html>.
- [W6] Hegel: <https://antithesis.com/blog/2026/hegel/>, <https://hegel.dev/explanation/how-hegel-works>,
  <https://github.com/hegeldev>.
- [W7] RapidCheck debugging: <https://github.com/emil-e/rapidcheck/blob/master/doc/debugging.md>.
- [W8] FuzzTest: <https://github.com/google/fuzztest>.
- [W9] MacIver and Donaldson, "Test-Case Reduction via Test-Case Generation: Insights from the
  Hypothesis Reducer", ECOOP 2020: <https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ECOOP.2020.13>.
- [W10] ECMAScript Number operations and `Math`:
  <https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html>,
  <https://tc39.es/ecma262/multipage/numbers-and-dates.html>.
- [W11] V8's math library: <https://codereview.chromium.org/411263004> (fdlibm port),
  <https://bugzilla.mozilla.org/show_bug.cgi?id=1823880> (glibc `sin`/`cos`; SpiderMonkey's choice),
  <https://api.github.com/repos/v8/v8/commits?path=src/base/ieee754.cc> (LLVM libm, 2026).
- [W12] ECMA-335, Partition I, 12.1.3:
  <https://ecma-international.org/wp-content/uploads/ECMA-335_6th_edition_june_2012.pdf>.
- [W13] dotnet/runtime issue 64591 (implicit FMA declined): <https://github.com/dotnet/runtime/issues/64591>.
- [W14] `Math.Sin`: <https://learn.microsoft.com/en-us/dotnet/api/system.math.sin>.
- [W15] GCC: <https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html>; Clang 14:
  <https://releases.llvm.org/14.0.0/tools/clang/docs/ReleaseNotes.html>; MSVC `/fp`:
  <https://learn.microsoft.com/en-us/cpp/build/reference/fp-specify-floating-point-behavior>,
  <https://devblogs.microsoft.com/cppblog/the-fpcontract-flag-and-changes-to-fp-modes-in-vs2022/>.
- [W16] Rust RFC 3514: <https://rust-lang.github.io/rfcs/3514-float-semantics.html>; `f64`:
  <https://doc.rust-lang.org/std/primitive.f64.html>.
- [W17] CORE-MATH: <https://core-math.gitlabpages.inria.fr/>; glibc 2.43:
  <https://gitlab.com/gnutools/glibc/-/tags/glibc-2.43>; LLVM libc math:
  <https://libc.llvm.org/headers/math/index.html>; MSVC `/Zc:cmath`:
  <https://devblogs.microsoft.com/cppblog/msvc-c23-constexpr-cmath-with-llvm-libc/>;
  AndanteSoft.CoreMathSharp: <https://www.nuget.org/packages/AndanteSoft.CoreMathSharp>.
- [W18] C# `#line`: <https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/preprocessor-directives>;
  enhanced line directives:
  <https://github.com/dotnet/csharplang/blob/main/proposals/csharp-10.0/enhanced-line-directives.md>.
- [W19] ECMA-426 source maps: <https://ecma-international.org/publications-and-standards/standards/ecma-426/>;
  VS Code: <https://code.visualstudio.com/docs/nodejs/nodejs-debugging>; Chrome DevTools:
  <https://developer.chrome.com/docs/devtools/javascript/source-maps>; Node `--enable-source-maps`:
  <https://nodejs.org/api/cli.html>.
- [W20] GCC line control: <https://gcc.gnu.org/onlinedocs/cpp/Line-Control.html>.
- [W21] Rust line-directive pre-RFCs:
  <https://internals.rust-lang.org/t/pre-rfc-supporting-line-directives-either-directly-or-with-an-extension/4765>,
  <https://internals.rust-lang.org/t/pre-rfc-line-attribute/21069>.
- [W22] Polyscope: <https://polyscope.run/>; Rerun SDKs: <https://rerun.io/docs/getting-started/installing-viewer>;
  SharpGLTF: <https://github.com/vpenades/SharpGLTF>.
- [W23] Node type stripping: <https://nodejs.org/api/typescript.html>; esbuild: <https://esbuild.github.io/faq/>;
  TypeScript 7: <https://devblogs.microsoft.com/typescript/?p=5246>.
- [W24] Rust compiler performance survey 2025:
  <https://blog.rust-lang.org/2025/09/10/rust-compiler-performance-survey-2025-results>.
- [W25] .NET test startup (secondary source):
  <https://www.meziantou.net/benchmarking-dotnet-test-frameworks-xunit-v3-nunit-mstest-and-tunit.htm>.
- [W26] Rust overflow and indexing: <https://doc.rust-lang.org/reference/expressions/operator-expr.html>,
  <https://doc.rust-lang.org/reference/expressions/array-expr.html>; C# overflow checking:
  <https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-options/language>;
  `IndexOutOfRangeException`: <https://learn.microsoft.com/en-us/dotnet/api/system.indexoutofrangeexception>;
  JavaScript arrays: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array>;
  C++ undefined behaviour: <https://en.cppreference.com/w/cpp/language/ub>; MSVC AddressSanitizer:
  <https://learn.microsoft.com/en-us/cpp/sanitizers/asan>.
- [W27] GitHub Actions runner pricing: <https://docs.github.com/en/billing/reference/actions-runner-pricing>;
  sccache: <https://github.com/mozilla/sccache>.
- [W28] Browser builds: .NET WebAssembly size (secondary source),
  <https://www.meziantou.net/optimizing-a-blazor-webassembly-application-size.htm>; Rust and
  WebAssembly code size, <https://rustwasm.github.io/docs/book/reference/code-size.html>.
- [W29] Kani: <https://model-checking.github.io/kani/>, floating-point support:
  <https://model-checking.github.io/kani/rust-feature-support.html>.
- [W30] OpenCascade's `Precision::Confusion()`: <https://dev.opencascade.org/content/precisionconfusion>.
- [W31] WebGL has no double precision: <https://wikis.khronos.org/webgl/WebGL_and_OpenGL_Differences>;
  FP64 on consumer GPUs:
  <https://forums.developer.nvidia.com/t/weekend-project-fp64-emulation-on-consumer-grade-gpus/291205>.
- [W32] `nvcc` contracts by default (`--fmad`): <https://forums.developer.nvidia.com/t/fma/32965>.
