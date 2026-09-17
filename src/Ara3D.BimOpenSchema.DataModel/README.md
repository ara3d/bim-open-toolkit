# Ara3D.BimOpenSchema.DataModel

Immutable, query-friendly BIM snapshots over normalized BOS. See [DESIGN.md](DESIGN.md) for the
data structure, considered workflows, semantics, measurements, and open decisions.
See [PLATONIC-INTEGRATION.md](PLATONIC-INTEGRATION.md) for the dependency setup, enforced rules,
effect boundaries, and compiler verification.

```csharp
using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.DataModel;

var result = BimModelConverter.Convert(bosData, new(SourceId: "architecture"));
result.Match(model =>
{
    var walls = model.FindByCategory("Walls");
    var height = ModelQueries.Property("Height", ParameterType.Number, "Dimensions", "mm");
    var tall = model.FindNumeric(height, 3000, 6000);
    var schedule = model.Schedule(walls.Select(e => e.Id).ToArray(), new[] { height });
    var candidates = model.Spatial.Intersect(new(new(0, 0, 0), new(10, 10, 3)));
    return model.Tables.Entities.Length;
}, issues => 0);
```

Select property keys from `model.Tables.Descriptors` when the exact name, group, unit or type is
unknown. Numeric searches query stored assignments; `PropertiesOf` and `Schedule` additionally
resolve type inheritance. `PropertiesOf` preserves the source owner in `PropertyRow.EntityId`.

Graph examples: `model.Graph.Reachable(id, "PartOf")` follows parents;
`model.Graph.Reachable(id, "PartOf", GraphDirection.Incoming)` finds parts;
`model.Graph.ShortestPath(a, b, "ConnectsTo")` explores connectivity.

Conversion is tolerant by default: invalid source assignments are reported, invalid values retain
their raw value/index, and valid rows remain queryable. `Strict: true` returns an error result when
error diagnostics exist. Type/reference indices use `-1` for absence. Duplicate local identities
and duplicate properties are warnings and remain separate. A snapshot is detached from its input;
do not mutate the input concurrently with conversion.

`ToRelationalTables()` returns column metadata plus on-demand row projections. JSON, DuckDB and SQL
writers live in the separate `Ara3D.BimOpenSchema.DataModel.IO` project. All new projects target
`net8.0`. Build `BimDataModel.slnx` with the .NET 10 SDK used by Platonic.CSharp.

```powershell
./tools/bim-data-model/test.ps1 -Suite Small -VerifyAnalyzers
./tools/bim-data-model/test.ps1 -Suite Large
./tools/bim-data-model/test.ps1 -Suite Samples -SampleDirectory 'C:/Users/cdigg/Documents/BIM Open Schema'
```

The sibling `Platonic.CSharp/artifacts` folder supplies Core/Analyzers 0.1.0. Override
`-p:PlatonicRoot=...` for another checkout, or provide the pinned packages through a NuGet feed.
Analyzers are required, not silently disabled when dependencies are unavailable.
