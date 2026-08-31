using System;
using System.Globalization;
using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.TestKit;

/// <summary>
/// Parses the canonical string form of a scalar value (spec format part §4)
/// into a FlowValue. Table has no canonical string form and is not parseable.
/// </summary>
public static class CanonicalValue
{
    public static FlowValue Parse(ValueKind kind, string text)
        => kind switch
        {
            ValueKind.Boolean => new BooleanValue(ParseBoolean(text)),
            ValueKind.Integer => new IntegerValue(long.Parse(text, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture)),
            ValueKind.Number => new NumberValue(double.Parse(text, CultureInfo.InvariantCulture)),
            ValueKind.Text => new TextValue(text),
            _ => throw new NotSupportedException($"Value kind {kind} has no canonical string form (spec format §4)"),
        };

    public static FlowValue Parse(string kindName, string text)
        => Parse(Enum.Parse<ValueKind>(kindName), text);

    private static bool ParseBoolean(string text)
        => text switch
        {
            "true" => true,
            "false" => false,
            _ => throw new FormatException($"'{text}' is not a canonical Boolean ('true' or 'false')"),
        };
}
