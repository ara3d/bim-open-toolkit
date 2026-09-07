using System.Globalization;
using System.IO.Compression;
using System.Text.Json;
using Parquet;
using Platonic;

namespace Ara3D.BimOpenSchema.DataModel.IO;

/// <summary>Reads all row groups. Archive table and column names carry meaning; ZIP entry order does not.</summary>
[Impure]
internal static class BosReader
{
    internal static BimData Read(string path)
    {
        using var file = File.OpenRead(path);
        using var zip = new ZipArchive(file, ZipArchiveMode.Read);
        var tables = new Dictionary<string, Dictionary<string, Array>>(StringComparer.OrdinalIgnoreCase);
        var manifest = new Manifest { BimOpenSchemaVersion = "unknown" };
        foreach (var entry in zip.Entries)
        {
            if (entry.Name.Equals("Manifest.json", StringComparison.OrdinalIgnoreCase))
            {
                using var input = entry.Open();
                manifest = JsonSerializer.Deserialize<Manifest>(input) ?? manifest;
            }
            if (!entry.Name.EndsWith(".parquet", StringComparison.OrdinalIgnoreCase)) continue;
            using var stream = new MemoryStream();
            using (var input = entry.Open()) input.CopyTo(stream);
            stream.Position = 0;
            var name = Path.GetFileNameWithoutExtension(entry.Name);
            if (!tables.TryAdd(name, ReadTable(stream))) throw new InvalidDataException($"Duplicate table {name}.");
        }
        if (tables.Count == 0) throw new InvalidDataException("BOS archive has no Parquet tables.");
        return Decode(tables, manifest);
    }

    private static Dictionary<string, Array> ReadTable(Stream stream)
    {
        using var reader = ParquetReader.CreateAsync(stream).GetAwaiter().GetResult();
        var columns = new Dictionary<string, Array>(StringComparer.OrdinalIgnoreCase);
        foreach (var field in reader.Schema.GetDataFields())
        {
            var chunks = new List<Array>();
            var count = 0;
            for (var group = 0; group < reader.RowGroupCount; group++)
            {
                using var rows = reader.OpenRowGroupReader(group);
                var values = rows.ReadColumnAsync(field).GetAwaiter().GetResult().Data;
                count = checked(count + values.Length);
                chunks.Add(values);
            }
            var column = Array.CreateInstance(field.ClrType, count);
            var offset = 0;
            foreach (var chunk in chunks) { Array.Copy(chunk, 0, column, offset, chunk.Length); offset += chunk.Length; }
            columns.Add(field.Name, column);
        }
        return columns;
    }

    private static BimData Decode(Dictionary<string, Dictionary<string, Array>> tables, Manifest manifest)
    {
        T[] Col<T>(string table, string name)
        {
            if (!tables.TryGetValue(table, out var columns)) return [];
            if (!columns.TryGetValue(name, out var data)) throw new InvalidDataException($"Missing column {table}.{name}.");
            if (data is T[] typed) return typed;
            var result = new T[data.Length];
            for (var i = 0; i < result.Length; i++)
                result[i] = (T)System.Convert.ChangeType(data.GetValue(i) ?? throw new InvalidDataException($"Null in {table}.{name}."), typeof(T), CultureInfo.InvariantCulture);
            return result;
        }
        T[] Rows<T>(string table, Func<int, Func<string, object>, T> create)
        {
            if (!tables.TryGetValue(table, out var columns) || columns.Count == 0) return [];
            var count = columns.First().Value.Length;
            if (columns.Values.Any(c => c.Length != count)) throw new InvalidDataException($"Unequal columns in {table}.");
            var rows = new T[count];
            for (var i = 0; i < count; i++)
            {
                object Value(string name) => columns.TryGetValue(name, out var column)
                    ? column.GetValue(i) ?? throw new InvalidDataException($"Null in {table}.{name}.")
                    : throw new InvalidDataException($"Missing column {table}.{name}.");
                rows[i] = create(i, Value);
            }
            return rows;
        }
        int I(object value) => System.Convert.ToInt32(value, CultureInfo.InvariantCulture);
        long L(object value) => System.Convert.ToInt64(value, CultureInfo.InvariantCulture);
        float F(object value) => System.Convert.ToSingle(value, CultureInfo.InvariantCulture);
        var data = new BimData
        {
            Manifest = manifest,
            Strings = Col<string>("Strings", "Strings"), Numbers = Col<float>("Numbers", "Numbers"),
            Documents = Rows("Documents", (_, v) => new Document((StringIndex)I(v("Title")), (StringIndex)I(v("Path")))),
            Entities = Rows("Entities", (_, v) => new Entity(L(v("LocalId")), (StringIndex)I(v("GlobalId")),
                (DocumentIndex)I(v("Document")), (StringIndex)I(v("Name")), (EntityIndex)I(v("Category")), (EntityIndex)I(v("Type")))),
            Descriptors = Rows("Descriptors", (_, v) => new ParameterDescriptor((StringIndex)I(v("Name")), (StringIndex)I(v("Units")),
                (StringIndex)I(v("Group")), (ParameterType)I(v(tables["Descriptors"].ContainsKey("Type") ? "Type" : "ValueType")))),
            Points = Rows("Points", (_, v) => new Point(F(v("X")), F(v("Y")), F(v("Z")))),
            Relations = Rows("Relations", (_, v) => new EntityRelation((EntityIndex)I(v("EntityA")), (EntityIndex)I(v("EntityB")), (RelationType)I(v("RelationType")))),
            Diagnostics = Rows("Diagnostics", (_, v) => new Diagnostic((DiagnosticType)I(v("Type")), (DocumentIndex)I(v("Document")), (EntityIndex)I(v("Entity")), (StringIndex)I(v("Message"))))
        };
        var parameters = new List<Parameter>();
        foreach (var table in new[] { "Parameters", "IntegerParameters", "StringParameters", "EntityParameters", "PointParameters" })
            parameters.AddRange(Rows(table, (_, v) => new Parameter((EntityIndex)I(v("Entity")), (DescriptorIndex)I(v("Descriptor")), I(v("Value")))));
        var numbers = new List<float>(data.Numbers);
        parameters.AddRange(Rows("SingleParameters", (_, v) =>
        {
            var index = numbers.Count;
            numbers.Add(F(v("Value")));
            return new Parameter((EntityIndex)I(v("Entity")), (DescriptorIndex)I(v("Descriptor")), index);
        }));
        data.Parameters = parameters.ToArray();
        data.Numbers = numbers.ToArray();
        data.Geometry = ReadGeometry(Col<int>, Col<float>, Col<byte>, tables);
        return data;
    }

    private static BimGeometry ReadGeometry(Func<string, string, int[]> ints, Func<string, string, float[]> floats,
        Func<string, string, byte[]> bytes, Dictionary<string, Dictionary<string, Array>> tables)
        => new()
        {
            VertexX = ints("VertexBuffer", "VertexX"), VertexY = ints("VertexBuffer", "VertexY"), VertexZ = ints("VertexBuffer", "VertexZ"),
            IndexBuffer = ints("IndexBuffer", "IndexBuffer"), MeshVertexOffset = ints("Meshes", "MeshVertexOffset"), MeshIndexOffset = ints("Meshes", "MeshIndexOffset"),
            InstanceEntityIndex = ints("Instances", "InstanceEntityIndex"), InstanceMeshIndex = ints("Instances", "InstanceMeshIndex"),
            InstanceTransformIndex = ints("Instances", "InstanceTransformIndex"), InstanceMaterialIndex = ints("Instances", "InstanceMaterialIndex"),
            InstanceFlags = tables.TryGetValue("Instances", out var inst) && inst.ContainsKey("InstanceFlags") ? bytes("Instances", "InstanceFlags") : [],
            TransformTX = floats("Transforms", "TransformTX"), TransformTY = floats("Transforms", "TransformTY"), TransformTZ = floats("Transforms", "TransformTZ"),
            TransformQX = floats("Transforms", "TransformQX"), TransformQY = floats("Transforms", "TransformQY"), TransformQZ = floats("Transforms", "TransformQZ"), TransformQW = floats("Transforms", "TransformQW"),
            TransformSX = floats("Transforms", "TransformSX"), TransformSY = floats("Transforms", "TransformSY"), TransformSZ = floats("Transforms", "TransformSZ"),
            MaterialRed = bytes("Materials", "MaterialRed"), MaterialGreen = bytes("Materials", "MaterialGreen"), MaterialBlue = bytes("Materials", "MaterialBlue"),
            MaterialAlpha = bytes("Materials", "MaterialAlpha"), MaterialMetallic = bytes("Materials", "MaterialMetallic"), MaterialRoughness = bytes("Materials", "MaterialRoughness")
        };
}
