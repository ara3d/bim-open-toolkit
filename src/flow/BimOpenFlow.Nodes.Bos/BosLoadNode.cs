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
            new ParamSpec("path", ParamKind.FilePath),
            new ParamSpec("harmonize", ParamKind.Boolean, "false"),
        ],
        "Loads a BIM Open Schema (.bos) file and outputs its entity, parameter, and relation text tables.");

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
        IBimData data = new FilePath(path).ReadBimDataFromParquetZip();
        if (harmonize)
            data = BosHarmonizer.Harmonize(data);
        using var conn = data.ToDuckDb();
        return new(
            conn.Query("SELECT * FROM EntityText ORDER BY EntityIndex", "entities"),
            conn.Query("SELECT * FROM ParameterText ORDER BY EntityIndex, Name", "parameters"),
            conn.Query("SELECT * FROM RelationText ORDER BY EntityIndexA, EntityIndexB, RelationType", "relations"));
    }

    private static string ContentHash(string path)
    {
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(stream));
    }
}
