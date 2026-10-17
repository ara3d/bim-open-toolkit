using System.Globalization;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using BimOpenFlow.Relations;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>TKT-49: the zone level. nrc-rollup computes the NRC_ZoneSummary rows from the space
/// values of nrc_analytics_spaces.csv and the zoning of nrc-zones.csv, never from a supplied total;
/// nrc-enrich-run writes them on four IfcZone groups; ZoneOfSpace reads the zoning back from the
/// enriched file. The references are computed here from the two CSVs alone.</summary>
[TestFixture]
public sealed class ZoneRollupTests
{
    private static readonly RelationRuntime Runtime = Fixture.Runtime;

    private static IDataTable Csv(string file)
        => Runtime.Materialize(Plans.Csv("nrc", file));

    /// <summary>One zone's values worked out from the CSVs: space count, area, energy, carbon.</summary>
    private sealed record ZoneReference(string Zone, int Spaces, double Area, double Energy, double Carbon)
    {
        public double Intensity => Energy / Area;
    }

    private static IReadOnlyList<ZoneReference> References()
    {
        var zones = Csv("nrc-zones.csv");
        var values = Csv("nrc_analytics_spaces.csv");
        var zoneOfSpace = Enumerable.Range(0, zones.Rows.Count)
            .ToDictionary(r => (string)zones.Cell("SpaceGlobalId", r)!, r => (string)zones.Cell("ZoneName", r)!);
        double Sum(string zone, string metric) => Enumerable.Range(0, values.Rows.Count)
            .Where(r => Equals(values.Cell("MetricId", r), metric) && zoneOfSpace[(string)values.Cell("GlobalId", r)!] == zone)
            .Sum(r => Convert.ToDouble(values.Cell("Value", r), CultureInfo.InvariantCulture));
        return zoneOfSpace.Values.Distinct().Order(StringComparer.Ordinal)
            .Select(z => new ZoneReference(z, zoneOfSpace.Values.Count(v => v == z),
                Sum(z, "NRC.AREA.FLOOR"), Sum(z, "NRC.ENERGY.ANNUAL"), Sum(z, "NRC.OC.ANNUAL")))
            .ToList();
    }

    private static Dictionary<string, Dictionary<string, string>> ZoneRows()
    {
        var snapshot = ModelGraphTests.EvaluateGreen(ModelGraphTests.Document("nrc-rollup"), "nrc-rollup", Fixture.Registry(Runtime));
        var table = ModelGraphTests.AnswerRows(snapshot, Runtime, "zoneAnswer");
        var byZone = new Dictionary<string, Dictionary<string, string>>();
        for (var r = 0; r < table.Rows.Count; r++)
        {
            Assert.That(table.Cell("psetName", r), Is.EqualTo("NRC_ZoneSummary"));
            var zone = (string)table.Cell("zoneName", r)!;
            if (!byZone.TryGetValue(zone, out var values))
                byZone.Add(zone, values = new Dictionary<string, string>());
            values.Add((string)table.Cell("paramName", r)!, Convert.ToString(table.Cell("paramValue", r), CultureInfo.InvariantCulture)!);
        }
        return byZone;
    }

    private static double Value(Dictionary<string, string> values, string name)
        => double.Parse(values[name], CultureInfo.InvariantCulture);

    [Test]
    public void ZoneSummaries_AreComputedFromTheSpaceValues_UnderTheirOwnNames()
    {
        var rows = ZoneRows();
        var references = References();
        Assert.That(rows.Keys, Is.EquivalentTo(new[] { "Unit A Level 1", "Unit A Level 2", "Unit B Level 1", "Unit B Level 2" }));

        Assert.Multiple(() =>
        {
            foreach (var reference in references)
            {
                var values = rows[reference.Zone];
                Assert.That(values.Keys, Is.EquivalentTo(new[]
                {
                    "SpaceCount", "TotalFloorArea_m2", "TotalOperationalEnergy_kWh_per_year",
                    "TotalOperationalCarbon_kgCO2e_per_year", "ZoneEnergyUseIntensity_kWh_per_m2_year",
                    "AnalysisRunId", "ScenarioName",
                }), reference.Zone);
                Assert.That(Value(values, "SpaceCount"), Is.EqualTo(reference.Spaces), reference.Zone);
                Assert.That(Value(values, "TotalFloorArea_m2"), Is.EqualTo(reference.Area).Within(0.05), reference.Zone);
                Assert.That(Value(values, "TotalOperationalEnergy_kWh_per_year"), Is.EqualTo(reference.Energy).Within(0.05), reference.Zone);
                Assert.That(Value(values, "TotalOperationalCarbon_kgCO2e_per_year"), Is.EqualTo(reference.Carbon).Within(0.05), reference.Zone);
                // Energy over the summed floor area, not a mean of the spaces' intensities.
                Assert.That(Value(values, "ZoneEnergyUseIntensity_kWh_per_m2_year"), Is.EqualTo(reference.Intensity).Within(0.005), reference.Zone);
            }
        });
    }

    /// <summary>Q9 answered from the CSVs by its graph, by the plain computation above, and by the
    /// values stored on the zones of the enriched file: one answer.</summary>
    [Test]
    public void Q9_GraphAgreesWithTheCsvComputationAndTheStoredZoneValues()
    {
        var answer = ModelGraphTests.AnswerRows(
            ModelGraphTests.EvaluateGreen(ModelGraphTests.Document("nrc-q9-zone-eui"), "nrc-q9-zone-eui", Fixture.Registry(Runtime)),
            Runtime);
        var fromCsv = References().OrderByDescending(r => Math.Round(r.Intensity, 2)).ToList();
        var stored = Runtime.Materialize(Plans.Sql(
            "SELECT e.Name, CAST(p.Value AS DOUBLE) AS Eui FROM t1 p JOIN t2 e ON e.EntityIndex = p.EntityIndex "
            + "WHERE e.Category = 'IFCZONE' AND p.Name = 'ZoneEnergyUseIntensity_kWh_per_m2_year'",
            Plans.Table("duplex-enriched", "ParameterText"), Plans.Table("duplex-enriched", "EntityText")));
        var storedByZone = Enumerable.Range(0, stored.Rows.Count)
            .ToDictionary(r => (string)stored.Cell("Name", r)!, r => Convert.ToDouble(stored.Cell("Eui", r)));

        Assert.That(answer.Rows, Has.Count.EqualTo(fromCsv.Count));
        Assert.Multiple(() =>
        {
            Assert.That(answer.Cell("Zone", 0), Is.EqualTo(fromCsv[0].Zone), "the highest zone");
            for (var r = 0; r < fromCsv.Count; r++)
            {
                Assert.That(answer.Cell("Zone", r), Is.EqualTo(fromCsv[r].Zone));
                var eui = Convert.ToDouble(answer.Cell("ZoneEnergyUseIntensity_kWh_per_m2_year", r), CultureInfo.InvariantCulture);
                Assert.That(eui, Is.EqualTo(fromCsv[r].Intensity).Within(0.005), fromCsv[r].Zone);
                Assert.That(storedByZone[fromCsv[r].Zone], Is.EqualTo(eui).Within(0.005), fromCsv[r].Zone);
            }
        });
    }

    /// <summary>The storage defect of gap report 2.10 as a rule on the zone rows: a zone value never
    /// reuses a property name an element set carries.</summary>
    [Test]
    public void ZoneSummaries_NeverUseAnElementPropertyName()
    {
        var metrics = Csv("nrc-metrics.csv");
        var elementNames = Enumerable.Range(0, metrics.Rows.Count)
            .Where(row => Equals(metrics.Cell("Level", row), "element"))
            .Select(row => (string)metrics.Cell("PropertyName", row)!)
            .ToHashSet();
        var rows = ZoneRows();
        var names = rows.Values.SelectMany(v => v.Keys).Distinct().ToList();

        Assert.That(names, Has.None.AnyOf(elementNames.ToArray()));
        Assert.That(rows.Values.Sum(v => v.Count), Is.EqualTo(28), "7 values on each of 4 zones");
    }

    /// <summary>The CSV keeps a copy of each space's floor area so a zone's intensity can be computed
    /// from the CSVs alone; the copy is the model's own GSA BIM Area, rounded to 0.01 m2.</summary>
    [Test]
    public void SpaceFloorAreas_AreTheModelsGsaBimArea()
    {
        var model = Runtime.Materialize(Plans.Sql(
            "SELECT e.GlobalId, CAST(p.Value AS DOUBLE) AS Area FROM t1 p JOIN t2 e ON e.EntityIndex = p.EntityIndex "
            + "WHERE p.Name = 'GSA BIM Area' AND e.Category = 'IFCSPACE'",
            Plans.Table("duplex-base", "ParameterText"), Plans.Table("duplex-base", "EntityText")));
        var modelArea = Enumerable.Range(0, model.Rows.Count)
            .ToDictionary(r => (string)model.Cell("GlobalId", r)!, r => Convert.ToDouble(model.Cell("Area", r)));
        var values = Csv("nrc_analytics_spaces.csv");
        var areas = Enumerable.Range(0, values.Rows.Count).Where(r => Equals(values.Cell("MetricId", r), "NRC.AREA.FLOOR")).ToList();

        Assert.That(areas, Has.Count.EqualTo(20));
        foreach (var row in areas)
            Assert.That(Convert.ToDouble(values.Cell("Value", row), CultureInfo.InvariantCulture),
                Is.EqualTo(modelArea[(string)values.Cell("GlobalId", row)!]).Within(0.005), (string)values.Cell("GlobalId", row)!);
    }

    /// <summary>Read back from the enriched file: ZoneOfSpace returns the 20 conditioned spaces in the zones
    /// of nrc-zones.csv, and each of the four IfcZone entities carries one NRC_ZoneSummary set.</summary>
    [Test]
    public void EnrichedFile_CarriesTheZoningAndOneSummaryOnEachZone()
    {
        var zones = Csv("nrc-zones.csv");
        var expected = Enumerable.Range(0, zones.Rows.Count)
            .Select(r => ((string)zones.Cell("SpaceGlobalId", r)!, (string)zones.Cell("ZoneName", r)!)).Order().ToList();
        var actual = Runtime.Materialize(Plans.Sql(
            "SELECT SpaceGlobalId, ZoneName FROM t1 ORDER BY 1, 2", Plans.Table("duplex-enriched", "ZoneOfSpace")));
        Assert.That(Enumerable.Range(0, actual.Rows.Count)
            .Select(r => ((string)actual.Cell("SpaceGlobalId", r)!, (string)actual.Cell("ZoneName", r)!)).Order(),
            Is.EqualTo(expected));

        var sets = Runtime.Materialize(Plans.Sql(
            "SELECT e.Name, count(DISTINCT p.Name) AS Properties FROM t1 p JOIN t2 e ON e.EntityIndex = p.EntityIndex "
            + "WHERE e.Category = 'IFCZONE' AND p.ParameterGroup = 'NRC_ZoneSummary' GROUP BY e.Name ORDER BY e.Name",
            Plans.Table("duplex-enriched", "ParameterText"), Plans.Table("duplex-enriched", "EntityText")));
        Assert.That(Enumerable.Range(0, sets.Rows.Count).Select(r => ((string)sets.Cell("Name", r)!, sets.Cell("Properties", r))),
            Is.EqualTo(new (string, object?)[]
            {
                ("Unit A Level 1", 7L), ("Unit A Level 2", 7L), ("Unit B Level 1", 7L), ("Unit B Level 2", 7L),
            }));
    }
}
