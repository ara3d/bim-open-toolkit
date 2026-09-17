# 01 — Door schedule with fire-rating exceptions

Brief section 6, row "Building, room and door schedules": F07 selection, F08
exceptions/heat maps, F11 level navigation, F26 linked tables. Required input:
"Stable object identities, locations and facts; schedules still work without
geometry."

## Input contract

Every workflow in this set shares one identity convention: an `objectId` is a
plain string, unique within one implied model/revision (there is no separate
`modelId`/`revision` pair in these fixtures — see the CHECKPOINT note on
identity). A real adapter reads `viewer/packages/model/src/identity.ts`
`ObjectRef` instead; these fixtures stand in for the `objectId` part of it.

Fact-like fields (a value that can be known, missing or conflicting) are
written as a small object, not a bare scalar, so the shape lines up with
`viewer/packages/model/src/facts.ts`:

```
{ "kind": "known", "value": <number|string|boolean>, "unit"?: <string> }
{ "kind": "missing", "reason": "not-provided"|"not-applicable"|"not-measured"|"unresolved-source"|"out-of-scope" }
{ "kind": "conflicting", "values": [<value>, <value>, ...] }
```

This is a flattened stand-in for `facts.ts`'s `Observation` (which nests a
`FactValue` and evidence list); Track W's real adapter will read the actual
`Observation` type once Track M's `facts.ts` is stable. The `kind` and
`reason` vocabulary is copied verbatim from `facts.ts` so the mapping is
mechanical.

| Table | Column | Type | Notes |
|---|---|---|---|
| `storeys` | `storeyId` | string | key |
| | `name` | string | e.g. "Level 1" |
| `rooms` | `objectId` | string | key |
| | `name` | string | |
| | `storeyId` | string | FK to `storeys` |
| `doors` | `objectId` | string | key |
| | `name` | string | door mark, e.g. "D-101" |
| | `storeyId` | string | FK to `storeys` |
| | `roomId` | string \| null | FK to `rooms`; null if not linked to a room |
| | `hasGeometry` | boolean | false means a geometry-free record (still schedulable per the brief) |
| | `widthMm` | Observation of number, unit `mm` | door leaf width |
| | `fireRatingMinutes` | Observation of number, unit `min` | fire-resistance rating |

## Rules

The brief does not specify the exact schedule columns or the exact exception
test, so this file states the simplest rule consistent with F08 ("explicit
visual treatment of unavailable/conflicting values") and F26 ("incomplete
quantities never appear as zero"):

1. **Schedule row** — one row per door, always produced regardless of
   `hasGeometry`, joined to its storey name and (if linked) room name.
   A door with `roomId: null` still gets a schedule row; its `room` field is
   `null`, not an empty string and not omitted.
2. **Fire-rating exception** — a door is an exception when
   `fireRatingMinutes.kind` is `"missing"` or `"conflicting"`. The exception
   row carries the reason (`missing.reason`) or the disputed values
   (`conflicting.values`) verbatim; it never guesses a rating and never
   reports `0`.
3. **Width is not an exception source** in this workflow (the brief lists
   fire rating as the schedule/exception axis, not width); width is carried
   through the schedule row as-is, including when missing, using the same
   Observation shape, for completeness. No width exceptions are computed by
   this workflow (assumption).
4. **Ordering** — schedule rows are ordered by `storeyId` then `name`, so
   level navigation (F11) can page through the schedule in that order. This
   fixture uses two storeys, ordered as given in the `storeys` table.

## Worked example (prose)

Two storeys, "Level 1" and "Level 2". Eight doors:

- D-101, D-102, D-103 on Level 1, D-104 on Level 1 with no linked room.
- D-201..D-204 on Level 2.

Fire ratings:
- D-101: known, 60 min.
- D-102: known, 90 min.
- D-103: missing, reason `not-provided` (never surveyed).
- D-104: known, 20 min. `hasGeometry` is `false` (a record migrated without
  geometry) — it still appears in the schedule.
- D-201: known, 60 min.
- D-202: conflicting — one source says 60, another says 90 (two evidence
  records disagree; the workflow keeps both, does not average or pick one).
- D-203: missing, reason `not-measured` (scheduled for survey, not yet done).
- D-204: known, 45 min.

Expected schedule: 8 rows, one per door, in storey then name order, each
carrying its resolved `storey` and `room` (or `null`) names alongside the
raw `widthMm` and `fireRatingMinutes` observations.

Expected exceptions: 3 rows — D-103 (`missing`, `not-provided`), D-202
(`conflicting`, values `[60, 90]`), D-203 (`missing`, `not-measured`). D-101,
D-102, D-104, D-201 and D-204 are not exceptions because their fire rating is
known, regardless of `hasGeometry`.

## Assumptions

- Fire rating is the only exception axis for this workflow (width is
  informational only). State this so Track W does not add an unrequested
  width-exception rule.
- A door with no room link (`roomId: null`) is valid input, not an error;
  its schedule row simply shows no room.
- Schedule and exceptions preserve input row order as a tiebreak when
  storey/name are equal (not exercised in this fixture, since all names are
  distinct).
