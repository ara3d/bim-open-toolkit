# A data-driven design and its C# review view

The catalog is an appropriate place to describe domains, concepts, row meaning and relationships as data. These definitions are useful to reviewers, generators and eventually SQL/API adapters. Decisions about identity, measurement authority, scope overlap and useful workflows still require examples and human judgment. A catalog can record those decisions and expose inconsistencies; it cannot decide them by itself.

The generated C# is a **readable projection of the proposed contract**. It does not commit the project to loading these records at runtime. Read [generated/BimDataModel.cs](generated/BimDataModel.cs) to see all 23 currently defined table records, their shared value types, and the domain/concept commentary in one source file.

See [Tools, process and design approach](TOOLS-AND-PROCESS.md) for the complete authoring, review, generation and validation workflow.

For recognizable domain models that are not yet defined, use the [domain-design queue](DOMAIN-QUEUE.md). Its hierarchical backlog and priority method are described in [DOMAIN-DESIGN.md](DOMAIN-DESIGN.md). That backlog is separate from the accepted row-shape inputs below; a brainstorm does not generate a C# class.

## Editable inputs

| Input | Authoritative information |
|---|---|
| [domains.csv](domains.csv) | The 12 domains and their meanings from PLAN.md |
| [concepts.csv](concepts.csv) | All 66 candidate concepts, their meanings, coverage status and links to existing table contracts |
| [table_domains.csv](table_domains.csv) | Table/domain membership; each table has one primary domain for presentation and may belong to others |
| [model.catalog.json](model.catalog.json) | Row grain, primary/foreign keys, workflow associations and semantic rules |
| [model.schema.json](model.schema.json) | Table fields, required/nullable states, shared value shapes and structural constraints |
| [records.csv](records.csv) | Explicit singular C# names for the table records; avoids guessing how to singularize names |
| [references.csv](references.csv) | Typed reference meanings inside shared/nested value shapes that are not expressed by the catalog's top-level foreign keys |

The new domain formalism uses CSV for tabular information. Richer field definitions remain in the existing JSON Schema in this iteration; there is no second independently edited `fields.csv`. A later migration to such a file should replace the relevant authoring source and generate the corresponding JSON, rather than duplicate it.

CSV concept statuses mean **represented in the draft**, **partially represented**, or **candidate without a complete row contract**. None means implemented against BOS. There are 14 represented, 46 partial and 6 candidate concepts. For example, a generic object kind can partially represent a storey without yet defining its elevation conventions or a useful storey schedule. A candidate concept becomes commentary in the generated file, not an empty class that implies a finished design.

The same table may contribute to multiple domains; a physical roof must not gain a second identity because it is used in environmental analysis. Primary membership only chooses where its record appears in the source file. Two domain-scoped concepts named Connections remain distinct: structural connections and service connectivity do not become equivalent because their names match.

## Mechanical mapping

The standard-library Python [generator](generate_records.py) reads these inputs, checks their references and emits a single deterministic C# file. It deliberately supports this contract's schema subset. Unsupported type alternatives, name collisions and incompatible reference shapes fail instead of becoming `object` or `dynamic`.

| Contract feature | C# review representation |
|---|---|
| Table / object value | `sealed record`, with required constructor parameters and XML documentation |
| Global reference or local key component | `ReferenceKey<T>` |
| Reference to a snapshot-scoped row | `SnapshotReferenceKey<T>`, containing snapshot ID and local key text |
| Complete row key | Generated `Key` property typed to that row's record |
| Repeated values | `ImmutableArray<T>` |
| Available/unavailable fact alternatives | Closed `Fact<T>` record hierarchy: `Available` or `Missing` |
| Typed property scalar alternatives | Closed `ScalarValue` record hierarchy |
| String/integer enums | Named C# enums; comments retain exact contract values |
| Constant field | Read-only property with the schema constant, not a constructor argument |
| Explicit nullability or optional property | Nullable C# value; optional JSON absence is collapsed to null in this review view |
| Exact decimal string | `DecimalText`, preserving text without assuming a fixed numeric precision |
| Unbounded JSON integer | `BigInteger` |

For example, a coordinate frame's optional parent is:

```csharp
SnapshotReferenceKey<CoordinateFrame>? ParentFrameId
```

An available or unresolved room association in a finish row is:

```csharp
Fact<SnapshotReferenceKey<ObjectState>> Space
```

The semantic validator still checks that an available target is a space. `ObjectState` itself has a global `ReferenceKey<BimObject> ObjectId` and a `ReferenceKey<Snapshot> SnapshotId`; its generated `Key` combines them into a `SnapshotReferenceKey<ObjectState>`. This preserves the distinction between a thing's identity and its description in a delivery.

These keys do not dereference data or create a navigable heap graph. Constructors do not enforce foreign-key existence, matching snapshot context, target kind or nonempty IDs. Arrays do not become validated geometries; `ImmutableArray` equality does not imply element-by-element equality. JSON Schema constraints and semantic policies remain separate from this representation. The file is not directly JSON-wire-compatible and has no serializer or runtime model loader.

## Regenerate and check

From the repository root:

```powershell
python docs/proposals/bim-query-platform/contract/generate_records.py
python docs/proposals/bim-query-platform/contract/generate_records.py --check
python -m unittest discover -s docs/proposals/bim-query-platform/contract/tests -p test_generator.py -v
```

Generation uses only Python's standard library. `--check` fails if the output is missing or stale and never writes it. The source header records the contract version and a fingerprint of all seven input files; no timestamp or machine-specific path changes the output. Do not edit the generated C# independently.

The generator itself is intentionally a development tool. Its IO is confined to loading explicit inputs and writing the chosen output. It is not part of the dataset open path and has no bearing on the 10-second or 16-GiB targets.

## Compilation, Platonic and tests

The [review library](generated/Ara3D.BimOpenSchema.QueryModel.Review.csproj) compiles the generated C# in place and produces XML documentation. Open that project directly in Visual Studio, or open [BimBuildingModel.sln](../../../../BimBuildingModel.sln) to browse it alongside the newer authored building model. The solution keeps the earlier contract in its own folder; the libraries are independent versions, not interchangeable bindings.

An isolated [compile-test project](tests/csharp/RecordContract.CompileTests.csproj) references the review library. Both projects import the existing `tools/bim-data-model/Platonic.props`, reusing the sibling Platonic packages without copying or modifying their code. The generated source uses immutable records, readonly record structs and immutable collections. It has no mutable-kernel or impurity exemption. Only the test program's console entry point is marked `[Impure]`. Builds do not regenerate the source or require Python; run `generate_records.py --check` separately to verify freshness.

The generated file has neither a `.g.cs` suffix nor an auto-generated exclusion marker, so analyzer checks apply. A negative build that deliberately introduces a set accessor must report `PURE002`; this verifies that Platonic is active. Other negative builds verify that the compiler rejects a key for the wrong table and rejects a global object key where a snapshot-scoped row key is required.

```powershell
dotnet restore docs/proposals/bim-query-platform/contract/tests/csharp/RecordContract.CompileTests.csproj
python docs/proposals/bim-query-platform/contract/tests/check_csharp.py
```

The compile script performs a positive runtime check, three expected-failure builds, and a final normal build. Logs go to `artifacts/bim-contract-records`. Tests have independent feature (`Generation` / `Compilation`), size (`Small`) and maturity (`Review`) categories. See [VALIDATION.md](VALIDATION.md) for executed results and the broader contract tests.
