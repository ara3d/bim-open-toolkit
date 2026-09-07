# Data model verification and Platonic integration

For an architectural summary of the integration and its limits, see
[PLATONIC-INTEGRATION.md](../../src/Ara3D.BimOpenSchema.DataModel/PLATONIC-INTEGRATION.md).

The new projects import `../../tools/bim-data-model/Platonic.props`. This applies all twelve
Platonic analyzers as compiler errors, nullable analysis, and warnings as errors, and references
`Platonic.Core` for `Result`, `Option`, `Unit`, and the boundary attributes. Existing projects are
unaffected. NuGet vulnerability warnings remain visible without blocking compilation, following
Platonic's own build settings.

The default package source is the sibling `Platonic.CSharp/artifacts` directory. It contains the
upstream 0.1.0 packages; no upstream source or binaries need to be copied or modified. Override
`PlatonicRoot` on another workstation, or supply the same packages through your NuGet feeds/cache.
The imported props never disables analyzers when the sibling checkout is missing: restore fails
if the packages cannot be found. Package versions can be pinned with `PlatonicVersion`.

```powershell
./tools/bim-data-model/test.ps1
./tools/bim-data-model/test.ps1 -Feature Geometry
./tools/bim-data-model/test.ps1 -Suite Large
./tools/bim-data-model/test.ps1 -Suite Samples -SampleDirectory 'C:/Users/cdigg/Documents/BIM Open Schema'
./tools/bim-data-model/test.ps1 -Suite All -VerifyAnalyzers
./tools/bim-data-model/test.ps1 -Suite Analyzers
./tools/bim-data-model/test.ps1 -Feature Properties -PlatonicRoot 'D:/src/Platonic.CSharp'
```

Each run writes complete logs and NUnit TRX results beneath ignored `artifacts/bim-data-model`,
then reports a compact verdict. The runner fails when no tests execute. `-VerifyAnalyzers` builds
an immutable record successfully, then requires a deliberate mutable class/setter violation to
fail with both `PURE001` and `PURE002`. This proves that the package is actually loaded, in
addition to ordinary tests verifying behavior. The probe is generated only in build artifacts.
Use `-Suite Analyzers` to run just this probe while domain implementation is in progress.

Tests carry independent NUnit categories:

| Dimension | Categories |
|---|---|
| Feature | `Feature.Conversion`, `Feature.Properties`, `Feature.Graph`, `Feature.Geometry`, `Feature.Serialization`, `Feature.Validation` |
| Size | `Size.Small`, `Size.Large` |
| Maturity | `Stage.Stable`, `Stage.Experimental` |
| Input | `Source.Synthetic`, `Source.LocalSample` |

The default suite selects small synthetic tests. `Large` selects large synthetic tests, `Samples`
selects local file integration tests, and `All` selects everything. Experimental tests require
`-IncludeExperimental`. `-ShowFilter` prints the precise VSTest expression without running a build.
`BOS_SAMPLE_DIRECTORY` supplies the local sample path to integration tests; `-SampleDirectory`
overrides it for one invocation and restores the previous environment value afterward.

## Guidelines applied from Platonic.CSharp

Use a functional core and thin effectful adapters. Domain records are sealed or readonly record
structs; collections are immutable snapshots; callers cannot mutate the index behind a query.
Mutation confined to function-local builders is appropriate for large datasets. Public collection
parameters and results use `IReadOnlyList<T>` or immutable collections. Hot paths use indexed loops
and preallocated buffers. Prefer small extension methods, concrete types, composition, and standard
argument exceptions for programmer misuse. Expected data problems should be represented in results
or diagnostics with source row identifiers rather than silently dropped or thrown as arbitrary exceptions.

Apply `[Impure]` only to file/database adapters and test fixtures that need external resources.
Apply `[TrustedMutableKernel]` only to small reviewed mutable builders or spatial structures where
necessary; document why each exception is needed. Do not disable purity for a whole assembly.

The upstream `docs/agent-development-framework.md` explicitly describes a **design report, not
implemented tools**. Its useful practices here are fenced project ownership, isolated dependency
builds, deterministic tests, a positive/negative analyzer sentinel, and compact verdicts with full
logs retained. Its proposed 36 plugins are not shipped components; this integration does not claim
to run nonexistent tools. The upstream `CONTRACTS.md` fences apply to developing Platonic itself,
not to consuming its packages here.

Sources in the sibling checkout: `README.md`, `CONTRACTS.md`, `Directory.Build.props`,
`src/Platonic.Analyzers/build/Platonic.Analyzers.props`, and `docs/agent-development-framework.md`.
The C# house style referenced by that contract is also reflected above. Add exact fixtures for
small examples and deterministic generated invariants for large examples; avoid tests that merely
repeat implementation. Keep benchmark measurements separate from pass/fail correctness tests.
