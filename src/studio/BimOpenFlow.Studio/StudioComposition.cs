using Ara3D.DataFlowEngine.Abstractions;
using BimOpenFlow.Host;
using BimOpenFlow.NodeDocs;
using BimOpenFlow.Nodes.BimAnalysis;
using BimOpenFlow.Nodes.Bos;
using BimOpenFlow.Nodes.Compliance;
using BimOpenFlow.Nodes.DuckDb;
using BimOpenFlow.Nodes.Effects;
using BimOpenFlow.Nodes.Geometry;
using BimOpenFlow.Nodes.Relations;
using BimOpenFlow.Nodes.Spatial;
using BimOpenFlow.Nodes.TableOps;
using BimOpenFlow.Nodes.Tables;
using BimOpenFlow.Nodes.Viz;

namespace BimOpenFlow.Studio;

/// <summary>The studio's composition root: the "bim" profile, which the generic host does not
/// know, and the "tables" profile with the NRC samples added. Wiring only.</summary>
public static class StudioComposition
{
    public const string BimProfile = "bim";

    /// <summary>The "bim" profile registry: the Bos, TableOps, BimAnalysis, Geometry,
    /// Compliance, Effects, and Viz packs, the DuckDB and Tables packs so an external value
    /// table (CSV, Parquet, a DuckDB query) can be joined to a model and drive a 3D
    /// colouring, the Spatial pack, plus the rel.* pack. Without a runtime the rel.* pack sees no
    /// sources, which is enough for validation, catalogs, and docs.</summary>
    public static NodeRegistry BimPacks(RelationRuntime? relations = null)
        => NodeRegistry.Combine(BosNodes.All, TableOpsNodes.All, BimAnalysisNodes.All, GeometryNodes.All,
            ComplianceNodes.All, EffectNodes.All, VizNodes.All, DuckDbNodes.All, TableNodes.All,
            SpatialNodes.All, RelationNodes.All(relations ?? HostComposition.NoSources()));

    /// <summary>The bim profile: samples/bim-analyses over a generated sample.bos, the 3D samples
    /// over data/, the NRC and showcase graphs, and the local Snowdon graphs when that model is
    /// present; the NRC files are prepared in the background.</summary>
    public static readonly HostProfile Bim = new(BimProfile, r => BimPacks(r),
        BimSampleSeeding.SeededModelRoots, BimSampleSeeding.Seed, NrcPreparation.Jobs);

    /// <summary>The generic tables profile plus the NRC and showcase graphs it can run and their
    /// samples/nrc root and background jobs.</summary>
    public static readonly HostProfile Tables = HostComposition.Tables with
    {
        SeededModelRoots = startDir => SampleSeeding.FindRepoRoot(startDir) is { } root
            ? [.. HostComposition.Tables.SeededModelRoots(startDir), NrcSamples.Dir(root)]
            : [],
        Seed = (store, startDir, registry, log) => SampleSeeding.SeedFromCheckout(store, startDir,
            root => [.. SampleSeeding.TableSources(root), NrcSamples.Analyses(root), NrcSamples.Showcase(root)],
            registry, log),
        Preparation = NrcPreparation.Jobs,
    };

    /// <summary>The profiles bimopenflow-studio offers; it starts with "bim".</summary>
    public static readonly HostProfiles Profiles = new(BimProfile, [Bim, Tables]);

    /// <summary>The BIM packs' sections of docs/nodes.md, which come before the generic ones.</summary>
    public static readonly IReadOnlyList<Pack> DocPacks =
    [
        new("BOS — `BimOpenFlow.Nodes.Bos`",
            "Loading BIM Open Schema (.bos) files and querying them with SQL; the general table transforms live in TableOps.",
            BosNodes.All),
        new("BIM analysis — `BimOpenFlow.Nodes.BimAnalysis`",
            "The bim.* pack: grouping tables (elements, rooms, levels), typed parameter tables and "
            + "coverage, bounding boxes with dimensions, spatial joins, discipline and room "
            + "classification, and door navigation graphs.",
            BimAnalysisNodes.All),
        new("Geometry — `BimOpenFlow.Nodes.Geometry`",
            "The view3d pack: the tables the 3D pane consumes — instances, colors, isolation, camera.",
            GeometryNodes.All),
    ];

    /// <summary>Every pack docs/nodes.md lists, in its order.</summary>
    public static IReadOnlyList<Pack> AllDocPacks
        => [.. DocPacks, .. NodeDocsProgram.GenericPacks];
}
