using System.Collections.Concurrent;
using System.Security.Cryptography;
using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.DuckDb;
using Ara3D.BimOpenSchema.Harmonizer;
using Ara3D.BimOpenSchema.IO;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using Ara3D.Utils;

namespace BimOpenFlow.Nodes.Bos;

/// <summary>Loads a .bos file into an in-memory DuckDB once and outputs the three text views
/// as materialized tables. The node is pure: results are cached per (file content hash,
/// harmonize flag), so re-evaluations of unchanged content never reload, and edits to the
/// file are picked up because the key is the content itself. Cached tables are immutable
/// and shared safely across evaluations.</summary>
public sealed class BosLoadNode : IFlowNode
{
    public const string Kind = "bos.load";

    /// <summary>The tables the three text views and the harmonizer use: entities, parameters, and relations
    /// (a read adds the descriptors, strings, numbers, and points those index). Geometry, documents, and
    /// diagnostics are never read; harmonizing adds its own diagnostics, which no output shows.</summary>
    private const BosTables TablesRead = BosTables.Entities | BosTables.Parameters | BosTables.Relations;

    private sealed record LoadedTables(IDataTable Entities, IDataTable Parameters, IDataTable Relations);

    // TODO: unbounded cache; add eviction (or move memoization fully into the engine)
    // if long-lived hosts cycle through many models.
    private static readonly ConcurrentDictionary<string, LoadedTables> Cache = new();

    // TODO: a standalone bos.harmonize node is skipped for now: BosHarmonizer transforms
    // IBimData (whole datasets), not tables, and has no target-unit-system parameter (it
    // always appends SI canonical columns). It is exposed as the 'harmonize' flag here instead.
    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs:
        [
            new PortSpec("entities", PortType.Table),
            new PortSpec("parameters", PortType.Table),
            new PortSpec("relations", PortType.Table),
        ],
        Params:
        [
            new ParamSpec("path", ParamKind.FilePath, Bindable: PortType.Text, Suggest: SuggestSource.FilesWith(".bos")),
            new ParamSpec("harmonize", ParamKind.Boolean, "false"),
        ],
        "Loads a BIM Open Schema (.bos) file and outputs its entity, parameter, and relation text tables.",
        Schemas:
        [
            KindSchemas.Static("entities",
                ColumnKinds.EntityIndex.NotNull(), ColumnKinds.StepId, ColumnKinds.GlobalId, ColumnKinds.Name,
                ColumnKinds.Category, ColumnKinds.Type),
            KindSchemas.Static("parameters",
                ColumnKinds.EntityIndex.NotNull(), ColumnKinds.Name, ColumnKinds.ParameterGroup, ColumnKinds.Units,
                ColumnKinds.ValueType, ColumnKinds.Value),
            KindSchemas.Static("relations",
                ColumnKinds.EntityIndexA.NotNull(), ColumnKinds.NameA, ColumnKinds.EntityIndexB.NotNull(),
                ColumnKinds.NameB, ColumnKinds.RelationType),
        ]);

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var path = parameters.RequiredText("path", Kind);
        if (!File.Exists(path))
            throw new FileNotFoundException($"{Kind}: file not found: {path}", path);
        var harmonize = parameters.GetBoolean("harmonize");
        var tables = Cache.GetOrAdd($"{ContentHash(path)}:{harmonize}", _ => Load(path, harmonize));
        return
        [
            new TableValue(tables.Entities),
            new TableValue(tables.Parameters),
            new TableValue(tables.Relations),
        ];
    }

    private static LoadedTables Load(string path, bool harmonize)
    {
        IBimData data = new FilePath(path).ReadBimDataFromParquetZip(TablesRead);
        if (harmonize)
            data = BosHarmonizer.Harmonize(data);
        using var conn = data.ToDuckDb();
        return new(
            conn.Query(EntitiesQuery, "entities"),
            conn.Query(ParametersQuery, "parameters"),
            conn.Query(RelationsQuery, "relations"));
    }

    /// <summary>The queries behind the three outputs. Each order is total, so two parameters
    /// that share an entity and a name (in different groups) always come out in the same order.</summary>
    public const string EntitiesQuery = "SELECT * FROM EntityText ORDER BY EntityIndex";
    public const string ParametersQuery =
        "SELECT * FROM ParameterText ORDER BY EntityIndex, Name, ParameterGroup NULLS FIRST, ValueType, Value NULLS FIRST";
    public const string RelationsQuery = "SELECT * FROM RelationText ORDER BY EntityIndexA, EntityIndexB, RelationType";

    private static string ContentHash(string path)
    {
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(stream));
    }
}
