using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.IO;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using Ara3D.Utils;
using BimOpenFlow.Nodes.BimAnalysis;
using BimOpenFlow.Nodes.Support;
using BimOpenFlow.Relations.DuckDb;

namespace BimOpenFlow.Studio.Tests;

/// <summary>
/// The schemas the packs declare (TKT-207, TKT-208) against what the nodes produce: the studio's
/// whole registry is free of declaration mistakes, and every table output of the BIM packs and the
/// check nodes has the declared columns, in order, with the declared types, and no null in a column
/// declared not null. Static outputs are compared as declared; Inferred outputs are inferred from
/// the actual input tables and compared the same way.
/// </summary>
[TestFixture]
public sealed class DeclaredSchemaTests
{
    private static readonly NodeRegistry Registry = StudioComposition.BimPacks();

    private static readonly string[] CoveredPrefixes = ["bim.", "bos.", "bcf.", "check.", "ids."];

    /// <summary>Nodes not declared or not run yet, with the reason; the list only shrinks.</summary>
    private static readonly Dictionary<string, string> NotCovered = new()
    {
        ["check.rule"] = "its source file has another session's uncommitted edits",
        ["check.union"] = "its source file has another session's uncommitted edits",
    };

    private static readonly DuckDbCatalog Catalog = new(ConnectionRegistry.Of());

    private static readonly Lazy<IReadOnlyList<Run>> Runs = new(Scenarios.Build);

    [Test]
    public void StudioRegistry_DeclaresNoSchemaProblems()
        => Assert.That(Registry.SchemaProblems(), Is.Empty);

    [Test]
    public void EveryTableOutputOfTheCoveredPacks_IsDeclaredAndRunByAScenario()
    {
        var declared = Registry.Nodes
            .Where(n => CoveredPrefixes.Any(p => n.Spec.Kind.StartsWith(p, StringComparison.Ordinal)))
            .Where(n => !NotCovered.ContainsKey(n.Spec.Kind))
            .SelectMany(n => n.Spec.Outputs.Where(o => o.Type == PortType.Table).Select(o => (n.Spec, Output: o.Name)))
            .ToList();
        var undeclared = declared.Where(d => !d.Spec.Schemas.Any(s => s.Output == d.Output))
            .Select(d => $"{d.Spec.Kind}/{d.Output}: no schema declared");
        var unrun = declared.Where(d => d.Spec.Schemas.Any(s => s.Output == d.Output) && !Runs.Value.Any(r => r.Kind == d.Spec.Kind))
            .Select(d => $"{d.Spec.Kind}/{d.Output}: no scenario evaluates it");
        Assert.That(undeclared.Concat(unrun), Is.Empty);
    }

    public static IEnumerable<TestCaseData> Outputs
        => Runs.Value.SelectMany(run => run.Tables.Keys
            .Where(output => Registry.Find(run.Kind, 1)!.Spec.Schemas.Any(s => s.Output == output))
            .Select(output => new TestCaseData(run.Name, output).SetArgDisplayNames(run.Name, output)));

    [TestCaseSource(nameof(Outputs))]
    public void DeclaredColumns_MatchTheEvaluatedTable(string runName, string output)
    {
        var run = Runs.Value.Single(r => r.Name == runName);
        var node = Registry.Find(run.Kind, 1)!;
        var spec = node.Spec.Schemas.Single(s => s.Output == output);
        var table = run.Tables[output];
        var problems = spec switch
        {
            StaticSchemaSpec s => KindProblems(s).Concat(Compare(s.Schema, table)),
            InferredSchemaSpec => Compare(Infer(node, output, run), table),
            _ => [],
        };
        Assert.That(problems, Is.Empty, $"{runName}/{output} declared {spec.GetType().Name}");
    }

    [Test]
    public void Compare_ReportsAWrongNameTypeOrNull()
    {
        var table = new DataTableBuilder("t");
        table.AddColumn(new object?[] { 1L, null }, "A", typeof(long));
        table.AddColumn(new object?[] { "x", "y" }, "B", typeof(string));
        var built = table.Build();
        Assert.Multiple(() =>
        {
            Assert.That(Compare(new Schema([new Column("A", ColumnType.Integer), new Column("B", ColumnType.Text, false)]), built), Is.Empty);
            Assert.That(Compare(new Schema([new Column("A", ColumnType.Integer, false), new Column("B", ColumnType.Text)]), built),
                Has.One.Contains("declared not null"));
            Assert.That(Compare(new Schema([new Column("A", ColumnType.Number), new Column("B", ColumnType.Text)]), built),
                Has.One.Contains("declared Number"));
            Assert.That(Compare(new Schema([new Column("B", ColumnType.Text), new Column("A", ColumnType.Integer)]), built),
                Has.One.Contains("declared [B, A]"));
        });
    }

    private static Schema Infer(IFlowNode node, string output, Run run)
    {
        var inputs = node.Spec.Inputs
            .Select((port, i) => new SchemaInput(port.Type, i < run.Inputs.Count && run.Inputs[i] is not null,
                i < run.Inputs.Count && run.Inputs[i] is { } t ? SchemaResult.Of(Describe(t)) : null))
            .ToList();
        var result = ((ISchemaNode)node).Infer(output, inputs, run.Parameters, Catalog);
        Assert.That(result.Ok, Is.True, $"{run.Name}/{output}: {result}");
        return result.Schema!;
    }

    /// <summary>The schema the table carries: what an upstream node's declaration would give a consumer.</summary>
    private static Schema Describe(IDataTable table)
        => new([.. table.Columns.Select(c => new Column(c.Descriptor.Name, ColumnTypeOf(c.Descriptor.Type)!.Value))]);

    private static IEnumerable<string> KindProblems(StaticSchemaSpec spec)
        => (spec.Kinds ?? new Dictionary<string, string>()).Select(k =>
        {
            var kind = ColumnKinds.All.FirstOrDefault(x => x.Name == k.Value);
            var column = spec.Schema.Find(k.Key)!.Value;
            return kind is null
                ? $"column '{k.Key}' names kind '{k.Value}', which the registry lacks"
                : kind.Name != column.Name
                    ? $"column '{column.Name}' names kind '{kind.Name}', a different name"
                    : null;
        }).OfType<string>();

    internal static IEnumerable<string> Compare(Schema declared, IDataTable table)
    {
        var declaredNames = declared.Columns.Select(c => c.Name).ToList();
        var actualNames = table.Columns.Select(c => c.Descriptor.Name).ToList();
        if (!declaredNames.SequenceEqual(actualNames))
        {
            yield return $"columns: declared [{string.Join(", ", declaredNames)}], evaluated [{string.Join(", ", actualNames)}]";
            yield break;
        }
        for (var i = 0; i < declared.Columns.Count; i++)
        {
            var column = declared.Columns[i];
            var actual = table.Columns[i];
            if (ColumnTypeOf(actual.Descriptor.Type) != column.Type)
                yield return $"'{column.Name}': declared {column.Type}, evaluated {actual.Descriptor.Type.Name}";
            if (!column.Nullable && Enumerable.Range(0, actual.Count).Any(r => table[i, r] is null or DBNull))
                yield return $"'{column.Name}': declared not null, evaluated a null";
        }
    }

    private static ColumnType? ColumnTypeOf(Type clr)
    {
        var t = Nullable.GetUnderlyingType(clr) ?? clr;
        if (t == typeof(bool))
            return ColumnType.Boolean;
        if (t == typeof(sbyte) || t == typeof(byte) || t == typeof(short) || t == typeof(ushort)
            || t == typeof(int) || t == typeof(uint) || t == typeof(long))
            return ColumnType.Integer;
        if (t == typeof(float) || t == typeof(double) || t == typeof(decimal))
            return ColumnType.Number;
        if (t == typeof(string) || t == typeof(char))
            return ColumnType.Text;
        if (t == typeof(DateOnly))
            return ColumnType.Date;
        if (t == typeof(DateTime) || t == typeof(DateTimeOffset))
            return ColumnType.Timestamp;
        return null;
    }

    /// <summary>One evaluation of a node: its inputs, parameters and the tables it returned by output name.</summary>
    private sealed record Run(string Name, string Kind, IReadOnlyList<IDataTable?> Inputs, ParamValues Parameters,
        IReadOnlyDictionary<string, IDataTable> Tables);

    private sealed class Context(bool isRun) : IEvalContext
    {
        public bool IsRun => isRun;
        public CancellationToken Cancellation => CancellationToken.None;
        public void Warn(string message)
        {
        }
    }

    /// <summary>The sample model and the chain of nodes over it. Each scenario feeds the next from real output.</summary>
    private static class Scenarios
    {
        private const string ParamColumns = "Rvt:Room:Number,Rvt:Room:Volume,Rvt:Element:Bounds.Min,Rvt:Element:Level";

        public static IReadOnlyList<Run> Build()
        {
            var folder = Path.Combine(Path.GetTempPath(), "bimopenflow-declared-schemas", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(folder);
            var bos = Path.Combine(folder, "sample.bos");
            ParquetUtils.WriteToParquetZip(BimSampleModel.Build(), new FilePath(bos));
            var runs = new List<Run>();

            IReadOnlyDictionary<string, IDataTable> Add(string kind, IDataTable?[] inputs, bool isRun = false,
                string? name = null, (string Name, string Value)[]? ps = null)
            {
                var node = Registry.Find(kind, 1)!;
                var parameters = new ParamValues((ps ?? []).ToDictionary(p => p.Name, p => p.Value));
                var values = inputs.Select(t => t is null ? (FlowValue)MissingValue.Instance : new TableValue(t)).ToList();
                var outputs = node.Eval(new Context(isRun), values, parameters);
                var tables = node.Spec.Outputs.Select((o, i) => (o.Name, Value: outputs[i]))
                    .Where(o => o.Value is TableValue)
                    .ToDictionary(o => o.Name, o => ((TableValue)o.Value).Table);
                runs.Add(new Run(name ?? kind, kind, inputs, parameters, tables));
                return tables;
            }

            var path = ("path", bos);
            var elements = Add("bim.elements", [], ps: [path])["table"];
            var rooms = Add("bim.rooms", [], ps: [path])["table"];
            Add("bim.levels", [], ps: [path]);
            var bounds = Add("bim.bounds", [], ps: [path])["table"];
            var nav = Add("bim.navGraph", [], ps: [path])["table"];
            Add("bim.orientation", [], ps: [path]);
            Add("bim.paramTable", [], ps: [path, ("parameters", ParamColumns)]);
            var loaded = Add("bos.load", [], ps: [path]);
            var parameters = loaded["parameters"];
            Add("bim.paramCoverage", [parameters]);
            Add("bim.paramCoverage", [parameters], name: "bim.paramCoverage (groupBy)", ps: [("groupBy", BimColumns.ValueType)]);
            Add("bim.hops", [nav], ps: [("start", FirstRoom(nav))]);
            Add("bim.discipline", [elements]);
            Add("bim.classifyRooms", [rooms]);
            Add("bim.classifyRooms", [rooms], name: "bim.classifyRooms (as)", ps: [("as", "Kind")]);
            Add("bim.containment", [bounds, rooms]);
            Add("bim.nearest", [rooms, rooms]);
            Add("bim.buildSequence", [elements]);
            Add("bos.query", [parameters], ps: [("sql", "SELECT EntityIndex, Name, CAST(Value AS DOUBLE) AS Number FROM t WHERE ValueType = 'Number'")]);

            var issues = Issues();
            Add("bcf.topics", [issues]);
            var bcf = Path.Combine(folder, "issues.bcf");
            Add("bcf.write", [issues], isRun: true, ps: [("path", bcf)]);
            Add("bcf.read", [], ps: [("path", bcf)]);

            Add("bim.selection", [], ps: [("ids", "D1,D2,,D1")]);
            Add("bim.selection", [], name: "bim.selection (empty)");
            var camera = Add("view3d.camera", [], ps: [("posX", "1"), ("targetX", "5"), ("targetZ", "1")])["camera"];
            Add("bcf.issue", [null], name: "bcf.issue (no camera)", ps: [("title", "Swap handle"), ("ids", "D1,D2")]);
            Add("bcf.issue", [camera], ps: [("title", "Swap handle"), ("comment", "Wrong side"), ("ids", "D1,D2")]);

            var labelInstances = LabelInstances();
            var labelValues = new DataTableBuilder("values");
            labelValues.AddColumn(new long[] { 1, 2 }, "entityId");
            labelValues.AddColumn(new[] { 900.0, 800.0 }, "width");
            Add("view3d.label", [labelInstances, labelValues.Build()], ps: [("format", "{width:0} mm")]);
            Add("view3d.label", [labelInstances, null], name: "view3d.label (no values, grouped)",
                ps: [("format", "{storey}"), ("groupColumn", "storey")]);

            var idsPath = Path.Combine(folder, "doors.ids");
            File.WriteAllText(idsPath, DoorsIds);
            Add("ids.specifications", [], ps: [("ids", idsPath)]);
            Add("ids.check", [DoorEntities(), DoorParameters()], ps: [("ids", idsPath)]);

            var required = Add("check.required", [elements], ps: [("checkId", "R1"), ("title", "Rooms"), ("citation", "c"), ("columns", "Name,Room")])["out"];
            Add("check.rollup", [required]);
            return runs;
        }

        private static IDataTable LabelInstances()
        {
            var builder = new DataTableBuilder("instances");
            builder.AddColumn(new long[] { 1, 2 }, "entityId");
            builder.AddColumn(new[] { "S1", "S1" }, "storey");
            foreach (var (name, cells) in new[]
                { ("minX", new[] { 0.0, 4 }), ("minY", new[] { 0.0, 0 }), ("minZ", new[] { 0.0, 0 }),
                  ("maxX", new[] { 2.0, 6 }), ("maxY", new[] { 2.0, 2 }), ("maxZ", new[] { 3.0, 4 }) })
                builder.AddColumn(cells, name);
            return builder.Build();
        }

        private static string FirstRoom(IDataTable nav)
            => Enumerable.Range(0, nav.RowCount())
                .Select(r => nav[nav.ColumnIndex(BimColumns.FromRoom), r] as string)
                .First(room => room is not null && room != BimColumns.Outside)!;

        private const string DoorsIds = """
            <?xml version="1.0" encoding="UTF-8"?>
            <ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">
              <info><title>doors</title></info>
              <specifications>
                <specification name="DC-W1" ifcVersion="IFC4" description="Door leaf width at least 850 mm">
                  <applicability minOccurs="1" maxOccurs="unbounded"><entity><name><simpleValue>IFCDOOR</simpleValue></name></entity></applicability>
                  <requirements><attribute><name><simpleValue>OverallWidth</simpleValue></name>
                    <value><xs:restriction base="xs:double"><xs:minInclusive value="0.85"/></xs:restriction></value></attribute></requirements>
                </specification>
              </specifications>
            </ids>
            """;

        /// <summary>Two doors in the shape of bos.load's entities output.</summary>
        private static IDataTable DoorEntities()
        {
            var builder = new DataTableBuilder("entities");
            builder.AddColumn(new object?[] { 0L, 1L }, IssueColumns.EntityIndex, typeof(long));
            builder.AddColumn(new object?[] { "D1", "D2" }, IssueColumns.GlobalId, typeof(string));
            builder.AddColumn(new object?[] { "Door 1", "Door 2" }, "Name", typeof(string));
            builder.AddColumn(new object?[] { "IFCDOOR", "IFCDOOR" }, "Category", typeof(string));
            return builder.Build();
        }

        /// <summary>The doors' widths in the shape of bos.load's parameters output.</summary>
        private static IDataTable DoorParameters()
        {
            var builder = new DataTableBuilder("parameters");
            builder.AddColumn(new object?[] { 0L, 1L }, IssueColumns.EntityIndex, typeof(long));
            builder.AddColumn(new object?[] { "Ifc:OverallWidth", "Ifc:OverallWidth" }, "Name", typeof(string));
            builder.AddColumn(new object?[] { "IFCDOOR", "IFCDOOR" }, "ParameterGroup", typeof(string));
            builder.AddColumn(new object?[] { null, null }, "Units", typeof(string));
            builder.AddColumn(new object?[] { "Number", "Number" }, "ValueType", typeof(string));
            builder.AddColumn(new object?[] { "0.9", "0.8" }, "Value", typeof(string));
            return builder.Build();
        }

        private static IDataTable Issues()
        {
            var builder = new DataTableBuilder("issues");
            builder.AddColumn(new object?[] { "2O2Fr$t4X7Zf8NOew3FLOH", "0YvctVUKr0kugbFTf53O9L" }, IssueColumns.GlobalId, typeof(string));
            builder.AddColumn(new object?[] { "Missing fire rating", "Missing fire rating" }, IssueColumns.Title, typeof(string));
            builder.AddColumn(new object?[] { "Add the rating", "Add the rating" }, IssueColumns.Description, typeof(string));
            return builder.Build();
        }
    }
}
