using Ara3D.Ifc.DuckDb;
using Ara3D.Utils;
using BimOpenFlow.Host;
using Job = BimOpenFlow.Host.SamplePreparation.Job;

namespace BimOpenFlow.Studio;

/// <summary>The NRC samples the studio generates after its port opens: the DuckDBs built from
/// samples/nrc/duplex-enriched.ifc and duplex-base.ifc, and the enriched IFC as a .bos file for
/// bos.load. Each takes about 30 s cold; SamplePreparation runs them in the background.</summary>
public static class NrcPreparation
{
    public const string SourceName = "duplex-enriched";

    /// <summary>The source name of the database built from samples/nrc/duplex-base.ifc.</summary>
    public const string BaseSourceName = "duplex-base";

    /// <summary>The BOS file is a path for bos.load, not a named relation source; the job
    /// carries this name only for its log lines.</summary>
    public const string BosName = "duplex-enriched.bos";

    /// <summary>The NRC database job for a checkout root, or null when the IFC is not there.</summary>
    public static Job? Database(string root)
        => DatabaseJob(root, SourceName, NrcSamples.IfcFileName, NrcSamples.DatabaseFileName);

    /// <summary>The database job for the unenriched Duplex, or null when its IFC is not there.</summary>
    public static Job? BaseDatabase(string root)
        => DatabaseJob(root, BaseSourceName, NrcSamples.BaseIfcFileName, NrcSamples.BaseDatabaseFileName);

    private static Job? DatabaseJob(string root, string source, string ifcName, string databaseName)
    {
        var dir = NrcSamples.Dir(root);
        var ifc = Path.Combine(dir, ifcName);
        return File.Exists(ifc)
            ? new(source, ifc, Path.Combine(dir, databaseName),
                (input, output) => IfcDuckDbBuild.Build(new FilePath(input), new FilePath(output)))
            : null;
    }

    /// <summary>The NRC BOS job (the IFC converted to a .bos file for bos.load), or null when
    /// the IFC is not there.</summary>
    public static Job? Bos(string root)
    {
        var dir = NrcSamples.Dir(root);
        var ifc = Path.Combine(dir, NrcSamples.IfcFileName);
        return File.Exists(ifc)
            ? new(BosName, ifc, Path.Combine(dir, NrcSamples.BosFileName),
                (input, output) => IfcDuckDbBuild.SaveBos(new FilePath(input), new FilePath(output)))
            : null;
    }

    /// <summary>Every job for the checkout that contains startDir; empty outside a checkout.</summary>
    public static IReadOnlyList<Job> Jobs(string startDir)
        => SampleSeeding.FindRepoRoot(startDir) is { } root
            ? new[] { Database(root), BaseDatabase(root), Bos(root) }.Where(j => j is not null).Select(j => j!).ToList()
            : [];
}
