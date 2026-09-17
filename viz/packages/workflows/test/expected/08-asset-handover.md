# 08 — Asset handover and maintenance

Brief section 6, row "Asset handover and maintenance": F18 points of
interest, F19 notes, F11 location aids. Required input: "Asset records and
service history; load geometry only when useful."

## Input contract

| Table | Column | Type | Notes |
|---|---|---|---|
| `assets` | `objectId` | string | one equipment asset |
| | `name` | string | |
| | `category` | string | e.g. `"Pump"`, `"AHU"` |
| | `installDate` | Observation of string (ISO date) | when installed |
| `maintenanceEvents` | `id` | string | maintenance record key |
| | `assetId` | string | FK to `assets` |
| | `date` | string | always known — a recorded event has a date by construction |
| | `note` | string | free text |
| `serviceHistoryStatus` | `assetId` | string | FK to `assets` |
| | `status` | string | `"recorded"` \| `"not-recorded"` — whether service history was ever tracked for this asset, independent of whether any events exist |

## Rules

The brief's phrase "Incomplete quantities never appear as zero" (F26)
applies directly here: an asset with zero rows in `maintenanceEvents` must
not be reported the same way whether its history was tracked-and-empty or
never-tracked-at-all. That distinction is carried by
`serviceHistoryStatus`, a separate table from the count itself:

1. **Handover row** — one row per asset: its identity fields, an
   `eventCount` (a plain count of its `maintenanceEvents` rows — this is a
   count of known records, not itself an Observation), and `lastServiceDate`
   (the maximum `date` among its events, or `null` if `eventCount` is 0).
2. **Missing install date** — exception, reason from the `installDate`
   observation (`missing`/`conflicting`), always reported regardless of
   maintenance history.
3. **Untracked service history** — when `serviceHistoryStatus.status` is
   `"not-recorded"` for an asset, that asset is an exception (reason
   `not-provided`) even if `eventCount` happens to be 0 — "never tracked" is
   reported distinctly from "tracked, zero events so far," and the handover
   row's `lastServiceDate` stays `null` either way (never guessed).
4. An asset with `serviceHistoryStatus.status === "recorded"` and
   `eventCount === 0` is **not** an exception — a genuinely empty, tracked
   history is a legitimate known fact ("recorded: no service needed yet"),
   consistent with "incomplete quantities never appear as zero" cutting the
   other way too: a real zero must be allowed to stand once its provenance
   is known.

## Worked example (prose)

Five assets:

- A-1: install date known, 3 maintenance events, history status
  `"recorded"` → handover row with `eventCount: 3`, `lastServiceDate` = the
  latest of the three dates.
- A-2: install date known, 0 maintenance events, history status
  `"recorded"` → handover row with `eventCount: 0`, `lastServiceDate: null`;
  not an exception (rule 4).
- A-3: install date known, 0 maintenance events, history status
  `"not-recorded"` → handover row with `eventCount: 0`,
  `lastServiceDate: null`; exception (rule 3, reason `not-provided`).
- A-4: install date missing (reason `not-provided`), 2 maintenance events,
  history status `"recorded"` → handover row still produced with the known
  events; exception for the missing install date.
- A-5: install date known, 1 maintenance event, history status
  `"recorded"` → handover row with `eventCount: 1`.

Expected handover rows: 5 (one per asset, always produced regardless of
exceptions).

Expected exceptions: 2 — A-3 (untracked service history) and A-4 (missing
install date).

## Assumptions

- `eventCount` is a plain integer, not an Observation, because a
  maintenance-events table row only exists when an event is actually
  recorded; "how many rows are there" is always answerable. What can be
  missing is whether the *absence of rows* means "none happened" or "never
  tracked," which is exactly what `serviceHistoryStatus` disambiguates.
- Geometry is not part of this fixture's input tables at all, matching
  "load geometry only when useful" — the handover recipe here is
  data-only.
