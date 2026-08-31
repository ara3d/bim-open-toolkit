using System;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace Ara3D.NodeGraph;

/// <summary>
/// Canonical JSON per the frozen seam: LF lines, 2-space indent, object keys
/// sorted ordinally at every level, integers plain, doubles "R" round-trip,
/// minimal string escaping. Array order is preserved (callers pre-sort).
/// </summary>
public static class CanonicalJson
{
    public static string ToCanonicalString(JsonElement element)
    {
        var sb = new StringBuilder();
        Write(sb, element, 0);
        return sb.ToString();
    }

    public static void Write(StringBuilder sb, JsonElement e, int indent)
    {
        switch (e.ValueKind)
        {
            case JsonValueKind.Object: WriteObject(sb, e, indent); break;
            case JsonValueKind.Array: WriteArray(sb, e, indent); break;
            case JsonValueKind.String: WriteString(sb, e.GetString()!); break;
            case JsonValueKind.Number: sb.Append(FormatNumber(e)); break;
            case JsonValueKind.True: sb.Append("true"); break;
            case JsonValueKind.False: sb.Append("false"); break;
            case JsonValueKind.Null: sb.Append("null"); break;
            default: throw new ArgumentException($"Cannot canonicalize JSON value of kind {e.ValueKind}");
        }
    }

    public static string FormatNumber(JsonElement e)
        => e.TryGetInt64(out var i) ? i.ToString(CultureInfo.InvariantCulture) : FormatDouble(e.GetDouble());

    public static string FormatDouble(double d)
        => d == 0 ? "0" : d.ToString("R", CultureInfo.InvariantCulture);

    private static void WriteObject(StringBuilder sb, JsonElement e, int indent)
    {
        var props = e.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal).ToList();
        if (props.Count == 0)
        {
            sb.Append("{}");
            return;
        }
        sb.Append("{\n");
        for (var i = 0; i < props.Count; i++)
        {
            Indent(sb, indent + 1);
            WriteString(sb, props[i].Name);
            sb.Append(": ");
            Write(sb, props[i].Value, indent + 1);
            sb.Append(i < props.Count - 1 ? ",\n" : "\n");
        }
        Indent(sb, indent);
        sb.Append('}');
    }

    private static void WriteArray(StringBuilder sb, JsonElement e, int indent)
    {
        var items = e.EnumerateArray().ToList();
        if (items.Count == 0)
        {
            sb.Append("[]");
            return;
        }
        sb.Append("[\n");
        for (var i = 0; i < items.Count; i++)
        {
            Indent(sb, indent + 1);
            Write(sb, items[i], indent + 1);
            sb.Append(i < items.Count - 1 ? ",\n" : "\n");
        }
        Indent(sb, indent);
        sb.Append(']');
    }

    private static void Indent(StringBuilder sb, int levels)
        => sb.Append(' ', levels * 2);

    private static void WriteString(StringBuilder sb, string s)
    {
        sb.Append('"');
        foreach (var c in s)
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\t': sb.Append("\\t"); break;
                case '\n': sb.Append("\\n"); break;
                case '\f': sb.Append("\\f"); break;
                case '\r': sb.Append("\\r"); break;
                default:
                    if (c < 0x20)
                        sb.Append("\\u").Append(((int)c).ToString("x4"));
                    else
                        sb.Append(c);
                    break;
            }
        sb.Append('"');
    }
}
