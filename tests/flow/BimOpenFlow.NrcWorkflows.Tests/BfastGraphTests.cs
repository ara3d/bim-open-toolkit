using Ara3D.DataTable;
using Ara3D.DataFlowEngine.TestKit;
using BimOpenFlow.Host;
using BimOpenFlow.Relations;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>The BFAST showcase graph: bfast.read and bfast.buffer over the committed
/// samples/tables/sample.bfast into two view.table panes, in both host profiles. The graph
/// reaches the file as {SAMPLES}/../tables/sample.bfast because the showcase placeholder
/// stands for samples/nrc. Buffer names and sizes are those samples/tables/README.md lists.</summary>
[TestFixture]
public sealed class BfastGraphTests
{
    private const string Id = "bfast-buffers";

    private static GraphDocument Document()
        => SampleSeeding.RewritePaths(
            GraphDocumentIO.Load(Path.Combine(NrcPaths.Root, "samples", "showcase-analyses", Id + ".json")),
            NrcPaths.SamplesDir);

    private static IDataTable Table(EvalSnapshot snapshot, string nodeId)
        => ((TableValue)snapshot.Results[nodeId].Outputs[0]).Table;

    [Test]
    public void ListsTheFourBuffers_AndReadsThePrices_InBothProfiles()
    {
        var doc = Document();
        var runtime = RelationRuntime.FromRoots([NrcPaths.SamplesDir]);
        foreach (var registry in new[] { HostComposition.TablePacks(runtime), HostComposition.AllPacks(runtime) })
        {
            Assert.That(doc.Validate(registry), Is.Empty, Id);
            var snapshot = doc.Evaluate(registry);
            Assert.That(snapshot.Results.Where(r => r.Value.Status != NodeStatus.Ok)
                .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}"), Is.Empty, Id);

            var directory = Table(snapshot, "directory");
            var prices = Table(snapshot, "values");
            Assert.Multiple(() =>
            {
                Assert.That(directory.ColumnCells("name"), Is.EqualTo(new[] { "orderIds", "quantities", "unitPrices", "productCodes" }));
                Assert.That(directory.ColumnCells("byteLength"), Is.EqualTo(new object[] { 32L, 32L, 64L, 25L }));
                Assert.That(prices.ColumnNames(), Is.EqualTo(new[] { "value" }));
                Assert.That(prices.Rows, Has.Count.EqualTo(8));
                Assert.That(prices.Cell("value", 3), Is.EqualTo(99.99));
            });
        }
    }
}
