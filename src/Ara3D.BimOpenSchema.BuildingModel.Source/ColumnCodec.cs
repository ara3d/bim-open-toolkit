using System.Text;
using Platonic;

namespace Ara3D.BimOpenSchema.BuildingModel.Source;

/// <summary>Little-endian typed values; nullable values have a presence byte. Strings use byte lengths, preserving embedded NUL.</summary>
[Impure]
internal static class ColumnCodec
{
    internal static void Write(Stream stream, Array values)
    {
        var element = values.GetType().GetElementType()!;
        var type = Nullable.GetUnderlyingType(element) ?? element;
        var nullable = !element.IsValueType || type != element;
        if (element.IsPrimitive && BitConverter.IsLittleEndian)
        {
            var buffer = new byte[1024 * 1024];
            var length = Buffer.ByteLength(values);
            for (var offset = 0; offset < length;)
            {
                var count = Math.Min(buffer.Length, length - offset);
                Buffer.BlockCopy(values, offset, buffer, 0, count); stream.Write(buffer, 0, count); offset += count;
            }
            return;
        }
        using var writer = new BinaryWriter(stream, Encoding.UTF8, true);
        foreach (var value in values)
        {
            if (nullable) { writer.Write(value is not null); if (value is null) continue; }
            switch (Type.GetTypeCode(type))
            {
                case TypeCode.Boolean: writer.Write((bool)value!); break;
                case TypeCode.Byte: writer.Write((byte)value!); break;
                case TypeCode.SByte: writer.Write((sbyte)value!); break;
                case TypeCode.Int16: writer.Write((short)value!); break;
                case TypeCode.UInt16: writer.Write((ushort)value!); break;
                case TypeCode.Int32: writer.Write((int)value!); break;
                case TypeCode.UInt32: writer.Write((uint)value!); break;
                case TypeCode.Int64: writer.Write((long)value!); break;
                case TypeCode.UInt64: writer.Write((ulong)value!); break;
                case TypeCode.Single: writer.Write((float)value!); break;
                case TypeCode.Double: writer.Write((double)value!); break;
                case TypeCode.Decimal: writer.Write((decimal)value!); break;
                case TypeCode.DateTime: writer.Write(((DateTime)value!).ToBinary()); break;
                case TypeCode.String: writer.Write((string)value!); break;
                default:
                    if (type == typeof(byte[])) { var bytes = (byte[])value!; writer.Write(bytes.Length); writer.Write(bytes); }
                    else if (type == typeof(TimeSpan)) writer.Write(((TimeSpan)value!).Ticks);
                    else if (type == typeof(Guid)) writer.Write(((Guid)value!).ToByteArray());
                    else throw new NotSupportedException($"Column type {type} is not supported; source is not silently coerced.");
                    break;
            }
        }
    }

    internal static Array Read(Stream stream, string typeName, int count)
    {
        var element = Type.GetType(typeName, true)!;
        var type = Nullable.GetUnderlyingType(element) ?? element;
        var nullable = !element.IsValueType || type != element;
        var result = Array.CreateInstance(element, count);
        if (element.IsPrimitive && BitConverter.IsLittleEndian)
        {
            var buffer = new byte[1024 * 1024];
            var length = Buffer.ByteLength(result);
            for (var offset = 0; offset < length;)
            {
                var size = Math.Min(buffer.Length, length - offset);
                stream.ReadExactly(buffer.AsSpan(0, size)); Buffer.BlockCopy(buffer, 0, result, offset, size); offset += size;
            }
            return result;
        }
        using var reader = new BinaryReader(stream, Encoding.UTF8, true);
        for (var i = 0; i < count; i++)
        {
            if (nullable && !reader.ReadBoolean()) continue;
            object value = Type.GetTypeCode(type) switch
            {
                TypeCode.Boolean => reader.ReadBoolean(), TypeCode.Byte => reader.ReadByte(), TypeCode.SByte => reader.ReadSByte(),
                TypeCode.Int16 => reader.ReadInt16(), TypeCode.UInt16 => reader.ReadUInt16(), TypeCode.Int32 => reader.ReadInt32(),
                TypeCode.UInt32 => reader.ReadUInt32(), TypeCode.Int64 => reader.ReadInt64(), TypeCode.UInt64 => reader.ReadUInt64(),
                TypeCode.Single => reader.ReadSingle(), TypeCode.Double => reader.ReadDouble(), TypeCode.Decimal => reader.ReadDecimal(),
                TypeCode.DateTime => DateTime.FromBinary(reader.ReadInt64()), TypeCode.String => reader.ReadString(),
                _ => type == typeof(byte[]) ? ReadBytes(reader, reader.ReadInt32()) : type == typeof(TimeSpan) ? TimeSpan.FromTicks(reader.ReadInt64()) :
                    type == typeof(Guid) ? new Guid(ReadBytes(reader, 16)) : throw new NotSupportedException($"Column type {type} is not supported.")
            };
            result.SetValue(value, i);
        }
        return result;
    }

    private static byte[] ReadBytes(BinaryReader reader, int count)
    {
        var bytes = reader.ReadBytes(count);
        return bytes.Length == count ? bytes : throw new EndOfStreamException();
    }
}
