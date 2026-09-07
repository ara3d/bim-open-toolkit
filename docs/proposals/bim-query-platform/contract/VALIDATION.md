# Contract validation record

Executed 2026-09-06 on Windows with Python 3.13 and `jsonschema` 4.25.1.

```text
Ran 64 tests in 3.106s
OK
Valid: 23 table contracts, 31 roles, 20 workflows, 93 synthetic records.
```

All records in all 23 tables pass the Draft 2020-12 row schema and the applicable companion checks. All three schema documents pass schema validation. The semantic catalog and workflow document pass their respective schemas and cross-document checks. Eight workflow examples have checked expected answers.

## Reproduce

From the repository root, install the pinned review-only dependency into a virtual environment. This does not change any C# project:

```powershell
python -m venv artifacts/bim-contract-review-venv
./artifacts/bim-contract-review-venv/Scripts/python.exe -m pip install -r docs/proposals/bim-query-platform/contract/tests/requirements.txt
./artifacts/bim-contract-review-venv/Scripts/python.exe docs/proposals/bim-query-platform/contract/tests/validate_contract.py
./artifacts/bim-contract-review-venv/Scripts/python.exe -m unittest discover -s docs/proposals/bim-query-platform/contract/tests -v
```

The executed run used the equivalent pinned dependency already installed under `artifacts/bim-contract-draft/python` via `PYTHONPATH`. That install required a local permission boundary adjustment for the test process to read it; no project-wide Python environment or C# dependency was changed.

## Categories and selection

| Class/category | Cases | Purpose |
|---|---:|---|
| `DocumentsSmallReviewTests` | 4 | Document shapes, reference/field/role resolution and version drift |
| `ShapeSmallReviewTests` | 6 | Value-state exclusivity, units, required conditional evidence completeness, dates, misspelled fields and bounds dimensions |
| `SemanticsSmallReviewTests` | 18 | Cross-row integrity and selected domain constraints, including valid incomplete cases |
| `WorkflowSmallReviewTests` | 8 | Explicit expected outcomes of the worked examples |
| `GenerationSmallReviewTests` | 14 | Deterministic C# output, domain coverage, field propagation, typed references, name collisions, supported types and safe documentation |
| `DomainDesignSmallReviewTests` | 14 | Hierarchical backlog, priority matrix, bounded activation, existing-contract reuse and exact scenario support |

Every class is tagged by feature, size (`Small`) and maturity (`Review`) in its name. For a focused run, add e.g. `-k Semantics` or `-k Workflow` to the unittest command. Run the full small suite after a cross-cutting schema change; no large-data or performance category is claimed here. Do not rerun the existing C# system suite merely for these document changes.

## Domain-design backlog checks

The subsequent combined run passed all 64 tests. The backlog contains 45 proposals across 12 domains, with 8 active semantic design items. Its JSON matches the authoring CSV and policy, and passes its JSON Schema. Checks reject unknown roles/workflows, current-table and scenario references, duplicate candidates, incomplete priority rules and activation beyond the review budget. They also verify that reuse is not mistaken for a new model, cost alone cannot reduce value, extra role tags cannot inflate priority, and high-impact rare cases are not automatically low value.

Both backlog outputs were regenerated and checked. The C# generator freshness check passed; these candidate proposals do not alter the existing C# row contracts. No C# compilation or BOS performance rerun was required for the backlog addition. Ratings and the active selection remain review judgments, not measured user demand or proof of source feasibility.

## C# projection checks

The isolated .NET 8 compile project passed with the shared Platonic integration. Its positive execution checks typed keys, snapshot separation and available/missing measurement values. Three expected-failure builds rejected the wrong target table (`CS0029`), a missing snapshot-key wrapper (`CS0029`), and a deliberately mutable property (`PURE002`). A final ordinary build passed. After generator review fixes, the regenerated file compiled and ran again, and `generate_records.py --check` passed.

The domain formalism contains 12 domains, 66 concepts and 55 table/domain memberships covering all 23 tables. Each table has exactly one primary domain. Generator checks verify table/concept/domain references and retain undeveloped concepts as comments. [GENERATION.md](GENERATION.md) explains mappings and reproduction. These checks do not establish that the C# view is a lossless JSON serializer or a production runtime API.

## What is checked

- Catalog primary keys and foreign-key metadata refer to defined fields; table/row references match the model schema. Workflows name existing roles, fields, policies and tables, and step inputs are declared.
- Fixture primary keys are unique. Snapshot-scoped references cannot join a different delivery. Source records belong to a selected revision; source/reference evidence locators resolve within this fixture.
- Available locations reference spatial things, and poses match their frame dimensions. Frame parent chains are acyclic. Bounds have ordered corners and refer to the correct object's representation.
- Selected measurements are unique per snapshot, measurement subject, kind, basis and policy. Whole-object and part measurements can coexist; separate material parts can have independently selected masses.
- Physical quantity units and projected-area basis agree. Roof views cannot silently substitute projected area for net surface area. A projected selected roof fact agrees with its observation.
- Finish identities do not duplicate the same surface through multiple room associations. Available space associations resolve to spaces; unavailable associations can remain in the schedule.
- Priced lines require a selected quantity within the work package, a compatible rate unit and matching currency. Missing rate items are not fabricated.
- Calculated impact requires a selected compatible quantity and leaf contribution. A contribution cannot be counted twice for the same scenario/module by changing the factor line. Missing factors can remain unresolved.
- Reference sets have the expected kind. A structurally incomplete assessment cannot claim a pass.
- Example arithmetic gives 1320 CAD for the known roofing scope and 200 kgCO2e for one steel contribution. Two source representations do not multiply that contribution. MEP traversal in the example follows accepted connection/service edges and ignores proximity candidates.

## What remains unchecked

This is a small-fixture validator, not the production query engine. The catalog labels wider invariants `partially-checked` or `policy-required` where appropriate. A `companion-validator` label identifies a local implemented check, not proof of every real-world interpretation of its prose.

The tests do **not** establish source truth, exporter capabilities, actual identity reconciliation, quantity-selection authority, scope disjointness, validity of transforms, exact geometry, complete graph coverage, regulatory compliance, rate/factor applicability or lifecycle accounting completeness. They do not validate missing-data causes merely because someone wrote an evidence string. Reference items, scenario inputs and policy editions are not fully addressable in this draft.

General cost/impact computation, currency rounding, unit conversion and external factor matching are not implemented; arithmetic checks apply to the explicit simple examples. No pseudo-code interpreter is executed. Egress checks concern incomplete input reporting, not route finding or a compliance decision.

The fixture-pack wrapper and arbitrary scenario `expected` objects are test conventions, not additional public interchange contracts. The eight expected outputs are exercised by the tests. The production bundle, paging, aggregate/path/coverage responses and import mapping contracts are still to be designed.

No supplied BOS file was converted or loaded by these tests. No source-to-contract mapping or 10-second/16-GiB performance result is claimed. Those are separate prerequisites to accepting an implementation slice.
