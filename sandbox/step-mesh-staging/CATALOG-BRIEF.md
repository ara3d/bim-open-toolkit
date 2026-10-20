# Brief for the catalog builders (2026-10-20)

Shared by every builder implementing `sandbox/step-brep-mesh/TYPE-CATALOG.md` in Plato. Your
track's own message names the sections you own and your staging folder. Everything else is here.

## Goal

Turn the catalog's entries for your sections into real Plato: types, the concepts (interfaces)
listed in your sections, their constructor and conversion functions, one law per type or
conversion, and a spec file stating each type's invariants and constructors. Every file must
type-check against the library, and your laws must pass under the law runner. The catalog is the
specification; where it gives a shape, keep it; where it only sketches (`..`, "one per index
type"), choose the obvious completion and write it down in `TRACK.md`.

## Read first, in this order

1. `sandbox/step-mesh-staging/README.md`: the staging rules (new files only, names that do not
   collide, commits by path).
2. `sandbox/step-brep-mesh/PLATO-PRIMER.md` sections A (declaration grammar), D (language
   limits), F (pitfalls). Plato: closed sums with exhaustive `match`; no generic sums (generic
   products are fine); a type may contain itself only through `Array<T>`; `&&` and `||` evaluate
   both sides, so guard with `pre ? claim : true`; exact `==` only on integers, indices, tags.
3. `sandbox/step-brep-mesh/SPEC-DSL.md` section 2 (laws, witnesses) and section 3 (the spec
   constructs: `spec <Type> { invariant ...; constructor ...; }`).
4. `sandbox/step-brep-mesh/VOCABULARY.md`: the names that exist. Never redeclare one; the
   catalog marks them **exists** or **extend**. An **extend** entry is a contract change: do not
   edit the library's type; declare the new form beside it under a new name only if your section
   needs it now, and write the change under "Contract requests" in `TRACK.md`.
5. One existing types file for form, for example
   `sandbox/step-brep-mesh/04-discretization/discretization.types.plato`, and one laws file,
   `sandbox/step-brep-mesh/04-discretization/discretization.laws.plato`.
6. `sandbox/step-brep-mesh/TYPE-CATALOG.md`: your sections.

## Files you write

All in your staging folder, nothing anywhere else:

- `catalog-<topic>.types.plato`: types. Several small files beat one large one.
- `catalog-<topic>.concepts.plato`: interfaces, if your sections list any.
- `catalog-<topic>.library.plato`: one `library` block, named `Catalog<Track><Topic>`, holding
  the constructors (`SignWithin`, `RangeOf`, `FractionOf`), conversions (`ToMetres`, `ToChart`),
  and predicates. A body where the body is the specification; `// deferred:` with a bodiless
  declaration only where a real algorithm is needed.
- `catalog-<topic>.laws.plato`: a `library` block named `Catalog<Track><Topic>Laws` with
  `Law_Catalog_<What>` functions, one statement each, total (guards, no out-of-range index),
  tolerances named, no literal epsilon. At least one law per type with an invariant and per
  conversion pair (a round trip).
- `catalog-<topic>.spec.plato`: the spec constructs for your types (invariants, constructors).
  Spec files are not compiled; the runner skips them.
- `TRACK.md` from the README template, kept current.

Naming: library names exactly as the catalog gives them (`ModelLength`, `Sign`, `Sense`), since
the supervisor moves your files into the library at merge; only laws carry the `Law_Catalog_`
prefix until then. Every declaration carries the comment the catalog gives: what it is and what
mistake it removes.

## Types from another track's sections

If your section uses a type another track owns (`Measure`, `UvPoint`, `Sign`, `KernelRemap`)
and it is in `sandbox/step-mesh-staging/catalog-foundation/` or `catalog-indices/`, compile
with those folders too (below) and use it. If it is owned by a track running beside you and not
there yet, declare it yourself in a file named `catalog-borrowed.types.plato` in your own folder,
with the catalog's shape exactly, and list it under "Requests to other tracks" in `TRACK.md`;
the supervisor deletes duplicates at merge. Never borrow a foundation or indices type: those
folders are finished before you start.

## Checks

Type check (filter `none`) and law runs go through the warm server:

```
python -I sandbox/step-brep-mesh/tools/plato_laws.py none --staging sandbox/step-mesh-staging/catalog-foundation --staging sandbox/step-mesh-staging/catalog-indices --staging sandbox/step-mesh-staging/<your folder>
python -I sandbox/step-brep-mesh/tools/plato_laws.py "Law_Catalog_A,Law_Catalog_B" --staging ... (same folders)
```

Run from the repository root `C:\Users\cdigg\git\bim-open-toolkit`. The foundation track itself
passes only its own folder. One type error is already in the library and is not yours:
`05-face-meshing/triangulation-fast.laws.plato:21 CHK201 ... Equals ... (Array<Integer>, Array<Integer>)`.
Any other error in a library file is also not yours; report it. Errors in your folder are yours.
The server may be busy with another track's compile; wait and rerun rather than starting a second
server. Fallback if the server does not answer in ten minutes: the pinned CLI
`dotnet C:/Users/cdigg/.plato-cli/bac65e1c/Plato.CLI.dll` with the library folders and your
folder as roots (PLATO-PRIMER.md section E).

Done means: zero type errors in your folder, every `Law_Catalog_` law you wrote passes (or is an
obligation you explain), `TRACK.md` filled in with the types added, the laws and their verdicts,
durations per step, and the "Requests to other tracks" list.

## Commit

Only your folder, by path, after each green file group and at the end:

```
git add sandbox/step-mesh-staging/<your folder>
git commit -m "<message>" -- sandbox/step-mesh-staging/<your folder>
git push origin main
```

The message ends with the trailers:

```
Ticket: TKT-323
Agent: builder 973bd119-c728-43bd-a581-20802f0b476a

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
```

If a commit fails on a lock or a moved HEAD, another builder committed at the same moment: wait
a second and rerun both commands; after three failures report it. No worktrees, no branches.

## Report

End your report with: types added (count and names), concepts added, laws written and their
verdicts, contract requests, borrowed types, open problems, and a duration per step (reading,
writing, type-check runs, law runs, waiting on the server, committing).
