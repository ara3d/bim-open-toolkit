using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace Ara3D.DataFlowEngine;

/// <summary>
/// Normative value identity per spec semantics §1.1: SHA-256 over a tagged byte
/// encoding, returned as plain lowercase hex (no "sha256:" prefix, matching the
/// graph hash convention). Two values are equal iff their hashes are equal.
/// </summary>
public static class ValueHash
{
    private const long CanonicalNanBits = 0x7FF8000000000000L;

    public static string Compute(FlowValue value)
        => Convert.ToHexString(SHA256.HashData(Encode(value))).ToLowerInvariant();

    public static byte[] Encode(FlowValue value)
    {
        using var stream = new MemoryStream();
        using var writer = new BinaryWriter(stream);
        Write(writer, value);
        writer.Flush();
        return stream.ToArray();
    }

    private static void Write(BinaryWriter w, FlowValue value)
    {
        switch (value)
        {
            case BooleanValue b: WriteBoolean(w, b.Value); break;
            case IntegerValue i: WriteInteger(w, i.Value); break;
            case NumberValue n: WriteNumber(w, n.Value); break;
            case TextValue t: WriteText(w, t.Value); break;
            case TableValue t: WriteTable(w, t.Table); break;
            default: throw new ArgumentException($"Unknown flow value type {value.GetType().Name}");
        }
    }

    private static void WriteBoolean(BinaryWriter w, bool value)
    {
        w.Write((byte)0x01);
        w.Write((byte)(value ? 1 : 0));
    }

    private static void WriteInteger(BinaryWriter w, long value)
    {
        w.Write((byte)0x02);
        w.Write(value);
    }

    private static void WriteNumber(BinaryWriter w, double value)
    {
        w.Write((byte)0x03);
        w.Write(double.IsNaN(value) ? CanonicalNanBits : BitConverter.DoubleToInt64Bits(value));
    }

    internal static void WriteText(BinaryWriter w, string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        w.Write((byte)0x04);
        w.Write((long)bytes.Length);
        w.Write(bytes);
    }

    private static void WriteTable(BinaryWriter w, IDataTable table)
    {
        w.Write((byte)0x05);
        w.Write((long)table.Columns.Count);
        foreach (var column in table.Columns)
            WriteColumn(w, column);
    }

    private static void WriteColumn(BinaryWriter w, IDataColumn column)
    {
        var kind = ToColumnKind(column.Descriptor.Type);
        WriteText(w, column.Descriptor.Name);
        w.Write(KindTag(kind));
        w.Write((long)column.Count);
        for (var row = 0; row < column.Count; row++)
        {
            var cell = column[row];
            if (cell is null or DBNull)
            {
                w.Write((byte)0x00);
            }
            else
            {
                w.Write((byte)0x01);
                WriteCell(w, kind, cell);
            }
        }
    }

    private static void WriteCell(BinaryWriter w, ValueKind kind, object cell)
    {
        switch (kind)
        {
            case ValueKind.Boolean: WriteBoolean(w, (bool)cell); break;
            case ValueKind.Integer: WriteInteger(w, ToInt64(cell)); break;
            case ValueKind.Number: WriteNumber(w, ToDouble(cell)); break;
            case ValueKind.Text: WriteText(w, cell as string ?? ((char)cell).ToString()); break;
            default: throw new ArgumentException($"Cannot hash table cell of kind {kind}");
        }
    }

    private static long ToInt64(object cell)
        => checked(cell switch
        {
            sbyte v => v,
            byte v => v,
            short v => v,
            ushort v => v,
            int v => v,
            uint v => v,
            long v => v,
            ulong v => (long)v,
            _ => throw new ArgumentException($"Cannot hash {cell.GetType().Name} as Integer"),
        });

    private static double ToDouble(object cell)
        => cell switch
        {
            float v => v,
            double v => v,
            decimal v => (double)v,
            _ => throw new ArgumentException($"Cannot hash {cell.GetType().Name} as Number"),
        };

    /// <summary>Maps a column's CLR element type (Nullable unwrapped) to one of the four cell kinds.</summary>
    public static ValueKind ToColumnKind(Type type)
    {
        var t = Nullable.GetUnderlyingType(type) ?? type;
        if (t == typeof(bool)) return ValueKind.Boolean;
        if (t == typeof(sbyte) || t == typeof(byte) || t == typeof(short) || t == typeof(ushort)
            || t == typeof(int) || t == typeof(uint) || t == typeof(long) || t == typeof(ulong))
            return ValueKind.Integer;
        if (t == typeof(float) || t == typeof(double) || t == typeof(decimal)) return ValueKind.Number;
        if (t == typeof(string) || t == typeof(char)) return ValueKind.Text;
        throw new ArgumentException($"Table column type {type.Name} is not hashable");
    }

    private static byte KindTag(ValueKind kind)
        => kind switch
        {
            ValueKind.Boolean => 0x01,
            ValueKind.Integer => 0x02,
            ValueKind.Number => 0x03,
            ValueKind.Text => 0x04,
            _ => throw new ArgumentOutOfRangeException(nameof(kind)),
        };
}
