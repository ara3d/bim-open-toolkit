# 09 — Material carbon

Brief section 6, row "Material carbon": F08 heat maps, F14 scenario
comparison, F17 saved context. Required input: "Compatible factor
units/lifecycle scope and explicit unresolved contributions."

## Input contract

| Table | Column | Type | Notes |
|---|---|---|---|
| `quantities` | `objectId` | string | one row per object with a material quantity |
| | `materialId` | string | FK to `factors` (join key, not a table on its own) |
| | `quantity` | Observation of number, unit varies | e.g. unit `"kg"` or `"m3"` |
| `factors` | `id` | string | factor record key |
| | `materialId` | string | which material this factor applies to |
| | `scenario` | string | `"asDesigned"` \| `"lowCarbonAlt"` in this fixture |
| | `unit` | string | the unit the factor expects (must match `quantity`'s unit) |
| | `lifecycleScope` | string | e.g. `"A1-A3"`, `"A1-A5"` — must match the requested scope |
| | `factorValue` | number | kgCO2e per unit |

The workflow parameter is `requestedLifecycleScope` (one scope requested
per run, e.g. `"A1-A3"`), and `scenario` (which scenario to price against).

## Rules

"Explicit unresolved contributions" (rather than dropping or zeroing them)
governs every branch below:

1. A quantity's carbon contribution is computed as
   `quantity.value * factor.factorValue` only when all of these hold:
   `quantity` is `known`; a factor exists for `materialId` + `scenario`;
   `factor.unit === quantity.unit`; `factor.lifecycleScope ===
   requestedLifecycleScope`.
2. **Unresolved, reason `not-provided`** — no factor exists at all for that
   `materialId`/`scenario` pair.
3. **Unresolved, reason `unresolved-source`** — a factor exists for that
   `materialId`/`scenario` but either its `unit` doesn't match the
   quantity's unit, or its `lifecycleScope` doesn't match
   `requestedLifecycleScope`. Both are unit/scope mismatches in the sense
   the brief means; they are never converted or substituted.
4. **Unresolved, quantity-driven** — when `quantity` itself is `missing` or
   `conflicting`, the contribution is unresolved with that observation's
   own `kind`/`reason`, regardless of whether a matching factor exists.
5. Each scenario is computed independently (F14); the same object can
   resolve in one scenario and be unresolved in another (e.g. a low-carbon
   alternative material has no factor yet).
6. **Total known kgCO2e** is the sum of resolved contributions only, always
   reported alongside — never merged with — the count of unresolved
   contributions.

## Worked example (prose)

Requested scope: `"A1-A3"`. Three objects:

- OBJ-1: concrete, 10 m³ (known).
- OBJ-2: steel, 500 kg (known).
- OBJ-3: timber, quantity conflicting (2.5 vs 3.0 m³).

Factors, `asDesigned` scenario:
- concrete/asDesigned: unit `m3`, scope `A1-A3`, factor 300 → resolves:
  10 × 300 = 3,000 kgCO2e.
- steel/asDesigned: unit `kg`, scope `A1-A5` (wrong scope, requested is
  `A1-A3`) → unresolved, `unresolved-source`.
- (no timber factor in `asDesigned`.)

Factors, `lowCarbonAlt` scenario:
- concrete/lowCarbonAlt: unit `m3`, scope `A1-A3`, factor 180 → resolves:
  10 × 180 = 1,800 kgCO2e.
- steel/lowCarbonAlt: unit `t` (tonnes, quantity is in `kg`), scope
  `A1-A3` → unresolved, `unresolved-source` (unit mismatch).
- (no timber factor in `lowCarbonAlt` either.)

OBJ-3 (timber) is unresolved in both scenarios regardless of factors,
because its own quantity is conflicting.

Expected resolved contributions: asDesigned → OBJ-1 only (3,000 kgCO2e,
total known 3,000). lowCarbonAlt → OBJ-1 only (1,800 kgCO2e, total known
1,800).

Expected exceptions: 4 rows — OBJ-2/asDesigned (`unresolved-source`, scope
mismatch), OBJ-3/asDesigned (`conflicting`, quantity), OBJ-2/lowCarbonAlt
(`unresolved-source`, unit mismatch), OBJ-3/lowCarbonAlt (`conflicting`,
quantity).

## Assumptions

- Only one lifecycle scope is requested per run; comparing two scopes in
  one pass is out of scope for this fixture (not requested by the brief
  text, which asks for scenario comparison, not scope comparison).
- A missing factor and a wrong-unit/wrong-scope factor are both
  "unresolved," distinguished only by `reason` (`not-provided` vs
  `unresolved-source`), never by silently trying a different factor.
