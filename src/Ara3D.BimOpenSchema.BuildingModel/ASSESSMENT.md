# Building model assessment — 2026-09-07

The project is a substantial, compilable semantic model with useful workflow examples. It is ready for domain review and a first source-mapping experiment. It is not yet an end-to-end building-data implementation. The next investment should be a narrow workflow using real BOS data, followed by validated persistence, before expanding the catalog further.

## What exists

Three related efforts currently have different responsibilities:

| Effort | Current role | Boundary |
|---|---|---|
| [BuildingModel](Ara3D.BimOpenSchema.BuildingModel.csproj) | Authored C# records for building concepts, evidence, quantities, workflow observations and results | Its C# files are authoritative; the earlier generator does not produce them. |
| [Generated review contract](../../docs/proposals/bim-query-platform/contract/generated/Ara3D.BimOpenSchema.QueryModel.Review.csproj) | Earlier 23-table JSON/catalog projection into C# | Separate namespace and semantics; not a binding for the expanded building model. |
| [DataModel](../Ara3D.BimOpenSchema.DataModel/README.md) and DataModel.IO | BOS conversion, generic query snapshots and serialization/database projections | Their projects do not reference BuildingModel. Existing IO does not serialize or populate these domain records. |

The new [BimBuildingModel.sln](../../BimBuildingModel.sln) brings the building model, its tests, the generated review library and its compile harness into one conventional Visual Studio solution. The generated library compiles the source in place, includes future C# files in that directory through SDK defaults, and emits XML documentation. Generation remains explicit, so building does not require Python or modify source files. Both model projects retain the shared Platonic analyzer configuration.

## What is working well

- **Identity has useful structure.** `ReferenceKey<T>` separates table identities, while `SnapshotKey<T>` includes the snapshot. The tests demonstrate that equal local identifiers in different snapshots do not collide. `ElementInfo.ObjectId` connects facets of one physical thing without making each facet a separate purchased item.
- **Incomplete evidence is represented directly.** `Fact<T>`, `LinkSet<T>` and coverage states distinguish unavailable data from known zero, false or an empty complete inventory. Tests exercise partial totals and unsupported conclusions.
- **Domain fields carry meaning.** Roof surface area differs from projected area; received quantities differ from installation observations; shared supports and penetrations have their own counting scopes. Unit wrappers improve discoverability.
- **Geometry has an explicit boundary.** Frames, prototypes and transforms are represented; payloads are externally addressed. Bounds are documented as candidate filters rather than proof of solid intersection.
- **The examples help review semantics.** The coverage test connects all 45 workflow candidates to compiled types. Other tests exercise joins and accounting distinctions. That is useful coverage of design intent, although it does not measure field-level source coverage.

## Gaps that matter next

1. **No source-to-domain path.** The existing `BimModelConverter` produces the generic DataModel, not BuildingModel. A successful build cannot establish that a Revit or IFC export supplies these fields, units, identities or relationships.
2. **Validation is deliberately partial.** `ModelChecks` has six validation overloads covering selected estimate, spatial, trace and assessment rules. It does not validate a dataset. For example, `default(ReferenceKey<T>)` bypasses constructor checks, dimensional wrappers accept nonfinite values, and a typed foreign key does not prove its target exists. Duplicate IDs, cross-snapshot links, invalid enum values, default immutable arrays and contradictory spatial associations need explicit import-boundary checks.
3. **Persistence and evolution are undecided.** `Fact<T>` and `PropertyValue` need explicit serialization tags; references need stable encodings. Global material/evidence identities need a documented revision policy so a later import cannot silently change the meaning of an earlier snapshot. The newer model and older JSON contract have no synchronization path.
4. **Breadth exceeds implementation depth.** An egress result or impact summary is a result shape, not a solver. Most workflow examples use synthetic records and local query expressions. Missing-field behavior should also be exercised through an actual importer and persisted dataset.
5. **Scale is unmeasured for this model.** Nested facts and immutable collections are reasonable for bounded results but could be costly when materializing a portfolio. The ten-second prepared-open target and 16 GiB memory budget are requirements, not current measurements.
6. **Reproducibility needs a repository milestone.** These model, contract and tooling directories were already untracked at assessment time. The build also depends on Platonic 0.1.0 packages supplied by a sibling checkout or configured feed/cache. A clean-checkout build and a focused CI job are needed before treating this as a shared baseline.

## Recommended next milestones

| Order | Deliverable | Acceptance criterion |
|---|---|---|
| 1 | Room-and-door schedule from one representative Revit-produced BOS file | Map identities, storeys, spaces, doors, dimensions and evidence. Publish populated/missing/conflicting counts per field, inspect representative rows against the source, and preserve unresolved room associations. Record exporter version and unit-conversion rules. |
| 2 | Validation boundary for that slice | Reject or report duplicate/default keys, nonexistent targets, cross-snapshot references, nonfinite dimensions and invalid state combinations. Add malformed import fixtures; return structured diagnostics without silently dropping the affected scope. |
| 3 | Versioned persistence for the same slice | Round-trip known zero, missing reasons, evidence, keys and relationship completeness. Reopen the saved dataset and obtain the same schedule. Select one initial format; avoid implementing several backends at once. |
| 4 | Selective loading and measurement | Run the schedule against representative large prepared data; record preparation time, opening plus first-query latency, peak memory and data size. Keep geometry loading optional and hydrate only the requested results. |
| 5 | Authority and generation decision | Keep authored C# authoritative during the experiment. Once mappings stabilize, choose whether to derive other artifacts from C# or adopt a shared schema. Identify which older prototype contracts should be retired or migrated. |

The first milestone should reuse the existing BOS decoding/query infrastructure where its semantics fit. Keep source interpretation in an adapter and building definitions in the pure model library. Additional domains should follow concrete source or workflow requirements exposed by this experiment.

## Verification performed

- `dotnet build BimBuildingModel.sln`: all four projects built; zero warnings and zero errors, with the shared analyzer imports enabled.
- BuildingModel test project: 40 passed, zero failed, zero skipped.
- `generate_records.py --check`: generated C# matches its contract inputs.
- `tests/check_csharp.py`: positive execution passed; wrong-table and wrong-snapshot keys were rejected with `CS0029`; the mutation probe was rejected with `PURE002`; the final normal build passed.

These checks used the installed .NET 10.0.400 SDK and targeted .NET 8. NuGet restore required network access outside the restricted sandbox. Visual Studio UI behavior, real BOS mapping and performance were not exercised in this assessment. Changes are retained locally alongside the existing uncommitted work; no unrelated source baseline was staged or published.
