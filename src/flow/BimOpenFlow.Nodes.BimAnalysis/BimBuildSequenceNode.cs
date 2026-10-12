using System.Globalization;
using System.Text.Json;
using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>A synthetic, deterministic construction sequence (4D) over an element table.
/// Storeys run bottom-up and trades follow one another floor by floor: a task starts when
/// the previous trade has left its storey and its own trade has left the storey below, so
/// with equal durations trade t works storey s from day (s + t) * daysPerTask. A task with
/// no elements takes no time and is not emitted.</summary>
public sealed class BimBuildSequenceNode : ISchemaNode
{
    public const string Kind = "bim.buildSequence";
    public const string DefaultStart = "2027-01-04";
    public const string DefaultDaysPerTask = "10";
    public const string DefaultTrades = "Structure,Envelope,MEP,Finishes";

    public const string Task = "Task";
    public const string Storey = "Storey";
    public const string Trade = "Trade";
    public const string Start = "Start";
    public const string End = "End";
    public const string DurationDays = "DurationDays";
    public const string Finish = "Finish";
    public const string FinishWeek = "FinishWeek";
    public const string Synthetic = "Synthetic";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("table", PortType.Table)],
        Outputs: [new PortSpec("tasks", PortType.Table), new PortSpec("elements", PortType.Table)],
        Params:
        [
            new ParamSpec("levelColumn", ParamKind.Text, BimColumns.Level, Suggest: SuggestSource.ColumnsOf("table")),
            new ParamSpec("elevationColumn", ParamKind.Text, BimColumns.Elevation, Suggest: SuggestSource.ColumnsOf("table")),
            new ParamSpec("column", ParamKind.Text, BimColumns.Category, Suggest: SuggestSource.ColumnsOf("table")),
            new ParamSpec("start", ParamKind.DateTime, DefaultStart),
            new ParamSpec("daysPerTask", ParamKind.Integer, DefaultDaysPerTask),
            new ParamSpec("trades", ParamKind.Text, DefaultTrades, List: true),
            new ParamSpec("overrides", ParamKind.Json),
        ],
        "A synthetic construction sequence (4D) for an element table such as bim.elements or "
        + "bim.discipline's output; it takes a table rather than a .bos path so a filtered or "
        + "re-classified element set schedules the same way. Each row's trade comes from 'column' "
        + "(Revit categories, IFC classes, or bim.discipline names) by a built-in map to Structure, "
        + "Envelope, MEP, and Finishes; 'overrides' is a JSON {\"value\": \"trade\"} object that wins. "
        + "'trades' orders the trades; storeys from 'levelColumn' run bottom-up by the lowest "
        + "'elevationColumn' value, then by name (only by name, with a warning, when that column is "
        + "missing). A task starts when the previous trade has left "
        + "its storey and its own trade has left the storey below, so trades overlap by one storey; "
        + "each task with elements lasts 'daysPerTask' calendar days from 'start'. Output 'tasks': "
        + "Task, Storey, Trade, Start, End (exclusive, ISO dates), DurationDays, FinishWeek (the week "
        + "of the last working day, End - 1, counted from 1 at 'start'), ElementCount, Synthetic. "
        + "Output 'elements': the input rows plus Task, Trade, Finish (the task's exclusive End), "
        + "FinishWeek (as in 'tasks'), Synthetic (true on every scheduled row); rows with no storey or "
        + "no trade get nulls in all five and are counted in one warning. Same input, same schedule.",
        Schemas:
        [
            KindSchemas.Static("tasks",
                ColumnKinds.Task.NotNull(), ColumnKinds.Storey.NotNull(), ColumnKinds.Trade.NotNull(),
                ColumnKinds.Start.NotNull(), ColumnKinds.End.NotNull(), ColumnKinds.DurationDays.NotNull(),
                ColumnKinds.FinishWeek.NotNull(), ColumnKinds.ElementCount.NotNull(), ColumnKinds.Synthetic.NotNull()),
            SchemaSpec.Inferred("elements"),
        ]);

    public SchemaResult Infer(string output, IReadOnlyList<SchemaInput> inputs, ParamValues parameters, ISchemaCatalog catalog)
        => BimSchemas.Input(inputs, 0, Kind)
            .Require(Kind, parameters.TextOr("levelColumn", BimColumns.Level), parameters.TextOr("column", BimColumns.Category))
            .Add(Kind, ColumnKinds.Task, ColumnKinds.Trade, ColumnKinds.Finish, ColumnKinds.FinishWeek, ColumnKinds.Synthetic);

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var table = inputs.TableInput(0, Kind);
        foreach (var name in new[] { Task, Trade, Finish, FinishWeek, Synthetic })
            if (table.ColumnIndex(name) >= 0)
                throw new ArgumentException($"{Kind}: column '{name}' already exists.");
        var trades = parameters.TextOr("trades", DefaultTrades).SplitNames();
        var rows = ReadRows(context, table, parameters, BimBuildSequenceTrades.Classifier(trades, parameters.GetText("overrides"), Kind));
        var storeys = StoreyOrder(rows);
        var storeyIndex = storeys.Select((name, i) => (name, i)).ToDictionary(p => p.name, p => p.i, StringComparer.Ordinal);
        var tasks = rows.Select(r => r.TaskIndex(storeyIndex)).ToList();
        var plan = Plan(tasks, storeys.Count, trades.Count, DaysPerTask(parameters));
        var start = StartDate(parameters);

        var unscheduled = tasks.Count(t => t is null);
        if (unscheduled > 0)
            context.Warn($"{Kind}: {unscheduled} of {rows.Count} rows have no storey or no trade and are not scheduled.");
        return [new TableValue(TasksTable(plan, storeys, trades, start)),
            new TableValue(ElementsTable(table, tasks, storeys, plan, trades, start))];
    }

    private sealed record Row(string? Storey, double? Elevation, int? Trade)
    {
        public (int Storey, int Trade)? TaskIndex(IReadOnlyDictionary<string, int> storeyIndex)
            => Storey is null || Trade is not { } t ? null : (storeyIndex[Storey], t);
    }

    private sealed record Slot(int StartDay, int EndDay, int Elements);

    private static IReadOnlyList<Row> ReadRows(IEvalContext context, IDataTable table, ParamValues parameters,
        Func<string?, int?> classify)
    {
        var level = table.RequireColumn(parameters.TextOr("levelColumn", BimColumns.Level), Kind);
        var source = table.RequireColumn(parameters.TextOr("column", BimColumns.Category), Kind);
        var elevationName = parameters.TextOr("elevationColumn", BimColumns.Elevation);
        var elevation = table.ColumnIndex(elevationName);
        if (elevation < 0)
            context.Warn($"{Kind}: column '{elevationName}' not found; storeys are ordered by name.");
        var rows = new Row[table.RowCount()];
        for (var row = 0; row < rows.Length; row++)
            rows[row] = new Row(
                TableColumns.CellText(table[level, row]) is { Length: > 0 } s ? s : null,
                elevation >= 0 ? TableColumns.CellNumber(table[elevation, row]) : null,
                classify(TableColumns.CellText(table[source, row])));
        return rows;
    }

    private static IReadOnlyList<string> StoreyOrder(IReadOnlyList<Row> rows)
        => rows.Where(r => r.Storey is not null && r.Trade is not null)
            .GroupBy(r => r.Storey!)
            .Select(g => (Name: g.Key, Elevation: g.Min(r => r.Elevation)))
            .OrderBy(s => s.Elevation is null)
            .ThenBy(s => s.Elevation)
            .ThenBy(s => s.Name, StringComparer.Ordinal)
            .Select(s => s.Name)
            .ToList();

    private static Slot[,] Plan(IReadOnlyList<(int Storey, int Trade)?> tasks, int storeyCount, int tradeCount, int days)
    {
        var counts = new int[storeyCount, tradeCount];
        foreach (var task in tasks)
            if (task is { } i)
                counts[i.Storey, i.Trade]++;
        var plan = new Slot[storeyCount, tradeCount];
        for (var s = 0; s < storeyCount; s++)
            for (var t = 0; t < tradeCount; t++)
            {
                var startDay = Math.Max(t > 0 ? plan[s, t - 1].EndDay : 0, s > 0 ? plan[s - 1, t].EndDay : 0);
                plan[s, t] = new Slot(startDay, startDay + (counts[s, t] > 0 ? days : 0), counts[s, t]);
            }
        return plan;
    }

    private static IDataTable TasksTable(Slot[,] plan, IReadOnlyList<string> storeys,
        IReadOnlyList<string> trades, DateTime start)
    {
        var tasks = (from s in Enumerable.Range(0, storeys.Count)
                from t in Enumerable.Range(0, trades.Count)
                where plan[s, t].Elements > 0
                orderby plan[s, t].StartDay, t, s
                select (Storey: storeys[s], Trade: trades[t], Slot: plan[s, t]))
            .ToList();
        object?[] Cells(Func<(string Storey, string Trade, Slot Slot), object?> f) => tasks.Select(f).ToArray();

        var b = new DataTableBuilder("tasks");
        b.AddColumn(Cells(x => TaskName(x.Storey, x.Trade)), Task, typeof(string));
        b.AddColumn(Cells(x => x.Storey), Storey, typeof(string));
        b.AddColumn(Cells(x => x.Trade), Trade, typeof(string));
        b.AddColumn(Cells(x => IsoDate(start, x.Slot.StartDay)), Start, typeof(string));
        b.AddColumn(Cells(x => IsoDate(start, x.Slot.EndDay)), End, typeof(string));
        b.AddColumn(Cells(x => (long)(x.Slot.EndDay - x.Slot.StartDay)), DurationDays, typeof(long));
        b.AddColumn(Cells(x => Week(x.Slot.EndDay)), FinishWeek, typeof(long));
        b.AddColumn(Cells(x => (long)x.Slot.Elements), BimColumns.ElementCount, typeof(long));
        b.AddColumn(Cells(_ => true), Synthetic, typeof(bool));
        return b.Build();
    }

    private static IDataTable ElementsTable(IDataTable table, IReadOnlyList<(int Storey, int Trade)?> tasks,
        IReadOnlyList<string> storeys, Slot[,] plan, IReadOnlyList<string> trades, DateTime start)
    {
        object?[] Cells(Func<(int Storey, int Trade), object?> f)
            => tasks.Select(x => x is { } i ? f(i) : null).ToArray();

        var b = table.CopyBuilder();
        b.AddColumn(Cells(i => TaskName(storeys[i.Storey], trades[i.Trade])), Task, typeof(string));
        b.AddColumn(Cells(i => trades[i.Trade]), Trade, typeof(string));
        b.AddColumn(Cells(i => IsoDate(start, plan[i.Storey, i.Trade].EndDay)), Finish, typeof(string));
        b.AddColumn(Cells(i => Week(plan[i.Storey, i.Trade].EndDay)), FinishWeek, typeof(long));
        b.AddColumn(Cells(_ => true), Synthetic, typeof(bool));
        return b.Build();
    }

    private static string TaskName(string storey, string trade)
        => $"{storey} - {trade}";

    private static string IsoDate(DateTime start, int day)
        => start.AddDays(day).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>The 1-based week holding the last working day of a task ending (exclusively)
    /// on endDay; every emitted task lasts at least one day.</summary>
    private static long Week(int endDay)
        => (endDay - 1) / 7 + 1;

    private static int DaysPerTask(ParamValues parameters)
        => int.TryParse(parameters.TextOr("daysPerTask", DefaultDaysPerTask), NumberStyles.Integer,
            CultureInfo.InvariantCulture, out var days) && days > 0
            ? days
            : throw new ArgumentException($"{Kind}: parameter 'daysPerTask' must be a positive whole number.");

    private static DateTime StartDate(ParamValues parameters)
        => string.IsNullOrWhiteSpace(parameters.GetText("start"))
            ? DateTime.ParseExact(DefaultStart, "yyyy-MM-dd", CultureInfo.InvariantCulture)
            : parameters.RequiredDateTime("start", Kind).Date;
}

/// <summary>The built-in map from categories, IFC classes, and bim.discipline names to the
/// four default trades, matched case-insensitively by prefix in order.</summary>
internal static class BimBuildSequenceTrades
{
    public static Func<string?, int?> Classifier(IReadOnlyList<string> trades, string overridesJson, string kind)
    {
        if (trades.Count == 0)
            throw new ArgumentException($"{kind}: parameter 'trades' must name at least one trade.");
        var overrides = ParseOverrides(overridesJson, kind);
        foreach (var (value, trade) in overrides)
            if (Find(trades, trade) is null)
                throw new ArgumentException($"{kind}: override '{value}' names trade '{trade}', which is not in 'trades'.");
        return value => value is null
            ? null
            : overrides.TryGetValue(value, out var overridden)
                ? Find(trades, overridden)
                : Rules.FirstOrDefault(r => value.StartsWith(r.Prefix, StringComparison.OrdinalIgnoreCase)).Trade
                    is { } builtIn ? Find(trades, builtIn) : null;
    }

    private static int? Find(IReadOnlyList<string> trades, string trade)
    {
        for (var i = 0; i < trades.Count; i++)
            if (string.Equals(trades[i], trade, StringComparison.OrdinalIgnoreCase))
                return i;
        return null;
    }

    private static IReadOnlyDictionary<string, string> ParseOverrides(string json, string kind)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(json))
            return map;
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
                throw new ArgumentException($"{kind}: 'overrides' must be a JSON object of {{\"value\": \"trade\"}}.");
            foreach (var property in document.RootElement.EnumerateObject())
                map[property.Name] = property.Value.ValueKind == JsonValueKind.String
                    ? property.Value.GetString()!
                    : throw new ArgumentException($"{kind}: override '{property.Name}' must map to a trade name.");
            return map;
        }
        catch (JsonException e)
        {
            throw new ArgumentException($"{kind}: 'overrides' is not valid JSON: {e.Message}", e);
        }
    }

    private const string Structure = "Structure";
    private const string Envelope = "Envelope";
    private const string Mep = "MEP";
    private const string Finishes = "Finishes";

    private static readonly (string Prefix, string? Trade)[] Rules =
    [
        ("Structur", Structure), ("Floors", Structure), ("Stairs", Structure), ("Columns", Structure),
        ("IfcColumn", Structure), ("IfcBeam", Structure), ("IfcSlab", Structure), ("IfcFooting", Structure),
        ("IfcPile", Structure), ("IfcMember", Structure), ("IfcReinforc", Structure), ("IfcStair", Structure),
        ("Walls", Envelope), ("Windows", Envelope), ("Roofs", Envelope), ("Curtain", Envelope),
        ("IfcWall", Envelope), ("IfcCurtainWall", Envelope), ("IfcWindow", Envelope), ("IfcRoof", Envelope),
        ("IfcPlate", Envelope),
        ("Mechanical", Mep), ("Electrical", Mep), ("Plumbing", Mep), ("Fire", Mep), ("Duct", Mep),
        ("Flex", Mep), ("Pipe", Mep), ("Air Terminals", Mep), ("Lighting", Mep), ("Sprinklers", Mep),
        ("Conduit", Mep), ("Cable Tray", Mep), ("Communication", Mep), ("Data Devices", Mep),
        ("Security Devices", Mep), ("IfcDuct", Mep), ("IfcPipe", Mep), ("IfcFlow", Mep),
        ("IfcDistribution", Mep), ("IfcAirTerminal", Mep), ("IfcLight", Mep), ("IfcSanitary", Mep),
        ("IfcCable", Mep), ("IfcElectric", Mep), ("IfcOutlet", Mep), ("IfcSwitch", Mep), ("IfcValve", Mep),
        ("IfcPump", Mep), ("IfcFan", Mep), ("IfcBoiler", Mep), ("IfcChiller", Mep), ("IfcFireSuppression", Mep),
        ("Architecture", Finishes), ("Doors", Finishes), ("Ceilings", Finishes), ("Railings", Finishes),
        ("Furniture", Finishes), ("Casework", Finishes), ("IfcDoor", Finishes), ("IfcCovering", Finishes),
        ("IfcRailing", Finishes), ("IfcFurnishing", Finishes), ("IfcFurniture", Finishes),
    ];
}
