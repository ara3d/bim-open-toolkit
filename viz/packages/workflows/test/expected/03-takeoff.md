# 03 — Roof and room-finish takeoff

Brief section 6, row "Roof and room-finish takeoff": F18 surface scopes, F08
coverage colors, F07 result selection. Required input: "Supplied measurement
basis and distinct finish faces; rendered triangles are not automatically
authoritative quantities."

## Input contract

| Table | Column | Type | Notes |
|---|---|---|---|
| `surfaces` | `objectId` | string | one row per distinct finish face |
| | `roomId` | string | which room the face belongs to |
| | `finishType` | Observation of string | e.g. `"Carpet"`, `"Tile"`; `missing` means unassigned |
| | `areaM2` | Observation of number, unit `m2` | the supplied measurement, not a triangle count |
| | `basis` | string | how the area was obtained, e.g. `"supplied-measurement"`, `"derived-from-drawing"`; always present, carried through for provenance, never used to override a `missing`/`conflicting` area |

## Rules

The brief's phrase "rendered triangles are not automatically authoritative
quantities" means: this workflow only ever sums `areaM2` values that are
already `known` in the input; it never computes area from geometry itself
(there is no geometry in this fixture at all, by design).

1. **Subtotal by finish type** — group known-`finishType` + known-`areaM2`
   surfaces by `finishType.value`, sum `areaM2.value`. A subtotal is only
   emitted for a `finishType` that has at least one contributing surface.
2. **Unsupported / exception surfaces** — a surface is an exception, not
   silently zero and not folded into any subtotal, when:
   - `finishType` is `missing` (unassigned face), or
   - `areaM2` is `missing` or `conflicting` (no usable number), or
   - `finishType` is `conflicting` (assigned to more than one candidate
     finish, not resolved by this workflow).
   A surface can trigger more than one exception reason; each reason is
   reported (assumption: exceptions are per missing/conflicting field, not
   deduplicated to one row per surface, so nothing is silently dropped).
3. **Grand total known** — a `totalKnownM2` figure is reported alongside the
   per-finish subtotals, equal to the sum of all subtotals. It is reported
   separately from — never combined with — the count/area of exception
   surfaces, so a reader cannot mistake "known total" for "total area of the
   room."

## Worked example (prose)

Nine surfaces across two rooms:

- 3 carpet faces in Room A: 12, 8, 10 m² (all known, basis
  `supplied-measurement`) → Carpet subtotal 30 m².
- 2 tile faces in Room A: 5 m² known; 1 face has a conflicting area (18 vs
  20 m², two surveys disagree) → Tile subtotal uses only the known one:
  5 m²; the conflicting one is an exception.
- 2 carpet faces in Room B: 9 m² known; 1 face has `finishType` missing
  (reason `not-provided`, never classified) → Carpet subtotal adds 9 m²
  more (total Carpet 39 m²); the unassigned face is an exception and
  contributes nothing to any subtotal.
- 1 face in Room B has `areaM2` missing (reason `not-measured`) but
  `finishType` known as `"Vinyl"` → no Vinyl subtotal is emitted (no
  contributing surfaces), and the face is an exception.
- 1 face in Room B has both `finishType` known (`"Tile"`) and `areaM2`
  known (6 m²) → Tile subtotal becomes 5 + 6 = 11 m².

Expected subtotals: Carpet 39 m², Tile 11 m² (no Vinyl subtotal, since its
only candidate surface has no known area). `totalKnownM2` = 39 + 11 = 50 m².

Expected exceptions: 3 rows — the conflicting-area tile face, the
missing-finishType carpet-room-B face, and the missing-area vinyl face.

## Assumptions

- A subtotal row is omitted entirely (not emitted as zero) when no surface
  contributes a known area for that finish type, consistent with "incomplete
  quantities never appear as zero."
- Exceptions are reported per offending field, so a surface with both an
  unassigned finish and a missing area would produce two exception rows
  (not exercised in this fixture, since no surface has both problems).
- `basis` is provenance only; a `missing`/`conflicting` area is never
  "rescued" by trusting `basis` instead.
