# 05 — Delivery and installation timeline

Brief section 6, row "Delivery and installation": F21 timeline, F08 state
colors, F18 location markers. Required input: "Dated observations; delivered,
accepted and installed remain separate."

## Input contract

| Table | Column | Type | Notes |
|---|---|---|---|
| `objects` | `objectId` | string | equipment/material item tracked through procurement |
| | `name` | string | |
| `events` | `id` | string | event record key |
| | `objectId` | string | FK to `objects` |
| | `eventType` | string | `"delivered"` \| `"accepted"` \| `"installed"` |
| | `date` | Observation of string (ISO date) | when it happened |

An object can have zero, one, or more event rows (e.g. delivered and
accepted but not installed). There is one `asOfDate` parameter for the
workflow, supplied alongside the tables.

## Rules

The brief's requirement is that "delivered, accepted and installed remain
separate" — an object that is accepted must never display as "installed",
and an object with no data must never display as "delivered" by default.

1. **State ranking** — `installed` > `accepted` > `delivered` > `scheduled`
   (no known event yet). An object's timeline state as of `asOfDate` is the
   highest-ranked event type whose `date` is `known` and
   `date.value <= asOfDate`. A `missing` or `conflicting` date for an event
   type is treated as "that event's date is not usable," not as "the event
   happened on `asOfDate`."
2. **No regression through missing data** — if `installed.date` is known
   and in the past, the object's state is `installed` even if `accepted`
   has no event row at all; the missing intermediate step is reported as a
   separate coverage note (assumption: "gap" is informational, not blocking
   the higher state), not as a reason to demote the object to a lower
   state.
3. **Exceptions:**
   - an object with **no event rows at all** → exception, reason
     `not-provided` (nothing observed yet, not the same as "scheduled but
     confirmed on schedule").
   - an event with a **conflicting** date → exception; the event type's
     date is not used for ranking (rule 1 already excludes it), and the
     conflicting values are reported.
   - an event with a **known date after `asOfDate`** → not an exception;
     it simply does not count yet (future event, expected behavior of a
     timeline).
4. Only one state (F21 "distinct... states remain distinct") is emitted per
   object: the timeline table never lists an object as simultaneously
   "delivered" and "installed" — the emitted `state` is the single
   highest-ranked qualifying event, alongside the full list of known event
   dates for context.

## Worked example (prose)

`asOfDate` = `2026-06-01`. Eight objects:

- EQ-1: delivered 2026-01-10, accepted 2026-01-20, installed 2026-02-01 →
  state `installed`.
- EQ-2: delivered 2026-03-01, accepted 2026-03-10 (no installed event yet)
  → state `accepted`.
- EQ-3: delivered 2026-04-01 only → state `delivered`.
- EQ-4: installed date known as 2026-05-01, but no accepted event row at
  all (gap) → state `installed` (rule 2), with a coverage note that
  `accepted` was never observed.
- EQ-5: delivered date conflicting (two sources: 2026-01-05 vs 2026-01-08)
  → state `scheduled` (no other events), and an exception for the
  conflicting delivered date.
- EQ-6: no events at all → state `scheduled`, exception reason
  `not-provided`.
- EQ-7: delivered 2026-01-01, accepted 2026-01-15, installed date known but
  dated 2026-07-01 (after `asOfDate`) → state `accepted` (installed hasn't
  happened yet as of the as-of date).
- EQ-8: accepted 2026-02-01 directly, no delivered event row → state
  `accepted` (rule 2 gap logic applies the same way to a missing lower
  step), coverage note that `delivered` was never observed.

Expected timeline: 8 rows, one state per object as above.

Expected exceptions: 2 rows — EQ-5 (conflicting delivered date) and EQ-6
(no events at all).

## Assumptions

- A missing lower-ranked event (e.g. no `accepted` row while `installed` is
  known) is a coverage note attached to the timeline row, not a blocking
  exception — the higher state is still trustworthy evidence that the
  lower step also occurred, even though it wasn't separately recorded.
  Track W may prefer to demote instead; this fixture picks the
  non-demoting rule and states it as an assumption.
- A future-dated known event (after `asOfDate`) is normal timeline behavior,
  not an exception.
