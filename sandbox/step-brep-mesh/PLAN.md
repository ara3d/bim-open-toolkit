# Plan for the design pass

How the design in this folder is produced, by whom, in what order, and what "done" means for a
design that deliberately writes no algorithm bodies. Ticket: TKT-299. Session:
`5da41e98-0df3-498e-a994-ac6c1ed53928` (2026-10-17).

## What done means

A design pass is done when an implementer could start any task in [TASKS.md](TASKS.md) and meet
these conditions without inventing a rule:

1. Every type the library needs is declared in a `.types.plato` or `.concepts.plato` file, with a
   comment stating its meaning and non-obvious invariants, and its invariants in a `spec` block.
2. Every function the pipeline calls is declared in a `.library.plato` file, with a body when the
   body is the specification and a `// deferred:` note plus a `spec` contract otherwise.
3. Every rule the README of a layer states in prose is also a `Law_` function.
4. Every approximate statement names its tolerance.
5. A fresh reviewer, reading only this folder and the stdlib index, finds no name used but not
   declared, and no law in one layer that contradicts a law in another.
6. The real-Plato files parse and resolve against the stdlib, or the reason they could not be run
   through the front end is recorded under Phase 3 below.
7. [TASKS.md](TASKS.md) orders implementation into chunks of one to a few files, each naming the
   laws it must make pass and the witnesses it must accept.

## Why this shape

The owner asked for a first-principles design in which the rules are encoded before any algorithm is
written, so that implementation holds few surprises. Three consequences shaped the plan:

- **Distil before designing.** The source material (ISO 10303-21 and -42, the AP242 recommended
  practices, the meshing literature, the stdlib, the existing IFC mesher) is far larger than any one
  author can hold beside the design. Phase 1 reduces it to five documents of a few pages each, written
  for the design authors, and the design authors read only those.
- **Fix the contract before fanning out.** Plato has one global namespace. Nine authors inventing
  names in parallel would collide, so [VOCABULARY.md](VOCABULARY.md) was written first and each
  author writes against it and records deviations in it.
- **Review with fresh eyes, then gate mechanically.** Phase 3 reviewers did not write the layers
  they review. The parse-and-resolve gate is the one mechanical check available to a design with no
  bodies, and it catches the most common surprise: a name that does not exist.

## Phases

### Phase 0: orientation and contract (the supervising session)

Read the Plato stdlib's conventions, style, library, and verification documents, its B-rep v1,
topology, mesh, curve, surface and spline declarations, the language semantics, and the location of
the existing IFC mesher. Wrote `README.md`, `SPEC-DSL.md`, `VOCABULARY.md`, this file, and filed
TKT-299. Committed as the first milestone.

### Phase 1: distillation (five agents in parallel)

Each writes one document and returns a short summary with open questions. Model: Opus for the four
that need judgement, Sonnet for the code read.

| Agent | Output | Brief in one line |
|---|---|---|
| Plato primer | `PLATO-PRIMER.md` | The language and stdlib exactly as a design author needs them: declaration grammar, the law convention, the reusable vocabulary with file names, the limits (no recursion, no generic sums, interface-typed fields, `Number` width, `&&`) with evidence from the compiler or docs |
| STEP model | `research/STEP-BREP-MODEL.md` | ISO 10303-21 syntax essentials; the -42 geometry and topology entities used by AP203/AP214/AP242 B-reps with attributes, natural parameterizations, WHERE rules, and the recommended-practice conventions for seams, poles, sense flags, units, and uncertainty |
| Meshing requirements | `research/MESHING-REQUIREMENTS.md` | What a tessellation is commonly required to satisfy, how kernels parameterize it (linear and angular deflection), the algorithm families and their decision points, how watertightness is guaranteed, how seams, poles, and degenerate edges are handled |
| Validation mathematics | `research/VALIDATION-MATH.md` | The theorems and oracles that check a B-rep and a mesh independently of the code that produced them: Euler-Poincare with loops, shells and genus; manifold and orientability criteria; Gauss-Bonnet for closed meshes; divergence-theorem volume; closed-form areas of analytic patches; property-based testing strategy and generators |
| Existing mesher | `research/EXISTING-MESHER-LESSONS.md` | What `deps/bim-open-data/src/data/Ara3D.MeshKernel` and `Ara3D.Ifc.Mesher` do, what they got wrong first, what their tests check, what transfers to STEP and what does not |

### Phase 2: design (nine agents in parallel, Opus)

One agent per layer, each reading `README.md`, `SPEC-DSL.md`, `VOCABULARY.md`, `PLATO-PRIMER.md`,
and the research documents its brief names. Each writes its layer folder: a `README.md` stating the
layer's mathematics, decisions, and what it left open; the `.plato` files of section "How to read
this folder" in the front-door README. Each returns a summary and any change it made to the
contract. Layers 0 to 2 are the foundation others build on; their authors are told that their
exported names are fixed and that the higher layers are being written at the same time against the
contract, so a deviation must be recorded in `VOCABULARY.md` at once.

### Phase 3: review and gate

| Step | Who | Checks |
|---|---|---|
| Name and dependency review | a fresh Opus agent | every referenced name is declared in the sandbox or the stdlib index; no layer references a higher layer; no name declared twice; contract deviations recorded |
| Mathematical review | a fresh Opus agent | laws are true as stated, sufficient for the README's three constraint groups, consistent across layers; missing invariants named; wrong statements corrected or flagged |
| Parse and resolve gate | the supervising session | the real-Plato files, merged with the stdlib tiers into a scratch folder, run through `Plato.CLI lint`; findings fixed or recorded |
| Tasks | the supervising session with the reviews in hand | `TASKS.md` written from the layer READMEs and the review findings |

### Phase 4: close

Commit, push, update the ticket, and write the final report to the owner naming what was decided,
what is open, and the first three tasks.

## Open questions for the owner

Recorded as they arise; the ticket carries the same list.

1. **`Number` width.** The design assumes a 64-bit real. If the C# backend emits `float`, the
   choice is a `Double` primitive in Plato or widening `Number`. Decide before the first
   implementation task.
2. **Reconciliation with the stdlib's B-rep v1.** Replace `Brep3D` and friends in place, or ship this
   library beside them under its own names? The design uses the v1 names where meanings match and
   lists the collisions in `VOCABULARY.md`.
3. **Where the library lives.** As a tier of the Plato stdlib (`geometry` cannot hold it: it reaches
   STEP, which is a file format), as a new tier, or as its own repository that depends on the
   stdlib?
4. **Scope of STEP entities.** Advanced B-rep (`advanced_brep_shape_representation`) and manifold
   surface models are in; faceted B-rep is trivially in; assemblies through `mapped_item` and
   product structure are decoded only far enough to find shapes. Confirm.

## Phase log

- 2026-10-17 Phase 0 complete: contract documents written, TKT-299 filed.
