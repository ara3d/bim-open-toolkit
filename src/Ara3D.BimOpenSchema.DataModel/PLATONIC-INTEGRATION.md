# Platonic.CSharp integration summary

Platonic.CSharp is integrated as an enforced build dependency and a guide to the model's architecture.
The BIM model consumes the existing `Platonic.Core` and `Platonic.Analyzers` packages from the sibling
checkout. Its immutable conversion/query core is separated from explicitly effectful IO adapters.
No Platonic source was copied or modified, and existing BIM projects were not retrofitted with its rules.

## How the dependency is connected

The three new projects import a shared [Platonic.props](../../tools/bim-data-model/Platonic.props):

| Project | Role under the rules |
|---|---|
| `Ara3D.BimOpenSchema.DataModel` | Conversion, immutable tables, graph/spatial indexes and queries |
| `Ara3D.BimOpenSchema.DataModel.IO` | File/database boundary with explicit exemptions |
| `Ara3D.BimOpenSchema.DataModel.Tests` | Behavioral verification; fixtures explicitly allow effects and mutation |

The props file references both packages at version **0.1.0**, enables nullable analysis and treats
warnings as errors. The specific NuGet vulnerability warnings `NU1901`–`NU1904` remain warnings,
following Platonic's build settings. The analyzer reference has `PrivateAssets="all"`: consuming
the model package does not impose this analyzer policy on the consumer's own code.

By default, restore adds `../Platonic.CSharp/artifacts` as a package source, resolving here to
`C:/Users/cdigg/git/Platonic.CSharp/artifacts`. `PlatonicRoot` and `PlatonicVersion` are overridable
MSBuild properties. A configured feed or the NuGet cache can also supply those packages. If the
packages are unavailable, restore fails; the integration does not silently turn off the analyzers.

This uses **built packages**, not project references to Platonic's source. Editing its source alone
will not update the rules used here: rebuild/package the change, preferably under a new version,
and update the version consumed by these projects. The existing BOS dependency is outside the
scope of the new analyzer configuration. The new projects target .NET 8; verification used the
.NET 10.0.301 SDK available with the Platonic checkout.

## Rules that shape the implementation

All twelve analyzers are supplied by the package and enabled; there is no selected-rule subset.

| Rules | Effect on the model |
|---|---|
| `PURE001`–`PURE004` | Permitted immutable type shapes, get/init properties, readonly fields, sealed concrete types |
| `PURE005`–`PURE006` | No mutation of member state after construction and no event declarations |
| `PURE007`–`PURE009` | Restricted mutable collection boundaries, unsafe/dynamic code and reflection |
| `PURE010`–`PURE011` | Explicit effect boundaries; expected data problems represented in results rather than arbitrary exceptions |
| `PURE012` | No mutable collections held in fields or automatically implemented properties |

The published rows are sealed records or readonly record structs. Tables use immutable arrays;
lookup and adjacency indexes use immutable dictionaries. Conversion builds a detached snapshot,
so later changes to the caller's BOS arrays do not change query results. The caller must still
avoid mutating those arrays while conversion is in progress.

Local mutation is used where useful: conversion fills temporary builders, graph walks use local
queues and visited sets, and spatial-index construction sorts a local copy. Those intermediate
objects are not published as mutable model state. This follows Platonic's functional-core approach
without requiring persistent collection updates inside every large-data loop.

## Core types actually used

- `Result<BimModel, ImmutableArray<IssueRow>>` represents conversion and read outcomes. Tolerant
  conversion returns a usable model with issues; strict conversion rejects error diagnostics.
- `Option<EntityRow>` represents an entity lookup that may have no match.
- `[Impure]` identifies the IO boundary and mutable/effectful test fixtures.

`Unit` and `[TrustedMutableKernel]` are available through Platonic.Core but are **not currently
used**. The core needed no mutation exemption. Argument exceptions remain appropriate for API
misuse, such as inverted query bounds; expected source-data problems use issues/results. Database
and stream writes can still throw boundary errors for the caller to handle.

## Where enforcement deliberately stops

There are three production class-level `[Impure]` exemptions:

| Class | Reason |
|---|---|
| `BosReader` | Reads ZIP/Parquet streams and assembles the existing mutable BOS input representation |
| `BimModelIO` | Reads/writes files and JSON streams and translates expected read failures into results |
| `ModelSql` | Executes database transactions and writes SQL/text output |

These exemptions cover the whole named class, not just individual IO calls. Keeping these classes
separate makes the boundary reviewable, but code inside them is not protected by the full purity
rules. Test fixtures also opt out so they can construct malformed inputs, manage temporary files,
measure execution and use NUnit. There is no assembly-wide exemption and no purity suppression
in the production core.

Analyzer acceptance is not a formal proof of transitive purity: existing BOS code, external
libraries and explicitly exempt adapters still require ordinary review and integration tests.

## How the integration was verified

The [test runner](../../tools/bim-data-model/test.ps1) includes a compiler probe. An immutable record
must compile; a deliberately mutable class with a setter must fail with `PURE001` and `PURE002`.
The recorded run did both, and also emitted `PURE004` for the unsealed test class. This verifies
actual compiler enforcement, rather than just the presence of a package reference.

The probe does not independently exercise every analyzer rule, and the full upstream analyzer
test suite was not rerun as part of this integration. The BIM behavioral tests separately verify
snapshot detachment, typed properties, dirty-data handling, graph semantics, spatial results,
serialization and real sample loading. The recorded runs cover **36 distinct passing cases**,
including all 15 supplied BOS samples. See the [validation record](../../tests/Ara3D.BimOpenSchema.DataModel.Tests/VALIDATION.md).

From the repository root:

```powershell
# Verify compiler enforcement alone
./tools/bim-data-model/test.ps1 -Suite Analyzers

# Small behavioral tests plus compiler probe
./tools/bim-data-model/test.ps1 -Suite Small -VerifyAnalyzers

# Use a differently located Platonic checkout
./tools/bim-data-model/test.ps1 -Suite Small -PlatonicRoot 'D:/src/Platonic.CSharp'
```

## Guidelines adopted beyond the analyzers

The implementation also follows the upstream emphasis on concrete types, local reasoning,
explicit errors, deterministic tests and isolated work. The referenced C# house style informed
immutable collection boundaries, composition, extension methods and allocation-conscious loops.
The test runner selects independent feature/size/maturity/source categories and preserves full
logs while returning a compact verdict.

The upstream `docs/agent-development-framework.md` labels itself a design report, with proposed
plugins not yet implemented. Its workflow ideas informed this work; those proposed plugins were
not installed or claimed as running tools. Upstream `CONTRACTS.md` ownership fences apply to
developing Platonic itself, rather than imposing new approval steps on a consuming project.

The result is a checked immutable core, a visible IO boundary, and a reproducible way to detect
when future edits break the intended programming model. The broader BIM design is described in
[DESIGN.md](DESIGN.md); operational details are in the [tooling README](../../tools/bim-data-model/README.md).
