using Ara3D.IfcMeshingComparison.Harness;
using Ara3D.Utils;

namespace Ara3D.IfcMeshingComparison.Tests.Support;

/// <summary>
/// One comparison of FM_ARC_DigitalHub against its web-ifc oracle, shared by the tests that assert on it.
/// Meshing and comparing this file takes about a minute, and WP-W11 and WP-W12 read different scores from
/// the same result, so running it once per test run halves their cost without changing what either checks.
/// </summary>
public static class DigitalHubComparison
{
    public static FilePath Ifc => new(@"c:\Users\cdigg\git\studio\data\FM_ARC_DigitalHub.ifc");

    static readonly Lazy<ModelComparisonResult> result = new(() =>
    {
        var bfastPath = WebIfcBfastOracle.OraclePath(Ifc);
        if (!bfastPath.Exists() || WebIfcBfastOracle.NeedsRegeneration(Ifc, bfastPath))
            WebIfcBfastOracle.Generate(Ifc, TestContext.WriteLine);
        return ModelComparer.CompareFile(Ifc);
    });

    /// <summary>The shared result; ignores the calling test when the private IFC file is absent.</summary>
    public static ModelComparisonResult Result
    {
        get
        {
            TestFiles.RequireExists(Ifc);
            return result.Value;
        }
    }
}
