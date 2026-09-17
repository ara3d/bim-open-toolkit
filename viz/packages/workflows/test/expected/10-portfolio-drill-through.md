# 10 — Portfolio comparison and drill-through

Brief section 6, row "Portfolio comparison": F26 linked results and
drill-through, F17 chosen snapshots. Required input: "Comparable metrics and
physical-building identities; source documents do not automatically equal
buildings."

## Input contract

| Table | Column | Type | Notes |
|---|---|---|---|
| `buildings` | `buildingId` | string | one physical building, the identity this workflow rolls up to |
| | `name` | string | |
| | `siteId` | string | which site/portfolio group it belongs to |
| `documents` | `documentId` | string | a source document (e.g. one model file, one report) |
| | `buildingIds` | string[] | which building(s) this document is understood to represent; empty means unresolved, more than one means ambiguous |
| `metrics` | `id` | string | metric record key |
| | `documentId` | string | FK to `documents` — metrics are reported per source document |
| | `metricName` | string | e.g. `"totalFloorAreaM2"` |
| | `value` | Observation of number, unit varies | the reported figure |

## Rules

The brief's constraint "source documents do not automatically equal
buildings" governs the join: a metric is never attributed to a building
just because it came from one document. The document must have an explicit,
unambiguous `buildingIds` mapping.

1. **Resolved metric** — a `metrics` row is attributed to a building when
   its `documentId` maps (via `documents.buildingIds`) to **exactly one**
   building, and `value` is `known`. The drill-through row carries the
   building, the document, the metric name and value.
2. **Unresolved building mapping** — a metric whose document has
   `buildingIds` empty (`[]`) or with more than one entry is an exception,
   reason `unresolved-source`; the metric is never guessed onto one of the
   candidate buildings or split between them.
3. **Unresolved value** — a metric whose `value` is `missing` or
   `conflicting` is an exception with that observation's own reason/values,
   independent of whether the document-to-building mapping is fine.
4. **Portfolio rollup** — for each `siteId`, sum the resolved values of one
   named metric (`metricName` supplied as a workflow parameter) across its
   buildings. A site whose every building's metric is unresolved gets no
   rollup row (never a `0`); a site with at least one resolved contributor
   reports the sum of only the resolved contributors, plus a count of how
   many buildings at that site were excluded as unresolved so the rollup is
   never mistaken for a complete total.

## Worked example (prose)

Metric requested: `"totalFloorAreaM2"`. Two sites, Site-A (buildings B-1,
B-2) and Site-B (building B-3).

Documents:
- DOC-1 → [B-1] (unambiguous).
- DOC-2 → [B-2] (unambiguous).
- DOC-3 → [B-1, B-2] (ambiguous — ironically also has a metric, but it's
  unresolved because of the mapping, not the value).
- DOC-4 → [] (unresolved — a document nobody has mapped to a building yet).
- DOC-5 → [B-3] (unambiguous).

Metrics:
- m1: DOC-1, totalFloorAreaM2, known 5,000.
- m2: DOC-2, totalFloorAreaM2, known 3,000.
- m3: DOC-3, totalFloorAreaM2, known 4,000 (unresolved: ambiguous document).
- m4: DOC-4, totalFloorAreaM2, known 2,000 (unresolved: no building
  mapped).
- m5: DOC-5, totalFloorAreaM2, conflicting (7,000 vs 7,500) (unresolved:
  value itself disputed).

Expected drill-through: 2 resolved rows — B-1 (5,000, via DOC-1), B-2
(3,000, via DOC-2).

Expected exceptions: 3 rows — m3 (`unresolved-source`, 2 candidate
buildings), m4 (`unresolved-source`, 0 candidate buildings), m5
(`conflicting`, values [7000, 7500]).

Expected portfolio rollup: Site-A = 5,000 + 3,000 = 8,000
(`resolvedBuildingCount: 2`, `excludedBuildingCount: 0` — both of Site-A's
buildings resolved through DOC-1/DOC-2; DOC-3's ambiguity doesn't reduce
B-1/B-2's own resolved counts, it just means DOC-3's own metric row is
separately unresolved). Site-B has no rollup row at all: B-3's only metric
(m5) is unresolved, so there is no resolved contributor
(`excludedBuildingCount: 1`, no `total`).

## Assumptions

- A building can have more than one document contributing metrics (not
  exercised numerically here beyond B-1/B-2 each having exactly one); when
  more than one resolved metric exists for the same building and metric
  name, this fixture does not need that case, so it is left as an open
  question for Track W (sum? most recent? both reported?) rather than
  guessed here.
- The portfolio rollup omits a site entirely when it has zero resolved
  contributors, rather than emitting a `0` or `null` total, consistent with
  "incomplete quantities never appear as zero."
