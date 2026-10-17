using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using BimOpenFlow.Host;
using BimOpenFlow.Relations;
using NUnit.Framework.Constraints;
using BimOpenFlow.Studio;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>The nrc-q* graphs over samples/nrc: each document validates, evaluates green,
/// and its answer node materializes to the numbers the NRC paper published. Every
/// asserted number cites nrc-ifc-llm/poc/results/expected_answers.json by question key,
/// or poc/data/nrc_analytics_storeys.csv by row.
/// The registry is built here rather than taken from Fixture so these tests do not
/// depend on the DuckDB build (track A).</summary>
[TestFixture]
public sealed class CsvGraphTests
{
    private const double Tolerance = 0.05;

    private static readonly RelationRuntime Runtime =
        RelationRuntime.FromRoots([NrcPaths.SamplesDir]);

    private static readonly NodeRegistry Registry =
        StudioComposition.BimPacks(Runtime);

    /// <summary>Loads the graph, asserts it validates and evaluates green, and returns the
    /// rows of its answer relation.</summary>
    private static IDataTable Answer(string id)
    {
        var doc = GraphDocumentIO.Load(NrcPaths.Graph(id));
        Assert.That(doc.Validate(Registry), Is.Empty, id);
        var snapshot = doc.Evaluate(Registry);
        Assert.That(snapshot.Results.Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Error}"), Is.Empty, id);
        var output = snapshot.Results["answer"].Outputs[0];
        return Runtime.Materialize((Plan)((RelationValue)output).Payload!);
    }

    private static double Number(IDataTable table, string column, int row)
        => Convert.ToDouble(table.Cell(column, row));

    private static IReadOnlyList<double> Numbers(IDataTable table, string column)
        => table.ColumnCells(column).Select(Convert.ToDouble).ToList();

    private static Constraint Near(params double[] expected)
        => Is.EqualTo(expected).Within(Tolerance);

    [Test]
    public void Q1_BuildingTotal()
    {
        var answer = Answer("nrc-q1-building-total");
        Assert.That(answer.Rows, Has.Count.EqualTo(1));
        // expected_answers.json Q1: 37196.2 kgCO2e/yr over the 218 rows of nrc_analytics_elements.csv.
        Assert.That(Number(answer, "OperationalCarbon_kgCO2e_per_year", 0), Is.EqualTo(37196.2).Within(Tolerance));
        Assert.That(answer.Cell("Elements", 0), Is.EqualTo(218L));
    }

    [Test]
    public void Q8_PerStorey()
    {
        var answer = Answer("nrc-q8-per-storey");
        Assert.That(answer.Rows, Has.Count.EqualTo(4));
        // expected_answers.json Q8, in descending embodied carbon.
        Assert.That(answer.ColumnCells("Storey"),
            Is.EqualTo(new object?[] { "Level 1", "Level 2", "T/FDN", "Roof" }));
        Assert.That(Numbers(answer, "EmbodiedCarbon_A1A3_kgCO2e"), Near(49451.2, 48696.8, 11761.3, 5821.0));
        // nrc_analytics_storeys.csv row "Level 1": 103 elements; Q2: mean EUI 40.5.
        Assert.That(answer.Cell("Elements", 0), Is.EqualTo(103L));
        Assert.That(Number(answer, "MeanEui_kWh_per_m2_year", 0), Is.EqualTo(40.5).Within(Tolerance));
        // Honest absence (Q7 in the paper): Roof has 8 elements, but only 7 carry an embodied-carbon row;
        // the sum in "EmbodiedCarbon_A1A3_kgCO2e" covers only those 7, and ElementsWithValue says so.
        Assert.That(answer.Cell("Elements", 3), Is.EqualTo(8L));
        Assert.That(answer.Cell("ElementsWithValue", 3), Is.EqualTo(7L));
        Assert.That(answer.Cell("ElementsWithValue", 0), Is.EqualTo(103L));
    }

    [Test]
    public void Q2_StoreyEui()
    {
        var answer = Answer("nrc-q2-storey-eui");
        Assert.That(answer.Rows, Has.Count.EqualTo(2));
        // nrc_analytics_storeys.csv: Level 1 mean EUI 40.5, Level 2 mean EUI 40.56;
        // Level 2 is higher, so the higher-first sort puts it first.
        Assert.That(answer.ColumnCells("Storey"), Is.EqualTo(new object?[] { "Level 2", "Level 1" }));
        Assert.That(Numbers(answer, "MeanEui_kWh_per_m2_year"), Near(40.56, 40.5));
        Assert.That(answer.ColumnCells("Elements"), Is.EqualTo(new object?[] { 93L, 103L }));
    }

    [Test]
    public void Q4_DoorByGlobalId()
    {
        var answer = Answer("nrc-q4-door-instances");
        // Q4 asks for the door with GlobalId 1hOSvn6df7F8_7GcBWlS8Z. A GlobalId names one
        // instance (the family:type name M_Single-Flush:0762 x 2032mm is shared by four doors),
        // so the answer is one row: operational carbon 54.0 kgCO2e/yr, from nrc_analytics_elements.csv.
        Assert.That(answer.Rows, Has.Count.EqualTo(1));
        Assert.That(answer.Cell("GlobalId", 0), Is.EqualTo("1hOSvn6df7F8_7GcBWlS8Z"));
        Assert.That(answer.Cell("EntityId", 0), Is.EqualTo(8066L));
        Assert.That(Number(answer, "OperationalCarbon_kgCO2e_per_year", 0), Is.EqualTo(54.0).Within(Tolerance));
    }

    [Test]
    public void Q6_AnalysisRun()
    {
        var answer = Answer("nrc-q6-analysis-run");
        // Every one of the 218 rows in nrc_analytics_elements.csv cites the same run.
        // "when" and the source tool come from samples/nrc/nrc-run.csv, a run-level fact file
        // (expected_answers.json Q6: ComputedAt 2026-09-17T00:00:00Z, SourceTool
        // nrc-ifc-llm/poc/generate_synthetic_analytics.py).
        Assert.That(answer.Rows, Has.Count.EqualTo(1));
        Assert.That(answer.Cell("AnalysisRunId", 0), Is.EqualTo("run-2026-09-17-01"));
        Assert.That(answer.Cell("ScenarioName", 0), Is.EqualTo("Baseline"));
        Assert.That(answer.Cell("Elements", 0), Is.EqualTo(218L));
        Assert.That(answer.Cell("ComputedAt", 0), Is.EqualTo("2026-09-17T00:00:00Z"));
        Assert.That(answer.Cell("SourceTool", 0), Is.EqualTo("nrc-ifc-llm/poc/generate_synthetic_analytics.py"));
    }

    [Test]
    public void Q3_TopElements()
    {
        var answer = Answer("nrc-q3-top-elements");
        Assert.That(answer.Rows, Has.Count.EqualTo(5));
        // expected_answers.json Q3, in the order it lists them.
        Assert.That(answer.ColumnCells("GlobalId"), Is.EqualTo(new object?[]
        {
            "0iEHWY1$XA8eQeeULq4jpl", "0jf0rYHfX3RAB3bSIRjmr1", "0iEHWY1$XA8eQeeULq4ien",
            "3Y4YRln2r91vflHcHE5IVT", "3Y4YRln2r91vflHcHE5IVS",
        }));
        Assert.That(Numbers(answer, "OperationalCarbon_kgCO2e_per_year"),
            Near(412.0, 410.8, 402.0, 399.7, 398.6));
    }

    [Test]
    public void Q5_ByIfcClass()
    {
        var answer = Answer("nrc-q5-by-category");
        // The file carries no Category property, so Q5 asks per IFC class: 14 classes over the
        // 218 rows of nrc_analytics_elements.csv, in descending total; the totals sum to Q1's 37196.2.
        Assert.That(answer.Rows, Has.Count.EqualTo(14));
        Assert.That(answer.ColumnCells("IfcType"), Is.EqualTo(new object?[]
        {
            "IFCWALLSTANDARDCASE", "IFCSLAB", "IFCFURNISHINGELEMENT", "IFCFOOTING", "IFCDOOR", "IFCCOVERING",
            "IFCWINDOW", "IFCBEAM", "IFCMEMBER", "IFCWALL", "IFCSTAIRFLIGHT", "IFCSTAIR", "IFCROOF", "IFCRAILING",
        }));
        var totals = Numbers(answer, "OperationalCarbon_kgCO2e_per_year");
        Assert.That(totals, Near(17547.4, 5816.9, 5766.3, 2086.9, 1324.7, 985.7, 978.9, 771.6, 560.0, 357.5, 311.5, 272.7, 251.3, 164.8));
        Assert.That(totals.Sum(), Is.EqualTo(37196.2).Within(Tolerance));
    }

    [Test]
    public void Q9_ZoneEnergyUseIntensity()
    {
        var answer = Answer("nrc-q9-zone-eui");
        // Q9 is new in the zone-level work: the four zones of nrc-zones.csv, synthetic, each zone's
        // annual energy divided by the sum of its spaces' floor areas, highest first.
        Assert.That(answer.Rows, Has.Count.EqualTo(4));
        Assert.That(answer.ColumnCells("Zone"), Is.EqualTo(new object?[]
        {
            "Unit B Level 1", "Unit A Level 1", "Unit B Level 2", "Unit A Level 2",
        }));
        Assert.That(Numbers(answer, "ZoneEnergyUseIntensity_kWh_per_m2_year"), Is.EqualTo(new[] { 78.04, 72.93, 64.6, 60.94 }).Within(0.005));
        Assert.That(answer.ColumnCells("Spaces"), Is.EqualTo(new object?[] { 5L, 5L, 5L, 5L }));
        Assert.That(Numbers(answer, "TotalFloorArea_m2"), Near(70.9, 70.9, 67.3, 67.3));
    }

    [Test]
    public void Q7_Absence()
    {
        var answer = Answer("nrc-q7-absence");
        // Q7 asks which analysed elements carry no embodied-carbon property set: exactly one, the
        // roof. nrc_analytics_long.csv holds two other metrics for it, which the graph's aggregate
        // collapses to one row per GlobalId.
        Assert.That(answer.Rows, Has.Count.EqualTo(1));
        Assert.That(answer.ColumnNames(), Is.EqualTo(new[] { "IfcClass", "GlobalId", "OtherMetrics" }));
        Assert.That(answer.Cell("GlobalId", 0), Is.EqualTo("0jf0rYHfX3RAB3bSIRjmxl"));
        Assert.That(answer.Cell("IfcClass", 0), Is.EqualTo("IFCROOF"));
        Assert.That(Convert.ToInt64(answer.Cell("OtherMetrics", 0)), Is.EqualTo(2L), "the roof's two other metrics");
    }
}
