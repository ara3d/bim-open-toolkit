using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using Ara3D.BimOpenSchema.DataModel;
using Ara3D.IO.BFAST;
using Ara3D.Memory;
using Parquet;
using Platonic;

namespace Ara3D.BimOpenSchema.BuildingModel.Source;

public sealed record SourceColumn(string Table, string Name, int RowGroup, string TypeName, int Count,
    string BufferName, long Bytes, string Sha256, bool IsGeometry);
public sealed record SourceCacheMetadata(string CacheVersion, string SourcePath, string SourceSha256, long SourceBytes,
    string? SourceManifestJson, IReadOnlyList<SourceColumn> Columns);

/// <summary>Prepares source columns once. Core reopening reads only core BFAST buffers, never BOS or Parquet.</summary>
[Impure]
public static class SourceCache
{
    public const string Version = "bos-columns-bfast/1";
    private const string MetadataBuffer = "source-cache.json";
    private static readonly HashSet<string> GeometryTables = new(StringComparer.OrdinalIgnoreCase)
        { "VertexBuffer", "IndexBuffer", "Meshes", "Instances", "Transforms", "Materials" };

    public static SourceCacheMetadata Prepare(string bosPath, string cachePath)
    {
        bosPath = Path.GetFullPath(bosPath);
        cachePath = Path.GetFullPath(cachePath);
        using var source = File.OpenRead(bosPath);
        var sha = Convert.ToHexString(SHA256.HashData(source));
        if (File.Exists(cachePath))
        {
            var existing = Inspect(cachePath);
            if (existing.SourceSha256 == sha && existing.CacheVersion == Version) { Verify(cachePath); return existing; }
        }
        Directory.CreateDirectory(Path.GetDirectoryName(cachePath)!);
        var staging = cachePath + ".staging-" + Guid.NewGuid().ToString("N");
        Directory.CreateDirectory(staging);
        try
        {
            source.Position = 0;
            using var archive = new ZipArchive(source, ZipArchiveMode.Read, true);
            string? manifest = null;
            var columns = new List<SourceColumn>();
            var tableNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var entry in archive.Entries)
            {
                if (entry.Name.Equals("Manifest.json", StringComparison.OrdinalIgnoreCase))
                { using var reader = new StreamReader(entry.Open()); manifest = reader.ReadToEnd(); }
                if (!entry.Name.EndsWith(".parquet", StringComparison.OrdinalIgnoreCase)) continue;
                var table = Path.GetFileNameWithoutExtension(entry.Name);
                if (!tableNames.Add(table)) throw new InvalidDataException($"Duplicate table {table}.");
                var parquetPath = Path.Combine(staging, "table.parquet");
                using (var input = entry.Open()) using (var output = File.Create(parquetPath)) input.CopyTo(output);
                using (var input = File.OpenRead(parquetPath))
                using (var parquet = ParquetReader.CreateAsync(input).GetAwaiter().GetResult())
                {
                    foreach (var field in parquet.Schema.GetDataFields())
                    for (var group = 0; group < parquet.RowGroupCount; group++)
                    {
                        using var rows = parquet.OpenRowGroupReader(group);
                        var values = rows.ReadColumnAsync(field).GetAwaiter().GetResult().Data;
                        var buffer = $"column/{columns.Count:D6}";
                        var path = Path.Combine(staging, columns.Count.ToString());
                        using (var output = File.Create(path)) ColumnCodec.Write(output, values);
                        using var encoded = File.OpenRead(path);
                        columns.Add(new(table, field.Name, group, values.GetType().GetElementType()!.AssemblyQualifiedName!, values.Length,
                            buffer, encoded.Length, Convert.ToHexString(SHA256.HashData(encoded)), GeometryTables.Contains(table)));
                    }
                }
                File.Delete(parquetPath);
            }
            if (columns.Count == 0) throw new InvalidDataException("BOS archive has no columns.");
            var metadata = new SourceCacheMetadata(Version, bosPath, sha, source.Length, manifest, columns);
            var json = JsonSerializer.SerializeToUtf8Bytes(metadata);
            var temporary = Path.Combine(staging, "prepared.bfast");
            BFast.Write(temporary, new[] { MetadataBuffer }.Concat(columns.Select(c => c.BufferName)),
                new[] { (long)json.Length }.Concat(columns.Select(c => c.Bytes)), (output, index, _, bytes) =>
                {
                    if (index == 0) output.Write(json);
                    else { using var input = File.OpenRead(Path.Combine(staging, (index - 1).ToString())); input.CopyTo(output); }
                    return bytes;
                });
            Verify(temporary);
            File.Move(temporary, cachePath, true);
            return metadata;
        }
        finally
        {
            var parent = Path.GetFullPath(Path.GetDirectoryName(cachePath)!) + Path.DirectorySeparatorChar;
            var resolved = Path.GetFullPath(staging);
            if (!resolved.StartsWith(parent, StringComparison.OrdinalIgnoreCase) ||
                !Path.GetFileName(resolved).StartsWith(Path.GetFileName(cachePath) + ".staging-", StringComparison.Ordinal))
                throw new InvalidOperationException("Refusing cleanup outside the cache staging directory.");
            Directory.Delete(resolved, true);
        }
    }

    public static SourceCacheMetadata Inspect(string cachePath)
    {
        var ranges = Ranges(cachePath);
        using var file = File.OpenRead(cachePath);
        var range = ranges[MetadataBuffer];
        file.Position = range.Begin;
        var bytes = new byte[checked((int)range.Count)];
        file.ReadExactly(bytes);
        var metadata = JsonSerializer.Deserialize<SourceCacheMetadata>(bytes) ?? throw new InvalidDataException("Missing cache metadata.");
        if (metadata.CacheVersion != Version) throw new InvalidDataException($"Unsupported cache version {metadata.CacheVersion}.");
        return metadata;
    }

    public static void Verify(string cachePath)
    {
        var metadata = Inspect(cachePath);
        var ranges = Ranges(cachePath);
        using var file = File.OpenRead(cachePath);
        foreach (var column in metadata.Columns)
            VerifyColumn(file, column, ranges[column.BufferName]);
    }

    public static Dictionary<string, Dictionary<string, Array>> ReadColumns(string cachePath, bool includeGeometry = false)
    {
        var metadata = Inspect(cachePath);
        var ranges = Ranges(cachePath);
        var tables = new Dictionary<string, Dictionary<string, Array>>(StringComparer.OrdinalIgnoreCase);
        using var file = File.OpenRead(cachePath);
        foreach (var table in metadata.Columns.Where(c => includeGeometry || !c.IsGeometry).GroupBy(c => c.Table))
        {
            var columns = new Dictionary<string, Array>(StringComparer.OrdinalIgnoreCase);
            foreach (var column in table.GroupBy(c => c.Name))
            {
                var chunks = column.OrderBy(c => c.RowGroup).ToArray();
                var values = Array.CreateInstance(Type.GetType(chunks[0].TypeName, true)!, chunks.Sum(c => c.Count));
                var offset = 0;
                foreach (var chunk in chunks)
                {
                    var range = ranges[chunk.BufferName];
                    VerifyColumn(file, chunk, range);
                    file.Position = range.Begin;
                    var decoded = ColumnCodec.Read(file, chunk.TypeName, chunk.Count);
                    if (file.Position != range.End) throw new InvalidDataException($"Column length mismatch: {chunk.BufferName}.");
                    Array.Copy(decoded, 0, values, offset, decoded.Length); offset += decoded.Length;
                }
                columns.Add(column.Key, values);
            }
            tables.Add(table.Key, columns);
        }
        return tables;
    }

    public static BimModel Load(string cachePath, ConversionOptions? options = null)
    {
        var metadata = Inspect(cachePath);
        options ??= new(Path.GetFileNameWithoutExtension(metadata.SourcePath), IncludeGeometry: false);
        var manifest = metadata.SourceManifestJson is null ? new Manifest { BimOpenSchemaVersion = "unknown" }
            : JsonSerializer.Deserialize<Manifest>(metadata.SourceManifestJson) ?? new Manifest { BimOpenSchemaVersion = "unknown" };
        var data = SourceColumnDecoder.Decode(ReadColumns(cachePath, options.IncludeGeometry), manifest);
        return BimModelConverter.Convert(data, options).Match(model => model,
            issues => throw new InvalidDataException(string.Join("; ", issues.Select(i => i.Message))));
    }

    private static Dictionary<string, BFastRange> Ranges(string path)
    {
        var ranges = new Dictionary<string, BFastRange>(StringComparer.Ordinal);
        MemoryMappedView.ReadFile(path, view =>
        {
            var reader = new BFastReader(view);
            for (var i = 0; i < reader.BufferNames.Length; i++)
            { var (name, range) = reader.GetNameAndRange(i); ranges.Add(name, range); }
        });
        return ranges;
    }

    private static void VerifyColumn(Stream file, SourceColumn column, BFastRange range)
    {
        if (range.Count != column.Bytes) throw new InvalidDataException($"Buffer size mismatch: {column.BufferName}.");
        file.Position = range.Begin;
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var block = new byte[1024 * 1024];
        var remaining = range.Count;
        while (remaining > 0)
        {
            var count = (int)Math.Min(remaining, block.Length);
            file.ReadExactly(block.AsSpan(0, count)); hash.AppendData(block, 0, count); remaining -= count;
        }
        if (Convert.ToHexString(hash.GetHashAndReset()) != column.Sha256) throw new InvalidDataException($"Buffer checksum mismatch: {column.BufferName}.");
    }
}
