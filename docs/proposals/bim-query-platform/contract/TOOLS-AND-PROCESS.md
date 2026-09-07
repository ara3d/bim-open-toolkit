# Tools, process and design approach

This guide describes the review contract and C# record generator as of 2026-09-06. It is a development workflow for defining useful building data, not a production BOS conversion or query pipeline. The [validation record](VALIDATION.md) reports completed checks; the [platform plan](../PLAN.md) describes the remaining implementation and performance work.

## What drives the design

Start with a person's question and the decision it supports. Define what one answer row means, which observations support it, and what happens when information is missing or contradictory. Only then choose fields, keys and a C# representation.

The catalog makes those decisions inspectable and mechanically checkable. It does not make the decisions automatically. Similar workflow vocabulary can conceal different measurement conventions: projected roof area and net roof surface area are distinct; two faces of one wall can have different finishes; two representations of one asset must not double its material count.

The subsequent [domain-design backlog](DOMAIN-DESIGN.md) adds practical model candidates, a value rubric and a bounded active queue. CSV owns the candidate descriptions and ratings; policy JSON owns the prioritization and active choices; a separate builder emits hierarchical JSON and a review queue. These proposals do not become C# classes until their actual row contracts are reviewed.

The model therefore combines shared identities and evidence with deliberately denormalized workflow schedules. Roles identify interests, not separate copies of objects or permissions. Domains organize the design; a table can contribute to several domains while appearing once in the generated file. Candidate concepts remain visible without pretending that their contracts are complete.

## Tools and their boundaries

| Tool or artifact | Role | Boundary |
|---|---|---|
| CSV catalogs | Compact authoring of domains, concepts, memberships and C# reference/name mappings | Do not duplicate field definitions already owned by JSON Schema |
| JSON Schema Draft 2020-12 | Defines row shapes, value alternatives and structural constraints | Does not establish source truth, foreign-key existence or correct domain arithmetic |
| Semantic and workflow JSON | Records grain, relationships, policies, questions and illustrative steps | Workflow pseudo-code is not an executable language |
| [Python generator](generate_records.py) | Reads seven explicit inputs and emits one deterministic, documented C# file | Standard library only; supports a bounded schema subset, not arbitrary JSON Schema |
| Python `unittest` and pinned `jsonschema` | Check documents, examples, selected semantics and generation | Small synthetic fixtures do not prove real-data mappings or large-data performance |
| .NET compile harness | Compiles and exercises the generated C# in an isolated .NET 8 project | Records are a review projection, not a serializer or dataset loader |
| Platonic.CSharp packages | Enforce immutable C# boundaries through the existing shared build integration | Analyzers apply to C#, not Python, CSV or JSON |
| Subagent critiques and review | Independently challenge grain, missing-data handling and implementation assumptions | Findings must become explicit decisions, examples or checks; critique alone is not validation |

Official schema references are linked in the [contract rationale](README.md). The broader architecture investigation compares embedded analytical storage, GIS, graph and lakehouse approaches; none is required by the generator.

## Authoritative inputs and generated outputs

Each concern has one editing home:

| Concern | Authoritative files |
|---|---|
| Domain and candidate-concept meaning | [domains.csv](domains.csv), [concepts.csv](concepts.csv) |
| Domain membership and primary presentation domain | [table_domains.csv](table_domains.csv) |
| Table grain, keys, relationships and semantic rules | [model.catalog.json](model.catalog.json) |
| Fields, value shapes and structural constraints | [model.schema.json](model.schema.json) |
| Explicit singular record names and nested reference meanings | [records.csv](records.csv), [references.csv](references.csv) |
| User decisions, inputs and illustrative workflow steps | [workflows.json](workflows.json) |
| Worked examples and expected answers | [examples/scenarios.json](examples/scenarios.json), [tests](tests) |

The first five rows contain the generator's seven inputs. [catalog.schema.json](catalog.schema.json) and [workflows.schema.json](workflows.schema.json) validate the two corresponding authoring documents.

[generated/BimDataModel.cs](generated/BimDataModel.cs) is output: do not edit it independently. Its header records the contract version and input fingerprint. Generation introduces no timestamp or machine-specific path. Workflow JSON and examples are checked alongside the inputs but do not mechanically generate table definitions.

The CSV domain catalog currently describes 12 domains and 66 concepts, with 55 table/domain memberships covering 23 table contracts. These are draft coverage counts, not implemented BOS mappings. JSON remains appropriate for nested facts and constraints; CSV keeps flat inventories readable without adding a second schema definition.

## A repeatable iteration

1. **Choose a question.** Identify the user, scope and intended decision in the workflow catalog. Make missing-information behavior part of the answer.
2. **State the grain.** Write what one row represents and how it is counted. Separate stable object identity, snapshot descriptions, source records and geometric representations.
3. **Construct an awkward example.** Include alternatives, missing values or overlapping responsibilities. For a roofing estimate, retain the unmeasured roof rather than returning a complete-looking subtotal.
4. **Revise the authoritative definitions.** Update domain coverage, catalog semantics and row shapes together where needed. Keep unresolved policy choices explicit. Add or change a useful regression case.
5. **Generate and inspect the C#.** Review the domain comments, constructor fields and typed keys as another view of the same definitions. A surprising signature often exposes an unclear reference or value shape.
6. **Run focused checks, then affected integration checks.** Use categories to avoid unnecessary large-system testing. Run the full small review suite after a cross-cutting contract change; compile after changes affecting generated C#.
7. **Review independently.** Challenge an answer with a counterexample and record the resulting change or limitation. Update the validation record only for commands actually executed.

Important facts distinguish available values from unavailable states with reasons and evidence. Unknown is not zero; unknown position is not the project origin; an incomplete export cannot establish that a service connection is absent. The Revit-derived corpus is the preferred semantic investigation reference according to the user, while the IFC corpus stresses federation and imperfect exports. Neither is automatically authoritative for every field.

## Generate and verify

Run from the repository root. Generation itself needs only Python:

```powershell
python docs/proposals/bim-query-platform/contract/generate_records.py
python docs/proposals/bim-query-platform/contract/generate_records.py --check
python -m unittest discover -s docs/proposals/bim-query-platform/contract/tests -p test_generator.py -v
```

`--check` rejects missing or stale output without writing it. Unsupported shapes, ambiguous mappings and naming collisions fail rather than silently becoming `object` or `dynamic`. XML documentation is escaped, and multiline descriptions remain comments.

For contract validation, use an isolated environment with the pinned review dependency:

```powershell
python -m venv artifacts/bim-contract-review-venv
./artifacts/bim-contract-review-venv/Scripts/python.exe -m pip install -r docs/proposals/bim-query-platform/contract/tests/requirements.txt
./artifacts/bim-contract-review-venv/Scripts/python.exe docs/proposals/bim-query-platform/contract/tests/validate_contract.py
./artifacts/bim-contract-review-venv/Scripts/python.exe -m unittest discover -s docs/proposals/bim-query-platform/contract/tests -v
```

Test classes carry independent feature, size and maturity categories in their names: `Documents`, `Shape`, `Semantics`, `Workflow` and `Generation`, all `Small` and `Review`. Add `-k Workflow`, for example, to select that feature. The recorded run has 50 passing tests, 93 synthetic records across all 23 tables, and eight checked workflow answers. This document does not record a new test run.

For C# integration:

```powershell
dotnet restore docs/proposals/bim-query-platform/contract/tests/csharp/RecordContract.CompileTests.csproj
python docs/proposals/bim-query-platform/contract/tests/check_csharp.py
```

The harness references the [generated review library](generated/Ara3D.BimOpenSchema.QueryModel.Review.csproj). Both import [Platonic.props](../../../../tools/bim-data-model/Platonic.props), reusing built `Platonic.Core` and `Platonic.Analyzers` packages at version 0.1.0 from the sibling checkout or a configured package source/cache. They do not copy Platonic source. See the [integration summary](../../../../src/Ara3D.BimOpenSchema.DataModel/PLATONIC-INTEGRATION.md) for package configuration and enforcement limits.

The compile script checks a successful execution, then three expected failures: a key targeting the wrong table (`CS0029`), a global key where a snapshot key is required (`CS0029`), and a mutable property (`PURE002`). It finishes with a normal successful build and stores logs under `artifacts/bim-contract-records`. The generated source is included in analyzer checks; only the test console boundary is marked `[Impure]`. These checks are recorded as passed in VALIDATION.md.

## What review and dogfooding changed

Concrete examples and independent critique led to explicit measurement scopes for material parts, spatial bounds for candidate queries, unavailable room associations for finishes, and nullable unmatched rate/factor locators. A review finding added verification that an estimate's quantity belongs to its work package. These changes protect answers from plausible-looking omissions and double counting.

Generator review and regression cases cover wrong reference scope, incompatible reference field types, record/enum name collisions, unbounded integer mapping and documentation escaping. `ReferenceKey<T>` and `SnapshotReferenceKey<T>` make relationship intent visible to C# readers and catch some mistakes at compilation. They do not prove that a referenced row exists. Shared facts become immutable alternatives, and exact decimal text remains explicit rather than assuming a storage precision.

## What remains proposed

The record projection is not lossless JSON serialization: optional absence collapses to null, constructors do not enforce every schema constraint, and immutable-array equality is not elementwise value equality. General unit conversion, rate/factor applicability, scope disjointness, identity reconciliation and complete query-result coverage need further contracts and implementation.

No supplied BOS file was converted or loaded by these contract tests. The proposed BFAST caches, production semantic mapping, graph/spatial indexes and backend choices remain separate work. The acceptance target is still prepared open **plus the first useful query within 10 seconds**, using at most **16 GiB** for the process and workers including resident mapped pages on a 32 GiB workstation. One-time conversion/preparation is measured separately. The earlier prototype's real-sample tests do not establish those redesigned-system guarantees.
