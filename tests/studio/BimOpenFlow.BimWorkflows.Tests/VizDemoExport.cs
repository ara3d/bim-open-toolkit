using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using Ara3D.NodeGraph;
using BimOpenFlow.Host;
using BimOpenFlow.Studio;
using BimOpenToolkit.TestSupport;

namespace BimOpenFlow.BimWorkflows.Tests;

/// <summary>
/// Mirrors every visualization demo graph onto bim-open-plot's demo page. For each
/// samples/viz-analyses/viz-&lt;name&gt;.json that has a spec and evaluates all-green, writes
/// into deps/bim-open-plot/packages/demos/demos/flow-&lt;name&gt;/data/:
/// figure.json, the rows of the table its Vega-Lite spec is drawn over (the first table
/// holding every field the spec reads, preferring the input of a chart, view.table, or
/// view.colormap node); graph.json,
/// a copy of the graph document; and spec.vl.json, a copy of its spec. Explicit because it writes into another repository.
/// </summary>
[TestFixture]
[Explicit("Writes into deps/bim-open-plot; run on purpose to re-export the flow-* demos")]
public sealed class VizDemoExport
{
    private static readonly string[] FigureKinds = ["chart.", "view.table", "view.colormap"];

    private static string DemosDir
        => Path.Combine(RepoPaths.Root, "deps", "bim-open-plot", "packages", "demos", "demos");

    public static IEnumerable<TestCaseData> GraphsWithSpecs
        => VizSampleAnalysesTests.SampleFiles.Where(t => File.Exists(SpecPath((string)t.Arguments[0]!)));

    [OneTimeSetUp]
    public void PrepareNrcSamples()
        => VizSampleAnalysesTests.PrepareSamples();

    private static string SpecPath(string graphFile)
        => Path.Combine(VizSampleAnalysesTests.AnalysesDir, "specs", Path.GetFileNameWithoutExtension(graphFile) + ".vl.json");

    [TestCaseSource(nameof(GraphsWithSpecs))]
    public void Export(string graphFile)
    {
        var id = Path.GetFileNameWithoutExtension(graphFile);
        var doc = SampleSeeding.RewritePaths(GraphDocumentIO.Load(graphFile), NrcSamples.Dir(RepoPaths.Root));
        var session = new FlowTestSession(StudioComposition.BimPacks());
        var snapshot = session.Evaluate(doc);
        var failed = snapshot.Results.Where(r => r.Value.Status != NodeStatus.Ok).Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}").ToList();
        Assert.That(failed, Is.Empty, $"{id} does not evaluate; nothing exported");

        var fields = SpecFields(File.ReadAllText(SpecPath(graphFile)));
        var figure = CandidateTables(doc, session)
            .Select(t => (t.Endpoint, t.Table, Missing: fields.Except(Columns(t.Table)).ToList()))
            .OrderBy(t => t.Missing.Count) // stable: a figure input wins a tie
            .First();
        Assert.That(figure.Missing, Is.Empty, $"{id}: no figure table holds every spec field; {figure.Endpoint} lacks {string.Join(", ", figure.Missing)}");

        var dataDir = Path.Combine(DemosDir, "flow-" + Regex.Replace(id, "^viz-", ""), "data");
        Directory.CreateDirectory(dataDir);
        File.WriteAllText(Path.Combine(dataDir, "figure.json"), RowsJson(figure.Table));
        File.Copy(graphFile, Path.Combine(dataDir, "graph.json"), overwrite: true);
        File.Copy(SpecPath(graphFile), Path.Combine(dataDir, "spec.vl.json"), overwrite: true);
        TestContext.Out.WriteLine($"{id}: {figure.Endpoint} ({figure.Table.Rows.Count} rows) -> {dataDir}");
    }

    /// <summary>
    /// Every table wired anywhere in the graph, by its source endpoint: first the ones that feed a
    /// chart, view.table, or view.colormap node, then the rest (a spec may draw a table that a
    /// node such as table.pivot reshapes before the view shows it).
    /// </summary>
    private static IEnumerable<(string Endpoint, IDataTable Table)> CandidateTables(GraphDocument doc, FlowTestSession session)
        => doc.Edges
            .OrderBy(e => IsFigure(doc.FindNode(e.ToRef.NodeId)) ? 0 : 1)
            .Select(e => e.From)
            .Distinct()
            .Select(from => (from, Value: session.Output(from)))
            .Where(p => p.Value is TableValue)
            .Select(p => (p.from, ((TableValue)p.Value).Table));

    private static bool IsFigure(GraphNode? node)
        => node is not null && FigureKinds.Any(k => node.Kind.StartsWith(k, StringComparison.Ordinal));

    /// <summary>The field names a spec reads from its data: every "field", less the ones its transforms compute ("as").</summary>
    private static HashSet<string> SpecFields(string specJson)
    {
        var fields = new HashSet<string>(StringComparer.Ordinal);
        var computed = new HashSet<string>(StringComparer.Ordinal);
        void Walk(JsonNode? node)
        {
            switch (node)
            {
                case JsonObject o:
                    // A layer or view with its own inline data draws no rows of ours.
                    if (o["data"] is JsonObject) return;
                    foreach (var (key, value) in o)
                    {
                        var target = key switch { "field" => fields, "as" => computed, _ => null };
                        if (target is null)
                            Walk(value);
                        else
                            target.UnionWith(Strings(value));
                    }
                    break;
                case JsonArray a:
                    foreach (var x in a) Walk(x);
                    break;
            }
        }
        Walk(JsonNode.Parse(specJson));
        fields.ExceptWith(computed);
        return fields;
    }

    /// <summary>A string, or the strings of an array ("as" may name several computed fields).</summary>
    private static IEnumerable<string> Strings(JsonNode? node) => node switch
    {
        JsonValue v when v.TryGetValue(out string? s) => [s],
        JsonArray a => a.SelectMany(Strings),
        _ => [],
    };

    private static IEnumerable<string> Columns(IDataTable t)
        => t.Columns.Select(c => c.Descriptor.Name);

    /// <summary>The table as a JSON array of row objects; a non-finite number is written as null.</summary>
    private static string RowsJson(IDataTable t)
    {
        var names = Columns(t).ToList();
        var rows = new JsonArray();
        for (var i = 0; i < t.Rows.Count; i++)
        {
            var row = new JsonObject();
            for (var c = 0; c < names.Count; c++)
                row[names[c]] = Cell(t[c, i]);
            rows.Add(row);
        }
        return rows.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n";
    }

    private static JsonNode? Cell(object? v) => v switch
    {
        null => null,
        double d => double.IsFinite(d) ? JsonValue.Create(d) : null,
        float f => float.IsFinite(f) ? JsonValue.Create(f) : null,
        bool b => JsonValue.Create(b),
        string s => JsonValue.Create(s),
        int or long or short or byte or uint or ulong or decimal => JsonValue.Create(Convert.ToDecimal(v)),
        DateTime dt => JsonValue.Create(dt.ToString("o")),
        _ => JsonValue.Create(v.ToString()),
    };
}
