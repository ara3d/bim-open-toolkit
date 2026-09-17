# 02 — Revision comparison

Brief section 6, row "Revision review": F14 linked views, F08 change colors,
F17 saved comparison. Required input: "Two comparable snapshots and
correspondence/coverage evidence; disputed matches stay unresolved."

Also F26: "Revision comparison with supplied correspondences" — the
correspondence between an object in revision A and an object in revision B
is supplied input, not something this workflow infers from geometry or
names.

## Input contract

| Table | Column | Type | Notes |
|---|---|---|---|
| `objectsA` | `objectId` | string | object as it existed in revision A |
| | `name` | string | |
| | `category` | string | e.g. "Wall", "Door" |
| `objectsB` | `objectId` | string | object as it existed in revision B (a fresh id space; B ids never equal A ids by construction of the fixture) |
| | `name` | string | |
| | `category` | string | |
| `correspondences` | `id` | string | correspondence record key |
| | `aId` | string \| null | FK to `objectsA`; null means "no candidate in A" (an addition) |
| | `bIds` | string[] | FK(s) to `objectsB`; empty means "no candidate in B" (a deletion); more than one means an ambiguous match |
| | `basis` | string | how the correspondence was proposed, e.g. `"same-id"`, `"geometry-match"`, `"name-match"`, supplied by the correspondence source, not computed here |

## Rules

The brief requires disputed matches to "stay unresolved" rather than being
forced into an addition or a deletion. This file adopts the simplest
classification consistent with that constraint (assumption, since the brief
does not enumerate exact category names):

1. `aId` present, exactly one `bId`, and it is the only correspondence
   naming that `aId` and that `bId` → **matched**. Further split by what
   differs between the two objects: `unchanged` (name and category both
   equal), `renamed` (name differs, category equal), `recategorized`
   (category differs). This is a display refinement of "matched", not a
   separate brief-mandated category — stated as an assumption.
2. `aId` is `null` → **added** (only in revision B).
3. `bIds` is empty → **deleted** (only in revision A).
4. `bIds` has more than one entry, or the same `bId`/`aId` appears in more
   than one correspondence record → **ambiguous**. An ambiguous
   correspondence is never collapsed into `added`/`deleted`/`matched`; it is
   reported as an exception with all candidate ids visible.

## Worked example (prose)

Revision A has 5 objects (W-1..W-3 walls, D-1 door, D-2 door). Revision B has
5 objects (W-1b..W-3b walls, D-1b door, D-9 a new door).

Correspondences:
- W-1 → [W-1b], basis `same-id`, same name/category → **unchanged**.
- W-2 → [W-2b], basis `geometry-match`, name changed from "Wall-02" to
  "Wall-02-Revised" → **renamed**.
- W-3 → [W-3b], basis `geometry-match`, category changed from "Wall" to
  "Curtain Wall" → **recategorized**.
- D-1 → [D-1b, D-9], basis `name-match` (two candidates proposed) →
  **ambiguous**; both candidates are kept visible, neither is chosen.
- D-2 → [], basis `same-id` (no candidate found in B) → **deleted**.
- null → [D-9] is *not* a separate record here because D-9 already appears
  as one of D-1's ambiguous candidates; D-9 is not independently reported as
  "added" while it is still a candidate of an unresolved match (assumption:
  a `bId` counted in an ambiguous record is not double-counted as an
  addition).

Expected comparison: 4 resolved rows (unchanged, renamed, recategorized,
deleted) plus 1 ambiguous exception row covering D-1/D-1b/D-9.

## Assumptions

- `unchanged` / `renamed` / `recategorized` are display refinements of
  "matched"; a stricter reading of the brief would only require
  matched/added/deleted/ambiguous. Both readings are compatible with this
  fixture — the `changeType` field spells out the finer category.
- A `bId` that only appears inside an ambiguous correspondence is not also
  reported as a standalone addition.
- Correspondence `basis` is carried through to the comparison row but is
  never used to auto-resolve an ambiguous match.
