using System;
using System.Collections.Generic;
using System.Globalization;

namespace Ara3D.DataFlowEngine.Abstractions;

public enum ParamKind
{
    Boolean,
    Integer,
    Number,
    Text,
    Enum,
    FilePath,
    ModelRef,
    Expression,
    Json,
    DateTime,
}

public enum SuggestKind
{
    /// <summary>Column names of the table connected to input port <c>Source</c>.</summary>
    ColumnsOfInput,
    /// <summary>Table names inside the database file named by param <c>Source</c>.</summary>
    TablesInFile,
}

/// <summary>
/// Where a parameter's value suggestions come from. Advisory only: the value
/// stays a free canonical string, and validation remains an eval-time concern.
/// </summary>
public sealed record SuggestSource(SuggestKind Kind, string Source)
{
    public static SuggestSource ColumnsOf(string inputPort)
        => new(SuggestKind.ColumnsOfInput, inputPort);

    public static SuggestSource TablesInFile(string pathParam)
        => new(SuggestKind.TablesInFile, pathParam);
}

public sealed record ParamSpec(
    string Name,
    ParamKind Kind,
    string Default = "",
    IReadOnlyList<string>? EnumValues = null,
    SuggestSource? Suggest = null);

/// <summary>
/// A node's parameter values as delivered by the engine: canonical string form
/// (the graph document's values layer), with typed accessors.
/// </summary>
public sealed class ParamValues
{
    public static readonly ParamValues Empty = new(new Dictionary<string, string>());

    private readonly IReadOnlyDictionary<string, string> _values;

    public ParamValues(IReadOnlyDictionary<string, string> values)
        => _values = values;

    public IEnumerable<string> Names
        => _values.Keys;

    public string GetText(string name, string @default = "")
        => _values.TryGetValue(name, out var v) ? v : @default;

    public bool GetBoolean(string name, bool @default = false)
        => _values.TryGetValue(name, out var v) ? bool.Parse(v) : @default;

    public long GetInteger(string name, long @default = 0)
        => _values.TryGetValue(name, out var v) ? long.Parse(v, CultureInfo.InvariantCulture) : @default;

    public double GetNumber(string name, double @default = 0)
        => _values.TryGetValue(name, out var v) ? double.Parse(v, CultureInfo.InvariantCulture) : @default;
}
