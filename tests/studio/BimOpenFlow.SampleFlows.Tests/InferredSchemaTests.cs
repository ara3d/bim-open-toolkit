using System.Collections.Concurrent;
using Ara3D.DataTable;
using ColumnType = Ara3D.DataFlowEngine.Abstractions.ColumnType;
using BimOpenFlow.Contracts;
using BimOpenFlow.Host;
using BimOpenFlow.Host.Api;
using BimOpenFlow.Relations;
using BimOpenToolkit.TestSupport;
using Column = Ara3D.DataFlowEngine.Abstractions.Column;
using PortType = Ara3D.DataFlowEngine.Abstractions.PortType;

namespace BimOpenFlow.SampleFlows.Tests;

/// <summary>
/// Ties the static schema pass (GraphSchemas, TKT-209) to evaluation over every sample graph (TKT-208
/// criterion 5): each Table output the pass calls Ok must have the columns the run recorded, in the same
/// order with the same types. An output the pass cannot know is listed with its reason in the test output,
/// not failed, and a ratchet file holds the number of such Table outputs, which may only go down.
/// A mismatch is a defect in a node's rule or declaration, or in the run.
/// </summary>
[TestFixture]
public sealed class InferredSchemaTests
{
    private const string RatchetFile = "inferred-schema-unknown.ratchet";

    /// <summary>What comparing one graph found.</summary>
    private sealed record Findings(
        int Matched, IReadOnlyList<string> Mismatches, IReadOnlyList<(string Port, string Reason)> Unknown,
        int UnknownRelations, int FailedWithRun, int Nodes, TimeSpan Elapsed);

    private static readonly ConcurrentDictionary<(string, string), Findings> Cache = new();

    public static IEnumerable<TestCaseData> Cases => SampleFlowsTests.Cases;

    [TestCaseSource(nameof(Cases))]
    public void InferredColumnsEqualRecordedColumns(string profile, string id)
        => Assert.That(Compare(profile, id).Mismatches, Is.Empty, $"{profile}/{id}: inferred columns differ from the run's");

    [Test]
    public void UnknownTableOutputsAreListedAndRatcheted()
    {
        var all = SampleFlowsFixture.Cases.Select(c => (Case: c, Findings: Compare(c.Profile, c.Id))).ToList();
        var unknown = all.SelectMany(a => a.Findings.Unknown.Select(u => (a.Case, u.Port, u.Reason))).ToList();
        var byReason = unknown.GroupBy(u => Category(u.Reason)).OrderByDescending(g => g.Count()).ToList();

        TestContext.Out.WriteLine($"graphs {all.Count}; Table outputs matched {all.Sum(a => a.Findings.Matched)}; "
            + $"unknown {unknown.Count}; Relation outputs unknown {all.Sum(a => a.Findings.UnknownRelations)}; "
            + $"failed in both inference and run {all.Sum(a => a.Findings.FailedWithRun)}");
        var slowest = all.MaxBy(a => a.Findings.Elapsed)!;
        var largest = all.MaxBy(a => a.Findings.Nodes)!;
        TestContext.Out.WriteLine($"pass time (first call, cold catalog, graphs evaluated in parallel): slowest {slowest.Case.Profile}/{slowest.Case.Id} "
            + $"{slowest.Findings.Elapsed.TotalMilliseconds:F0} ms ({slowest.Findings.Nodes} nodes); largest {largest.Case.Profile}/{largest.Case.Id} "
            + $"{largest.Findings.Elapsed.TotalMilliseconds:F0} ms ({largest.Findings.Nodes} nodes)");
        foreach (var group in byReason)
            TestContext.Out.WriteLine($"  {group.Count(),5}  {group.Key}");
        foreach (var u in unknown)
            TestContext.Out.WriteLine($"  {u.Case.Profile}/{u.Case.Id} {u.Port}: {u.Reason}");

        var ratchet = int.Parse(File.ReadAllText(RatchetPath()).Trim());
        Assert.That(unknown.Count, Is.LessThanOrEqualTo(ratchet),
            $"{unknown.Count} Table outputs have unknown schemas; the ratchet in {RatchetFile} allows {ratchet}. "
            + "Declare the schema, or fix the rule, rather than raising it.");
        if (unknown.Count < ratchet)
            TestContext.Out.WriteLine($"RATCHET: lower {RatchetFile} from {ratchet} to {unknown.Count}.");
    }

    private static Findings Compare(string profile, string id)
        => Cache.GetOrAdd((profile, id), _ => Run(profile, id));

    private static Findings Run(string profile, string id)
    {
        var data = SampleFlowsFixture.Profile(profile);
        var snapshot = SampleFlowsFixture.Snapshot(profile, id);
        var catalog = HostComposition.SchemaCatalog(data.Runtime);
        var clock = System.Diagnostics.Stopwatch.StartNew();
        var ports = GraphSchemas.Infer(snapshot.Document, data.Registry, catalog, snapshot.GraphInputs);
        var elapsed = clock.Elapsed;
        var matched = 0;
        var failedWithRun = 0;
        var relations = 0;
        var mismatches = new List<string>();
        var unknown = new List<(string, string)>();
        foreach (var port in ports)
        {
            var spec = data.Registry.Find(snapshot.Document.FindNode(port.Node)!.Kind, snapshot.Document.FindNode(port.Node)!.Version)!.Spec;
            var index = spec.Outputs.ToList().FindIndex(o => o.Name == port.Output);
            var isTable = spec.Outputs[index].Type == PortType.Table;
            var result = snapshot.Results[port.Node];
            var ran = result.Status == Ara3D.DataFlowEngine.NodeStatus.Ok;
            var name = $"{port.Node}.{port.Output}";
            if (port.Status is SchemaStatus.Unknown or SchemaStatus.Dynamic)
            {
                if (isTable) unknown.Add((name, port.Reason!));
                else relations++;
            }
            else if (port.Status == SchemaStatus.Error)
            {
                if (ran) mismatches.Add($"{name}: inference failed ({string.Join("; ", port.Errors!)}) but the node ran");
                else failedWithRun++;
            }
            else if (ran && isTable && result.Outputs[index] is TableValue table)
            {
                var differences = Differences(port.Schema!, table.Table);
                if (differences is null) matched++;
                else mismatches.Add($"{name} ({snapshot.Document.FindNode(port.Node)!.Kind}): {differences}");
            }
        }
        return new(matched, mismatches, unknown, relations, failedWithRun, snapshot.Document.Nodes.Count, elapsed);
    }

    /// <summary>Names, order and types must be equal, except that an inferred type of Unknown is an honest
    /// absence (sqlite.query cannot type a column, SQLite types each value) and matches any recorded type.
    /// A run does not record nullability, so the check runs one way: a column the schema calls non-nullable
    /// must hold no null cell.</summary>
    private static string? Differences(Ara3D.DataFlowEngine.Abstractions.Schema inferred, IDataTable recorded)
    {
        var recordedColumns = TableSchemas.Of(recorded).Columns;
        var sameShape = recordedColumns.Count == inferred.Columns.Count && recordedColumns.Zip(inferred.Columns)
            .All(p => p.First.Name == p.Second.Name && (p.First.Type == p.Second.Type || p.Second.Type == ColumnType.Unknown));
        if (!sameShape)
            return $"inferred [{Describe(inferred.Columns)}] but the run recorded [{Describe(recordedColumns)}]";
        for (var i = 0; i < inferred.Columns.Count; i++)
            if (!inferred.Columns[i].Nullable && Enumerable.Range(0, recorded.Rows.Count).Any(row => recorded[i, row] is null or DBNull))
                return $"column '{inferred.Columns[i].Name}' is declared non-nullable but the run holds a null";
        return null;
    }

    private static string Describe(IReadOnlyList<Column> columns)
        => string.Join(", ", columns.Select(c => $"{c.Name}:{c.Type}"));

    private static string Category(string reason)
        => reason.Contains("declares no schema") ? "a node declares no schema"
            : reason.Contains("is dynamic") ? "a dynamic node upstream"
            : reason.Contains("whose value is not known") ? "a wired parameter whose value is not known before a run"
            : reason.Contains("is not connected") ? "a required input is not connected"
            : reason.Contains("failed") ? "an upstream node failed"
            : "other";

    private static string RatchetPath()
        => Path.Combine(RepoPaths.Root, "tests", "studio", "BimOpenFlow.SampleFlows.Tests", RatchetFile);
}
