using System.Globalization;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using BimOpenFlow.Relations;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>The analytics contract (TKT-48): nrc-element-psets and nrc-rollup derive every
/// property-set row from samples/nrc/nrc-metrics.csv, nrc_analytics_long.csv, nrc-run.csv, and the
/// duplex-base model, and nrc-enrich-run writes the two together. The references are the Python
/// generator's own outputs, computed independently of the graphs: nrc_analytics_elements.csv for
/// element values and nrc_analytics_storeys.csv for the totals.</summary>
[TestFixture]
public sealed class RollupGraphTests
{
    private const string ElementGraph = "nrc-element-psets";
    private const string RollupGraph = "nrc-rollup";
    private const string EnrichGraph = "nrc-enrich-run";

    private static readonly RelationRuntime Runtime = Fixture.Runtime;

    private static IReadOnlyList<PsetRow> Answer(string id)
        => PsetRow.All(ModelGraphTests.AnswerRows(
            ModelGraphTests.EvaluateGreen(ModelGraphTests.Document(id), id, Fixture.Registry(Runtime)), Runtime));

    private static IDataTable Csv(string file)
        => Runtime.Materialize(Plans.Csv("nrc", file));

    [Test]
    public void ElementPsets_EqualTheRowsTheGeneratorWrote()
    {
        var actual = Answer(ElementGraph);

        // 218 elements carry an operational (4 values) and an energy set (3); 217 carry an embodied
        // set (4), the roof deliberately not (Q7): 218 * 7 + 217 * 4 = 2,394.
        Assert.That(actual, Has.Count.EqualTo(2394));
        Assert.That(actual.Select(r => r.Normalized()), Is.EquivalentTo(ExpectedElementRows()));
    }

    /// <summary>While samples/nrc/psets_to_write.csv is still committed, the element rows equal its
    /// element rows exactly, text for text.</summary>
    [Test]
    public void ElementPsets_EqualTheElementRowsOfPsetsToWrite()
    {
        var elements = Csv("nrc_analytics_elements.csv").ColumnCells("EntityId").Select(Convert.ToInt64).ToHashSet();
        var expected = PsetRow.All(Csv("psets_to_write.csv")).Where(r => elements.Contains(r.EntityId));
        Assert.That(Answer(ElementGraph), Is.EquivalentTo(expected));
    }

    [Test]
    public void Rollup_TotalsMatchTheStoreyCsv_UnderTheirOwnNames()
    {
        var rows = Answer(RollupGraph);
        var storeys = Csv("nrc_analytics_storeys.csv");
        Assert.That(storeys.Rows, Has.Count.EqualTo(5), "four storeys and the Building row");

        for (var row = 0; row < storeys.Rows.Count; row++)
        {
            var entity = Convert.ToInt64(storeys.Cell("EntityId", row));
            var set = Equals(storeys.Cell("Container", row), "Building") ? "Pset_NRCBuildingSummary" : "Pset_NRCStoreySummary";
            var values = rows.Where(r => r.EntityId == entity && r.PsetName == set)
                .ToDictionary(r => r.ParamName, r => r.ParamValue);
            var container = (string)storeys.Cell("Container", row)!;

            // To the decimal: sums were rounded to 1 place and means to 2 by the generator.
            Assert.Multiple(() =>
            {
                Assert.That(values.Keys, Is.EquivalentTo(new[]
                {
                    "ElementCount", "TotalEmbodiedCarbon_A1A3_kgCO2e", "TotalEmbodiedCarbon_A1A5_kgCO2e",
                    "TotalOperationalCarbon_kgCO2e_per_year", "MeanEnergyUseIntensity_kWh_per_m2_year",
                    "AnalysisRunId", "ScenarioName",
                }), container);
                Assert.That(Decimal(values["ElementCount"]), Is.EqualTo(Decimal(storeys.Cell("Elements", row))), container);
                Assert.That(Decimal(values["TotalEmbodiedCarbon_A1A3_kgCO2e"]),
                    Is.EqualTo(Decimal(storeys.Cell("EmbodiedCarbon_A1A3_kgCO2e", row))), container);
                Assert.That(Decimal(values["TotalEmbodiedCarbon_A1A5_kgCO2e"]),
                    Is.EqualTo(Decimal(storeys.Cell("EmbodiedCarbon_A1A5_kgCO2e", row))), container);
                Assert.That(Decimal(values["TotalOperationalCarbon_kgCO2e_per_year"]),
                    Is.EqualTo(Decimal(storeys.Cell("OperationalCarbon_kgCO2e_per_year", row))), container);
                Assert.That(Decimal(values["MeanEnergyUseIntensity_kWh_per_m2_year"]),
                    Is.EqualTo(Decimal(storeys.Cell("MeanEnergyUseIntensity_kWh_per_m2_year", row))), container);
                Assert.That(values["AnalysisRunId"], Is.EqualTo(RunFact("AnalysisRunId")), container);
                Assert.That(values["ScenarioName"], Is.EqualTo(RunFact("ScenarioName")), container);
            });
        }

        // Q1 and Q8 of expected_answers.json, read from the rows the graph will write.
        Assert.That(rows.Single(r => r.PsetName == "Pset_NRCBuildingSummary"
            && r.ParamName == "TotalOperationalCarbon_kgCO2e_per_year").ParamValue, Is.EqualTo("37196.2"));
        Assert.That(rows.Single(r => r.EntityId == 39
            && r.ParamName == "TotalEmbodiedCarbon_A1A3_kgCO2e").ParamValue, Is.EqualTo("49451.2"));
    }

    /// <summary>The storage defect of gap report 2.10 as a rule on the rows: no summary row reuses a
    /// property name that an element set carries, so a query on an element property never meets a total.</summary>
    [Test]
    public void Rollup_NeverUsesAnElementPropertyName()
    {
        var metrics = Csv("nrc-metrics.csv");
        var elementNames = Enumerable.Range(0, metrics.Rows.Count)
            .Where(row => Equals(metrics.Cell("Level", row), "element"))
            .Select(row => (string)metrics.Cell("PropertyName", row)!)
            .ToHashSet();
        var summaries = Answer(RollupGraph).Where(r => r.PsetName != "Pset_NRCAnalyticsProvenance").ToList();

        Assert.That(summaries, Has.Count.EqualTo(35), "7 values on each of 4 storeys and the building");
        Assert.That(summaries.Select(r => r.ParamName), Has.None.AnyOf(elementNames.ToArray()));
        Assert.That(summaries.Select(r => r.PsetName).Distinct(),
            Is.EquivalentTo(new[] { "Pset_NRCStoreySummary", "Pset_NRCBuildingSummary" }));
    }

    [Test]
    public void Rollup_WritesEveryRunFactIntoTheProjectsProvenanceSet()
    {
        var provenance = Answer(RollupGraph).Where(r => r.PsetName == "Pset_NRCAnalyticsProvenance").ToList();
        var run = Csv("nrc-run.csv");
        var expected = Enumerable.Range(0, run.Rows.Count)
            .Select(row => ((string)run.Cell("Field", row)!, (string)run.Cell("ValueType", row)!, (string)run.Cell("Value", row)!));

        Assert.That(provenance.Select(r => r.EntityId).Distinct(), Has.Exactly(1).Items, "one IfcProject");
        Assert.That(provenance.Select(r => (r.ParamName, r.ValueType, r.ParamValue)), Is.EquivalentTo(expected));
        Assert.That(provenance.Single(r => r.ParamName == "MetricDictionaryURI").ParamValue, Is.EqualTo("nrc-metrics.csv"));
    }

    /// <summary>nrc-enrich-run cannot reference another graph, so it carries copies of the two graphs'
    /// nodes, their answers renamed elementRows and rollupRows. This keeps the copies from drifting.</summary>
    [TestCase(ElementGraph, "elementRows")]
    [TestCase(RollupGraph, "rollupRows")]
    public void EnrichRun_CarriesAnExactCopyOf(string id, string answerAs)
    {
        var part = ModelGraphTests.Document(id);
        var enrich = ModelGraphTests.Document(EnrichGraph);
        string Renamed(string node) => node == "answer" ? answerAs : node;
        string RenamedPort(string port) => Renamed(port[..port.IndexOf('.')]) + port[port.IndexOf('.')..];

        Assert.Multiple(() =>
        {
            foreach (var node in part.Nodes)
            {
                var copy = enrich.FindNode(Renamed(node.Id));
                Assert.That(copy, Is.Not.Null, node.Id);
                Assert.That((copy?.Kind, copy?.Version), Is.EqualTo((node.Kind, node.Version)), node.Id);
                Assert.That(enrich.Values.GetValueOrDefault(Renamed(node.Id)),
                    Is.EquivalentTo(part.Values.GetValueOrDefault(node.Id) ?? new Dictionary<string, string>()), node.Id);
            }
            Assert.That(enrich.Edges.Select(e => (e.From, e.To)),
                Is.SupersetOf(part.Edges.Select(e => (RenamedPort(e.From), RenamedPort(e.To)))));
        });
    }

    /// <summary>One element row per metric value and run fact, built from the wide
    /// nrc_analytics_elements.csv the way generate_synthetic_analytics.py built psets_to_write.csv.</summary>
    private static IReadOnlyList<PsetRow> ExpectedElementRows()
    {
        var elements = Csv("nrc_analytics_elements.csv");
        var runId = RunFact("AnalysisRunId");
        var scenario = RunFact("ScenarioName");
        var grid = RunFact("GridEmissionFactor_kgCO2e_per_kWh");
        var rows = new List<PsetRow>();
        for (var row = 0; row < elements.Rows.Count; row++)
        {
            var id = Convert.ToInt64(elements.Cell("EntityId", row));
            void Set(string pset, params (string Name, object? Value)[] reals)
            {
                rows.AddRange(reals.Select(p => new PsetRow(id, pset, p.Name, "Real", Real(p.Value!))));
                rows.Add(new PsetRow(id, pset, "AnalysisRunId", "Identifier", runId));
                rows.Add(new PsetRow(id, pset, "ScenarioName", "Label", scenario));
            }

            if (elements.Cell("EmbodiedCarbon_A1A3_kgCO2e", row) is { } a1a3)
                Set("Pset_NRCEmbodiedCarbon",
                    ("EmbodiedCarbon_A1A3_kgCO2e", a1a3),
                    ("EmbodiedCarbon_A1A5_kgCO2e", elements.Cell("EmbodiedCarbon_A1A5_kgCO2e", row)));
            Set("Pset_NRCOperationalCarbon",
                ("OperationalCarbon_kgCO2e_per_year", elements.Cell("OperationalCarbon_kgCO2e_per_year", row)),
                ("GridEmissionFactor_kgCO2e_per_kWh", grid));
            Set("Pset_NRCEnergyPerformance",
                ("EnergyUseIntensity_kWh_per_m2_year", elements.Cell("EnergyUseIntensity_kWh_per_m2_year", row)));
        }

        return rows;
    }

    private static string RunFact(string field)
    {
        var run = Csv("nrc-run.csv");
        return (string)Enumerable.Range(0, run.Rows.Count)
            .Where(row => Equals(run.Cell("Field", row), field))
            .Select(row => run.Cell("Value", row))
            .Single()!;
    }

    private static decimal Decimal(object? value)
        => decimal.Parse(Convert.ToString(value, CultureInfo.InvariantCulture)!, NumberStyles.Float, CultureInfo.InvariantCulture);

    /// <summary>A Real value in one spelling, so 372 and 372.0 compare equal.</summary>
    private static string Real(object value)
        => Convert.ToDouble(value, CultureInfo.InvariantCulture).ToString("R", CultureInfo.InvariantCulture);

    /// <summary>One row of the table sink.writePsets consumes.</summary>
    internal readonly record struct PsetRow(long EntityId, string PsetName, string ParamName, string ValueType, string ParamValue)
    {
        public PsetRow Normalized()
            => ValueType == "Real" ? this with { ParamValue = Real(ParamValue) } : this;

        public static IReadOnlyList<PsetRow> All(IDataTable table)
            => Enumerable.Range(0, table.Rows.Count)
                .Select(row => new PsetRow(
                    Convert.ToInt64(table.Cell("entityId", row)),
                    (string)table.Cell("psetName", row)!,
                    (string)table.Cell("paramName", row)!,
                    (string)table.Cell("valueType", row)!,
                    Convert.ToString(table.Cell("paramValue", row), CultureInfo.InvariantCulture)!))
                .ToList();
    }
}
