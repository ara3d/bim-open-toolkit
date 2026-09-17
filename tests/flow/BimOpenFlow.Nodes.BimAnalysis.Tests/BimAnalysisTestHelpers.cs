using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using Ara3D.Utils;
using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

/// <summary>Pack-specific test sugar; the shared helpers live in
/// Ara3D.DataFlowEngine.TestKit.NodeTestHelpers. The sample .bos is the
/// BimSampleModel building, written once per test run to a temp file.</summary>
internal static class BimAnalysisTestHelpers
{
    private static readonly Lazy<string> BosPath = new(WriteSample);

    public static string SampleBosPath => BosPath.Value;

    private static string WriteSample()
    {
        var path = Path.Combine(Path.GetTempPath(), "bimopenflow-bimanalysis-tests",
            $"sample-{Guid.NewGuid():N}.bos");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        Ara3D.BimOpenSchema.IO.ParquetUtils.WriteToParquetZip(BimSampleModel.Build(), new FilePath(path));
        return path;
    }

    /// <summary>Evaluates a source node (no inputs) against the sample model.</summary>
    public static IDataTable SampleTable(this IFlowNode node, params (string Name, string Value)[] ps)
        => node.EvalTable([], [("path", SampleBosPath), .. ps]);
}
