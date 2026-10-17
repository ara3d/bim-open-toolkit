using System.Diagnostics;
using System.Text.RegularExpressions;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>samples/nrc/nrc-zones.csv, the Duplex zoning (one zone per dwelling per floor, the
/// unconditioned roof space left out), is what samples/nrc/make-zone-data.mjs makes from the
/// spaces of duplex-base.ifc, and it names each of the model's conditioned spaces once.</summary>
[TestFixture]
public sealed partial class ZoneTableTests
{
    private static readonly string ZonesCsv = Path.Combine(NrcPaths.SamplesDir, "nrc-zones.csv");

    [GeneratedRegex(@"^#\d+=IFCSPACE\('([^']*)',#\d+,'([^']*)'", RegexOptions.Multiline)]
    private static partial Regex SpaceLine();

    private static string[][] Rows()
        => File.ReadAllLines(ZonesCsv).Skip(1).Select(l => l.Split(',')).ToArray();

    [Test]
    public void ZoneTable_PutsTheTwentyConditionedSpacesInFourZones_EachOnce()
    {
        Assert.That(File.ReadLines(ZonesCsv).First(), Is.EqualTo("ZoneName,SpaceGlobalId,RoomNumber,RoomName"));
        var rows = Rows();
        Assert.That(rows, Has.Length.EqualTo(20));
        Assert.That(rows.Select(r => r[1]).Distinct().Count(), Is.EqualTo(20), "each space in one zone");
        Assert.That(rows.GroupBy(r => r[0]).ToDictionary(g => g.Key, g => g.Count()), Is.EquivalentTo(
            new Dictionary<string, int>
            {
                ["Unit A Level 1"] = 5, ["Unit A Level 2"] = 5, ["Unit B Level 1"] = 5, ["Unit B Level 2"] = 5,
            }));
        Assert.That(rows.Select(r => r[2]), Has.None.StartWith("R"), "R301 Roof is unconditioned and belongs to no zone");
    }

    [Test]
    public void ZoneTable_NamesOnlySpacesOfTheBaseModel_WithTheirRoomNumbers()
    {
        var spaces = SpaceLine().Matches(File.ReadAllText(NrcPaths.BaseIfc, System.Text.Encoding.Latin1))
            .ToDictionary(m => m.Groups[1].Value, m => m.Groups[2].Value);
        Assert.That(spaces, Has.Count.EqualTo(21));
        foreach (var row in Rows())
        {
            Assert.That(spaces.ContainsKey(row[1]), Is.True, $"{row[1]} is an IfcSpace of duplex-base.ifc");
            Assert.That(spaces[row[1]], Is.EqualTo(row[2]));
        }
    }

    [Test]
    public void ZoneTable_IsWhatTheScriptMakes()
    {
        var script = Path.Combine(NrcPaths.SamplesDir, "make-zone-data.mjs");
        var output = Path.Combine(Path.GetTempPath(), "bof-zones", Guid.NewGuid().ToString("N") + ".csv");
        Directory.CreateDirectory(Path.GetDirectoryName(output)!);
        try
        {
            var start = new ProcessStartInfo("node") { RedirectStandardOutput = true, RedirectStandardError = true };
            foreach (var arg in new[] { script, "--zones-out", output })
                start.ArgumentList.Add(arg);
            using var node = Process.Start(start) ?? throw new InvalidOperationException("node did not start; it is on PATH wherever deps.mjs ran");
            var stderr = node.StandardError.ReadToEndAsync();
            node.StandardOutput.ReadToEnd();
            node.WaitForExit();
            Assert.That(node.ExitCode, Is.EqualTo(0), stderr.Result);
            Assert.That(File.ReadAllText(ZonesCsv).ReplaceLineEndings("\n"), Is.EqualTo(File.ReadAllText(output).ReplaceLineEndings("\n")),
                "samples/nrc/nrc-zones.csv is stale; run node samples/nrc/make-zone-data.mjs");
        }
        finally
        {
            File.Delete(output);
        }
    }
}
