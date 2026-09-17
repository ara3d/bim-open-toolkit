using System.IO.Compression;
using System.Security.Cryptography;
using Ara3D.BimOpenSchema.BuildingModel.Source;
using Ara3D.IO.BFAST;
using Ara3D.Memory;
using Parquet;
using Parquet.Data;
using Parquet.Schema;
using Platonic;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

[Impure, TestFixture, Category("Feature.SourceCache"), Category("Size.Small")]
public sealed class SourceReaderTests
{
    private string directory = null!;
    private string Source => Path.Combine(directory, "fixture.bos");
    private string Cache => Path.Combine(directory, "fixture.bfast");

    [SetUp]
    public void SetUp() => directory = Directory.CreateDirectory(Path.Combine(TestContext.CurrentContext.WorkDirectory, "cache-" + Guid.NewGuid().ToString("N"))).FullName;

    [TearDown]
    public void TearDown()
    {
        var expected = Path.GetFullPath(TestContext.CurrentContext.WorkDirectory) + Path.DirectorySeparatorChar;
        if (!Path.GetFullPath(directory).StartsWith(expected, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Unexpected test directory.");
        Directory.Delete(directory, true);
    }

    [Test]
    public void CachePreservesAllGroupsTypedValuesManifestAndGeometry()
    {
        WriteFixture();
        var metadata = SourceCache.Prepare(Source, Cache);
        using (var input = File.OpenRead(Source)) Assert.That(metadata.SourceSha256, Is.EqualTo(Convert.ToHexString(SHA256.HashData(input))));
        Assert.That(metadata.SourceManifestJson, Does.Contain("\"CustomEvidence\":\"retained\""));
        SourceCache.Verify(Cache);
        var tables = SourceCache.ReadColumns(Cache, true);
        Assert.That(tables["Entities"]["LocalId"], Is.TypeOf<long[]>());
        Assert.That(tables["Entities"]["LocalId"], Is.EqualTo(new long[] { 10, 20 }));
        Assert.That(tables["Extra"]["NullableValue"], Is.TypeOf<int?[]>());
        Assert.That(tables["Extra"]["NullableValue"], Is.EqualTo(new int?[] { 42, null, -7 }));
        Assert.That(tables["Extra"]["Text"], Is.EqualTo(new string?[] { "embedded\0NUL", null, "Büro" }));
        var numbers = (float[])tables["Extra"]["Float"];
        Assert.That(numbers.Select(BitConverter.SingleToInt32Bits), Is.EqualTo(new[] { unchecked((int)0x80000000), 0x7f800000, unchecked((int)0xff800000) }));
        Assert.That(tables["VertexBuffer"]["VertexX"], Is.EqualTo(new[] { int.MinValue, 0, int.MaxValue }));
    }

    [Test]
    public void CoreLoaderReopensWithoutBosAndSkipsGeometryBuffers()
    {
        WriteFixture();
        var metadata = SourceCache.Prepare(Source, Cache);
        Corrupt(metadata.Columns.First(c => c.IsGeometry).BufferName);
        File.Delete(Source);
        var model = SourceCache.Load(Cache);
        Assert.That(model.Tables.Entities.Select(e => e.LocalId), Is.EqualTo(new long[] { 10, 20 }));
        Assert.That(model.Tables.Geometry, Is.Empty);
        Assert.That(model.Tables.Instances, Is.Empty);
        Assert.That(model.Tables.Metadata.SourceSchemaVersion, Is.EqualTo("test-schema"));
        Assert.That(model.Tables.Properties.Select(p => p.NumberValue), Is.EqualTo(new double[] { 1000, 2000 }));
        Assert.That(model.Tables.Properties.All(p => p.CanonicalNumber is null), Is.True, "Display units do not establish stored units.");
        Assert.That(SourceCache.ReadColumns(Cache).ContainsKey("VertexBuffer"), Is.False);
        Assert.Throws<InvalidDataException>(() => SourceCache.Verify(Cache));
    }

    [Test]
    public void CorruptUsedBufferIsRejectedByLoadAndReuse()
    {
        WriteFixture();
        var metadata = SourceCache.Prepare(Source, Cache);
        Corrupt(metadata.Columns.First(c => c.Table == "Numbers").BufferName);
        Assert.Throws<InvalidDataException>(() => SourceCache.Load(Cache));
        Assert.Throws<InvalidDataException>(() => SourceCache.Prepare(Source, Cache));
    }

    [Test]
    public void ChangedSourceRebuildsFingerprintAndValues()
    {
        WriteFixture();
        var first = SourceCache.Prepare(Source, Cache);
        WriteFixture(3000f);
        var second = SourceCache.Prepare(Source, Cache);
        Assert.That(second.SourceSha256, Is.Not.EqualTo(first.SourceSha256));
        Assert.That(SourceCache.Load(Cache).Tables.Properties[0].NumberValue, Is.EqualTo(3000));
    }

    private void Corrupt(string name)
    {
        long position = 0;
        MemoryMappedView.ReadFile(Cache, view =>
        {
            var reader = new BFastReader(view);
            position = reader.GetNameAndRange(Array.IndexOf(reader.BufferNames, name)).Item2.Begin;
        });
        using var output = new FileStream(Cache, FileMode.Open, FileAccess.ReadWrite);
        output.Position = position;
        var value = output.ReadByte(); output.Position = position; output.WriteByte((byte)(value ^ 0x55));
    }

    private void WriteFixture(float firstValue = 1000f)
    {
        using var file = File.Create(Source);
        using var zip = new ZipArchive(file, ZipArchiveMode.Create);
        using (var manifest = new StreamWriter(zip.CreateEntry("Manifest.json").Open()))
            manifest.Write("{\"BimOpenSchemaVersion\":\"test-schema\",\"GeneratorApplication\":\"fixture\",\"CustomEvidence\":\"retained\"}");
        WriteTable(zip, "Strings", [new DataField<string>("Strings")], [[new[] { "Height", "mm", "P" }]]);
        WriteTable(zip, "Documents", [new DataField<int>("Title"), new DataField<int>("Path")], [[new[] { 2 }, new[] { -1 }]]);
        WriteTable(zip, "Entities", [new DataField<long>("LocalId"), new DataField<int>("GlobalId"), new DataField<int>("Document"),
            new DataField<int>("Name"), new DataField<int>("Category"), new DataField<int>("Type")],
            [[new long[] { 10 }, new[] { -1 }, new[] { 0 }, new[] { 0 }, new[] { -1 }, new[] { -1 }],
             [new long[] { 20 }, new[] { -1 }, new[] { 0 }, new[] { 0 }, new[] { -1 }, new[] { -1 }]]);
        WriteTable(zip, "Descriptors", [new DataField<int>("Name"), new DataField<int>("Units"), new DataField<int>("Group"), new DataField<int>("Type")],
            [[new[] { 0 }, new[] { 1 }, new[] { -1 }, new[] { 1 }]]);
        WriteTable(zip, "Numbers", [new DataField<float>("Numbers")], [[new[] { firstValue }], [new[] { 2000f }]]);
        WriteTable(zip, "Parameters", [new DataField<int>("Entity"), new DataField<int>("Descriptor"), new DataField<int>("Value")],
            [[new[] { 0 }, new[] { 0 }, new[] { 0 }], [new[] { 1 }, new[] { 0 }, new[] { 1 }]]);
        WriteTable(zip, "VertexBuffer", [new DataField<int>("VertexX")], [[new[] { int.MinValue, 0, int.MaxValue }]]);
        WriteTable(zip, "Extra", [new DataField<int?>("NullableValue"), new DataField<string>("Text"), new DataField<float>("Float")],
            [[new int?[] { 42, null, -7 }, new string?[] { "embedded\0NUL", null, "Büro" },
                new[] { BitConverter.Int32BitsToSingle(unchecked((int)0x80000000)), float.PositiveInfinity, float.NegativeInfinity }]]);
    }

    private static void WriteTable(ZipArchive zip, string name, DataField[] fields, Array[][] groups)
    {
        using var buffer = new MemoryStream();
        using (var writer = ParquetWriter.CreateAsync(new ParquetSchema(fields), buffer).GetAwaiter().GetResult())
            foreach (var columns in groups)
            {
                using var group = writer.CreateRowGroup();
                for (var i = 0; i < fields.Length; i++) group.WriteColumnAsync(new DataColumn(fields[i], columns[i])).GetAwaiter().GetResult();
            }
        buffer.Position = 0;
        using var entry = zip.CreateEntry(name + ".parquet").Open(); buffer.CopyTo(entry);
    }
}
