using Ara3D.BimOpenSchema.BuildingModel.Source;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

/// <summary>The Snowdon Towers sample, prepared and mapped once per test process for the large source-backed tests.
/// Tests call Require first, which skips the test when the export is not on this machine.</summary>
[Platonic.Impure]
public static class SnowdonSource
{
    public static string Path { get; } = Environment.GetEnvironmentVariable("BIM_OPEN_SCHEMA_SNOWDON")
        ?? "C:/Users/cdigg/Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos";

    private static readonly Lazy<(SourceCacheMetadata Metadata, BimModel Model)> source = new(Load);
    private static readonly Lazy<BuildingProjection> projection = new(() => BuildingMapper.Map(Model, Options()));

    public static void Require()
    {
        if (!File.Exists(Path)) Assert.Ignore($"Snowdon BOS fixture is unavailable: {Path}");
    }

    public static SourceCacheMetadata Metadata => source.Value.Metadata;
    public static BimModel Model => source.Value.Model;

    /// <summary>Mapped with the registered domains and the Revit internal storage policy the export needs.</summary>
    public static BuildingProjection Projection => projection.Value;

    public static MappingOptions Options()
        => new(Metadata.SourceSha256, "sha256:" + Metadata.SourceSha256, "snowdon", DateTimeOffset.UnixEpoch, NumericStorage: NumericStoragePolicy.RevitInternal);

    private static (SourceCacheMetadata, BimModel) Load()
    {
        var cache = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "bim-open-toolkit-tests", "snowdon-" + Guid.NewGuid().ToString("N") + ".bfast");
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(cache)!);
        try
        {
            return (SourceCache.Prepare(Path, cache), SourceCache.Load(cache));
        }
        finally
        {
            File.Delete(cache);
        }
    }
}
