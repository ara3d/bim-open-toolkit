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

public sealed record ParamSpec(
    string Name,
    ParamKind Kind,
    string Default = "",
    IReadOnlyList<string>? EnumValues = null);

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
