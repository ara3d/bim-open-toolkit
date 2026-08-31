using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace Ara3D.DataFlowEngine.Runs;

/// <summary>
/// The typed-JSON value serialization of runs.md §3: scalars as
/// {kind, value}, tables as {kind, columns}, non-finite Numbers as the
/// strings "NaN"/"Infinity"/"-Infinity", null table cells as JSON null.
/// </summary>
internal static class ValueJson
{
    public static void Write(Utf8JsonWriter w, FlowValue value)
    {
        w.WriteStartObject();
        w.WriteString("kind", value.Kind.ToString());
        switch (value)
        {
            case BooleanValue b:
                w.WriteBoolean("value", b.Value);
                break;
            case IntegerValue i:
                w.WriteNumber("value", i.Value);
                break;
            case NumberValue n:
                w.WritePropertyName("value");
                WriteNumber(w, n.Value);
                break;
            case TextValue t:
                w.WriteString("value", t.Value);
                break;
            case TableValue t:
                WriteColumns(w, t.Table);
                break;
            default:
                throw new ArgumentException($"Cannot serialize flow value of type {value.GetType().Name}");
        }
        w.WriteEndObject();
    }

    public static FlowValue Read(JsonElement e)
    {
        var kind = e.GetProperty("kind").GetString()
            ?? throw new FormatException("Serialized value 'kind' must be a string");
        return kind switch
        {
            "Boolean" => new BooleanValue(Value(e).GetBoolean()),
            "Integer" => new IntegerValue(Value(e).GetInt64()),
            "Number" => new NumberValue(ReadNumber(Value(e))),
            "Text" => new TextValue(Value(e).GetString()
                ?? throw new FormatException("Text value must not be null")),
            "Table" => new TableValue(ReadTable(e)),
            _ => throw new FormatException($"Unknown serialized value kind '{kind}'"),
        };
    }

    private static JsonElement Value(JsonElement e)
        => e.TryGetProperty("value", out var v) ? v : throw new FormatException("Serialized value must have 'value'");

    private static void WriteNumber(Utf8JsonWriter w, double value)
    {
        if (double.IsNaN(value))
            w.WriteStringValue("NaN");
        else if (double.IsPositiveInfinity(value))
            w.WriteStringValue("Infinity");
        else if (double.IsNegativeInfinity(value))
            w.WriteStringValue("-Infinity");
        else
            w.WriteNumberValue(value);
    }

    private static double ReadNumber(JsonElement e)
        => e.ValueKind switch
        {
            JsonValueKind.Number => e.GetDouble(),
            JsonValueKind.String => e.GetString() switch
            {
                "NaN" => double.NaN,
                "Infinity" => double.PositiveInfinity,
                "-Infinity" => double.NegativeInfinity,
                var s => throw new FormatException($"'{s}' is not a valid non-finite Number"),
            },
            _ => throw new FormatException("Number value must be a JSON number or non-finite string"),
        };

    private static void WriteColumns(Utf8JsonWriter w, IDataTable table)
    {
        w.WritePropertyName("columns");
        w.WriteStartArray();
        foreach (var column in table.Columns)
        {
            var kind = ValueHash.ToColumnKind(column.Descriptor.Type);
            w.WriteStartObject();
            w.WriteString("name", column.Descriptor.Name);
            w.WriteString("kind", kind.ToString());
            w.WritePropertyName("cells");
            w.WriteStartArray();
            for (var row = 0; row < column.Count; row++)
                WriteCell(w, kind, column[row]);
            w.WriteEndArray();
            w.WriteEndObject();
        }
        w.WriteEndArray();
    }

    private static void WriteCell(Utf8JsonWriter w, ValueKind kind, object? cell)
    {
        if (cell is null or DBNull)
        {
            w.WriteNullValue();
            return;
        }
        switch (kind)
        {
            case ValueKind.Boolean: w.WriteBooleanValue((bool)cell); break;
            case ValueKind.Integer: w.WriteNumberValue(Convert.ToInt64(cell)); break;
            case ValueKind.Number: WriteNumber(w, Convert.ToDouble(cell)); break;
            case ValueKind.Text: w.WriteStringValue(cell as string ?? ((char)cell).ToString()); break;
            default: throw new ArgumentException($"Cannot serialize table cell of kind {kind}");
        }
    }

    private static IDataTable ReadTable(JsonElement e)
    {
        if (!e.TryGetProperty("columns", out var columnsEl))
            throw new FormatException("Table value must have 'columns'");
        var columns = columnsEl.EnumerateArray().Select(ReadColumn).ToList();
        return new RecordTable("recorded", columns);
    }

    private static RecordColumn ReadColumn(JsonElement e, int index)
    {
        var name = e.GetProperty("name").GetString()
            ?? throw new FormatException("Column 'name' must be a string");
        var kind = e.GetProperty("kind").GetString() switch
        {
            "Boolean" => ValueKind.Boolean,
            "Integer" => ValueKind.Integer,
            "Number" => ValueKind.Number,
            "Text" => ValueKind.Text,
            var k => throw new FormatException($"Unknown column kind '{k}'"),
        };
        var cells = e.GetProperty("cells").EnumerateArray()
            .Select(c => ReadCell(c, kind)).ToArray();
        return new RecordColumn(name, ColumnType(kind), cells, index);
    }

    private static object? ReadCell(JsonElement e, ValueKind kind)
        => e.ValueKind == JsonValueKind.Null
            ? null
            : kind switch
            {
                ValueKind.Boolean => e.GetBoolean(),
                ValueKind.Integer => e.GetInt64(),
                ValueKind.Number => ReadNumber(e),
                ValueKind.Text => e.GetString()!,
                _ => throw new FormatException($"Cannot read table cell of kind {kind}"),
            };

    private static Type ColumnType(ValueKind kind)
        => kind switch
        {
            ValueKind.Boolean => typeof(bool),
            ValueKind.Integer => typeof(long),
            ValueKind.Number => typeof(double),
            ValueKind.Text => typeof(string),
            _ => throw new ArgumentOutOfRangeException(nameof(kind)),
        };
}
