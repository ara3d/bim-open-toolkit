# 04 — Pricing alternatives

Brief section 6, row "Pricing alternatives": F08 cost/unpriced scope, F14
scenarios, F17 reproducibility. Required input: "Rates, currency, quantities
and scenario policy supplied by the workflow."

## Input contract

| Table | Column | Type | Notes |
|---|---|---|---|
| `scopes` | `objectId` | string | one row per priceable scope item |
| | `scopeType` | string | e.g. `"Doors"`, `"Carpet"` |
| | `quantity` | Observation of number, unit varies | e.g. unit `"ea"` or `"m2"` |
| `rates` | `id` | string | rate record key |
| | `scopeType` | string | which scope type this rate prices |
| | `scenario` | string | e.g. `"base"`, `"alternate"` |
| | `currency` | string | e.g. `"USD"` |
| | `unit` | string | must match the scope's quantity unit for the rate to apply |
| | `ratePerUnit` | number | price per unit, in `currency` |
| `scenarios` | `id` | string | `"base"` \| `"alternate"` in this fixture |
| | `name` | string | display name |

## Rules

The brief does not define exactly how a rate is matched to a scope; this
file states the simplest join consistent with "unpriced scope visible":

1. A scope is priced under a scenario when exactly one rate exists whose
   `scopeType` matches the scope's `scopeType`, whose `scenario` matches,
   and whose `unit` matches the scope's known `quantity` unit. The price is
   `quantity.value * ratePerUnit`, reported in the rate's `currency`.
2. **Unpriced, reason `not-provided`** — no rate exists for that
   `scopeType`/`scenario` pair. The scope is listed with its scenario name
   and no cost, never `0`.
3. **Unpriced, reason `unresolved-source`** — a rate exists for the
   `scopeType`/`scenario` but its `unit` does not match the scope's known
   quantity unit (e.g. rate is per `m2`, scope quantity is in `ea`). This is
   treated the same as "no usable rate," not silently converted.
4. **Unpriced because the quantity itself is not known** — when
   `quantity` is `missing` or `conflicting`, the scope is unpriced
   regardless of whether a rate exists, with that observation's own
   `kind`/`reason` carried through (not `not-provided`, so a reader can
   tell "no rate" apart from "no quantity").
5. Each scenario is priced independently and reported as its own set of
   rows (F14 "scenarios"); the same scope can be priced in one scenario and
   unpriced in another.

## Worked example (prose)

Three scopes: Doors (12 `ea`, known), Carpet (120 `m2`, known), Paint
(quantity missing, reason `not-measured`).

Rates:
- base/Doors: 150 USD/ea.
- base/Carpet: 20 USD/m2.
- alternate/Doors: 175 USD/ea.
- alternate/Carpet: 5 USD/ea (unit mismatch — Carpet's quantity is in m2).
- (no Paint rate in either scenario.)

Base scenario: Doors priced 12 × 150 = 1,800 USD. Carpet priced
120 × 20 = 2,400 USD. Paint unpriced (`missing`, `not-measured`).

Alternate scenario: Doors priced 12 × 175 = 2,100 USD. Carpet unpriced,
reason `unresolved-source` (unit mismatch: rate is per `ea`, quantity is in
`m2`). Paint unpriced (`missing`, `not-measured`, same reason as base since
scenario doesn't change the missing quantity).

Expected priced rows: 3 (base/Doors, base/Carpet, alternate/Doors).
Expected exceptions: 3 (base/Paint, alternate/Carpet, alternate/Paint).

## Assumptions

- Exactly-one-matching-rate is required; if more than one rate matched the
  same scope/scenario/unit (not exercised here), that would itself be an
  ambiguous-rate exception — out of scope for this fixture since the brief
  does not mention rate conflicts explicitly, but flagged for Track W.
- Currency is not converted; a cost is reported together with the currency
  it was priced in, and mixed currencies across scenarios are allowed
  (not exercised in this fixture — both scenarios use USD).
