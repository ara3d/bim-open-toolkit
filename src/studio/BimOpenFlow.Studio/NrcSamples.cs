using BimOpenFlow.Host;

namespace BimOpenFlow.Studio;

/// <summary>Where the NRC paper's samples live: samples/nrc (the CSVs and the Duplex IFC files,
/// named as sources "nrc", "duplex-enriched", and "duplex-base"), and the two folders of graphs
/// over it, samples/nrc-analyses and samples/showcase-analyses. Both studio profiles seed the
/// graphs their registry can run.</summary>
public static class NrcSamples
{
    public const string IfcFileName = "duplex-enriched.ifc";
    public const string DatabaseFileName = "duplex-enriched.duckdb";
    public const string BosFileName = "duplex-enriched.bos";

    /// <summary>The unenriched Duplex that nrc-enrich-run writes into; its database is the
    /// "duplex-base" source the NRC graphs read StepIds and storeys from, so no graph reads the
    /// output of its own last Run.</summary>
    public const string BaseIfcFileName = "duplex-base.ifc";
    public const string BaseDatabaseFileName = "duplex-base.duckdb";

    /// <summary>samples/nrc under a checkout root.</summary>
    public static string Dir(string root)
        => Path.Combine(root, "samples", "nrc");

    /// <summary>The seeding source for samples/nrc-analyses, whose graphs name their sources
    /// and so need no placeholder.</summary>
    public static (string AnalysesDir, string Placeholder, string TargetDir) Analyses(string root)
        => (Path.Combine(root, "samples", "nrc-analyses"), SampleSeeding.PathPlaceholder, Dir(root));

    /// <summary>The seeding source for samples/showcase-analyses: the end-to-end demos over
    /// samples/nrc (CSV, the IFC, and the BOS and DuckDB prepared from it).</summary>
    public static (string AnalysesDir, string Placeholder, string TargetDir) Showcase(string root)
        => (Path.Combine(root, "samples", "showcase-analyses"), SampleSeeding.PathPlaceholder, Dir(root));
}
