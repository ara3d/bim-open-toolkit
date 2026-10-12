using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>What the bim.* nodes share when they declare their output columns: the bounding-box
/// columns and the checks an inferring node makes on its input. Every Eval that adds columns to its
/// input throws on a missing or taken name, so the matching Infer fails with the same message.</summary>
internal static class BimSchemas
{
    /// <summary>MinX..MaxZ, SizeX/Y/Z, CenterX/Y/Z, FootprintArea: the box columns of bim.rooms and bim.bounds.</summary>
    public static KindColumn[] Box(bool nullable)
        => Declared(nullable,
            ColumnKinds.MinX, ColumnKinds.MinY, ColumnKinds.MinZ, ColumnKinds.MaxX, ColumnKinds.MaxY, ColumnKinds.MaxZ,
            ColumnKinds.SizeX, ColumnKinds.SizeY, ColumnKinds.SizeZ,
            ColumnKinds.CenterX, ColumnKinds.CenterY, ColumnKinds.CenterZ, ColumnKinds.FootprintArea);

    public static KindColumn[] Declared(bool nullable, params ColumnKind[] kinds)
        => [.. kinds.Select(k => k.Declared(nullable))];

    /// <summary>The kind as a column the user may rename: the kind's own name keeps the kind, any other
    /// name is a plain column of the kind's type.</summary>
    public static KindColumn Named(ColumnKind kind, string name, bool nullable = true)
        => name == kind.Name ? kind.Declared(nullable) : KindColumn.Plain(name, kind.Type.ToColumnType(), nullable);

    /// <summary>The schema of input <paramref name="index"/>, or a failure when nothing is wired to it.</summary>
    public static SchemaResult Input(IReadOnlyList<SchemaInput> inputs, int index, string kind)
        => inputs[index].Schema ?? SchemaResult.Fail($"{kind}: input {index} has no table connected.");

    /// <summary>The input, or a failure naming the first of <paramref name="columns"/> it lacks.</summary>
    public static SchemaResult Require(this SchemaResult input, string kind, params string[] columns)
        => input.Ok && columns.FirstOrDefault(c => !input.Schema!.Has(c)) is { } missing
            ? SchemaResult.Fail($"{kind}: no column named '{missing}'.")
            : input;

    /// <summary>The input with columns added, or a failure when it already has one of those names.</summary>
    public static SchemaResult Add(this SchemaResult input, string kind, params KindColumn[] added)
        => input.Ok && added.FirstOrDefault(c => input.Schema!.Has(c.Name)) is { Name: { } taken }
            ? SchemaResult.Fail($"{kind}: column '{taken}' already exists.")
            : input.Append(added);
}
