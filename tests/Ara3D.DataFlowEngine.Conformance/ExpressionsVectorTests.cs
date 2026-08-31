namespace Ara3D.DataFlowEngine.Conformance;

/// <summary>
/// spec/dataflow-graph/expressions/conformance is already executed vector-by-
/// vector in tests/Ara3D.DataFlowEngine.Expressions.Tests (ConformanceTests).
/// This placeholder keeps the pointer visible in this suite's results without
/// running the same vectors twice.
/// </summary>
[TestFixture]
public class ExpressionsVectorTests
{
    [Test]
    public void Expressions_vectors_run_in_the_Expressions_test_project()
        => Assert.Ignore(
            "Covered by tests/Ara3D.DataFlowEngine.Expressions.Tests ConformanceTests, "
            + $"which auto-discovers {Directory.GetFiles(SpecVectors.PartDir("expressions"), "*.json").Length} vectors");
}
