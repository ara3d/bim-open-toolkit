using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.IO;
using Ara3D.DataTable;
using Ara3D.Utils;

namespace Ara3D.BIMOpenSchema.Tests;

/// <summary>
/// Regression tests for the ParameterType parquet encoding. The SDK's ToDataTable encodes
/// enums by position in Enum.GetValues; while ParameterType had a Bool = Int alias, every
/// stored code >= 1 was shifted +1, and the numeric-cast reader (and the DuckDB views)
/// mislabeled every typed value in parquet-derived data.
/// </summary>
public static class ParquetParameterTypeTests
{
    public static BimData CreateDataWithAllParameterTypes()
    {
        var bdb = new BimDataBuilder();
        var doc = bdb.AddDocument("doc", "path");
        var other = bdb.AddEntity(1, "guid-other", doc, "Other", BimDataBuilder.InvalidEntityIndex, BimDataBuilder.InvalidEntityIndex);
        var e = bdb.AddEntity(2, "guid-e", doc, "Entity", BimDataBuilder.InvalidEntityIndex, BimDataBuilder.InvalidEntityIndex);
        bdb.AddParameter(e, 7, "IntParam", "", "G");
        bdb.AddParameter(e, 2.5, "NumberParam", "m", "G");
        bdb.AddParameter(e, other, "EntityParam", "", "G");
        bdb.AddParameter(e, "text", "StringParam", "", "G");
        bdb.AddParameter(e, new Point(1, 2, 3), "PointParam", "", "G");
        return bdb.Build();
    }

    public static FilePath WriteToTempBosZip(BimData data)
    {
        var folder = Path.Combine(Path.GetTempPath(), "ara3d-bos-tests");
        Directory.CreateDirectory(folder);
        var fp = new FilePath(Path.Combine(folder, $"{Guid.NewGuid():N}.bos"));
        data.WriteToParquetZip(fp);
        return fp;
    }

    [Test]
    public static void ParquetStoresParameterTypeAsItsNumericValue()
    {
        var data = CreateDataWithAllParameterTypes();
        Assert.That(data.Descriptors.Select(d => d.Type),
            Is.EquivalentTo(new[]
            {
                ParameterType.Int, ParameterType.Number, ParameterType.Entity,
                ParameterType.String, ParameterType.Point,
            }));

        var fp = WriteToTempBosZip(data);
        try
        {
            var dataSet = fp.ReadParquetFromZip();
            var descriptors = dataSet.GetTable(nameof(BimData.Descriptors));
            Assert.That(descriptors, Is.Not.Null);
            var typeColumn = descriptors!.Columns.Single(c => c.Descriptor.Name == nameof(ParameterDescriptor.Type));
            for (var i = 0; i < data.Descriptors.Length; i++)
                Assert.That(Convert.ToInt32(typeColumn[i]), Is.EqualTo((int)data.Descriptors[i].Type),
                    $"Stored code for descriptor {i} must equal the enum's numeric value");
        }
        finally
        {
            if (File.Exists(fp.FullPath))
                File.Delete(fp.FullPath);
        }
    }

    [Test]
    public static void ParquetRoundTripPreservesDescriptorTypes()
    {
        var data = CreateDataWithAllParameterTypes();
        var fp = WriteToTempBosZip(data);
        try
        {
            var descriptors = fp.ReadParquetFromZip().GetTable(nameof(BimData.Descriptors));
            var roundTripped = descriptors!.Rows.Select(r => ParquetUtils.ToDescriptor(r.Values.ToArray()));
            Assert.That(roundTripped.Select(d => d.Type),
                Is.EqualTo(data.Descriptors.Select(d => d.Type)));
        }
        finally
        {
            if (File.Exists(fp.FullPath))
                File.Delete(fp.FullPath);
        }
    }

    /// <summary>Regression: WriteToParquetZip omits geometry tables, and
    /// ReadBimDataFromParquetZip used to throw NullReferenceException on such files.</summary>
    [Test]
    public static void ParquetRoundTripReadsDataOnlyZip()
    {
        var data = CreateDataWithAllParameterTypes();
        var fp = WriteToTempBosZip(data);
        try
        {
            var roundTripped = fp.ReadBimDataFromParquetZip();
            Assert.That(roundTripped.Entities.Length, Is.EqualTo(data.Entities.Length));
            Assert.That(roundTripped.Parameters.Length, Is.EqualTo(data.Parameters.Length));
            Assert.That(roundTripped.Descriptors.Select(d => d.Type),
                Is.EqualTo(data.Descriptors.Select(d => d.Type)));
            Assert.That(roundTripped.Geometry, Is.Not.Null);
            Assert.That(roundTripped.Geometry.InstanceEntityIndex, Is.Empty);
        }
        finally
        {
            if (File.Exists(fp.FullPath))
                File.Delete(fp.FullPath);
        }
    }
}
