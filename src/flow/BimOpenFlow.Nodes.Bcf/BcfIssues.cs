using System.Globalization;
using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.IO.Bcf;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Bcf;

/// <summary>How bcf.topics and bcf.write read their input table: which columns name the topic
/// (an issue table's Title and Description, or a verdict table's CheckTitle and Citation) and
/// which verdict rows to keep. Column names match case-insensitively, so a check.rule table
/// (checkTitle, verdict) works as well as an IDS one (CheckTitle, Verdict).</summary>
internal static class BcfIssues
{
    public const string PresetParam = "preset";
    public const string VerdictsParam = "verdicts";
    public const string Auto = "auto", Issue = "issue", VerdictPreset = "verdict";
    private static readonly string[] Presets = [Auto, Issue, VerdictPreset];

    public static readonly ParamSpec PresetSpec = new(PresetParam, ParamKind.Enum, Auto, Presets);

    /// <summary>The Verdict values to keep when the table has a Verdict column; empty keeps every row.</summary>
    public static readonly ParamSpec VerdictsSpec = new(VerdictsParam, ParamKind.Text, "Fail", List: true);

    public static readonly string ParamsDescription =
        $"'{PresetParam}' names the topic columns: '{Issue}' reads Title and Description, '{VerdictPreset}' "
        + $"reads CheckTitle and Citation, '{Auto}' picks by the columns present. When the table has a Verdict "
        + $"column, only rows whose verdict is listed in '{VerdictsParam}' (comma-separated; default Fail) are kept; "
        + "an empty list keeps every row.";

    /// <summary>The issues of a table under the node's parameters: one per distinct title, in
    /// order of first appearance, after the verdict filter.</summary>
    public static (IReadOnlyList<BcfIssue> Issues, int Rows) From(IDataTable table, ParamValues parameters, string kind)
    {
        var preset = parameters.GetText(PresetParam, Auto);
        if (Array.IndexOf(Presets, preset) < 0)
            throw new ArgumentException($"{kind}: parameter '{PresetParam}' must be one of [{string.Join(", ", Presets)}], got '{preset}'");
        var columns = preset switch
        {
            Issue => new BcfColumns(),
            VerdictPreset => BcfColumns.Verdicts,
            _ => Find(table, IssueColumns.Title) is null && Find(table, IssueColumns.CheckTitle) is not null
                ? BcfColumns.Verdicts
                : new BcfColumns(),
        };
        var filtered = Filter(table, parameters.GetText(VerdictsParam, "Fail"));
        return (filtered.ToBcfIssues(columns), filtered.Rows.Count);
    }

    private static IDataTable Filter(IDataTable table, string verdicts)
    {
        var keep = verdicts.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (keep.Count == 0 || Find(table, IssueColumns.Verdict) is not { } column)
            return table;
        var rows = Enumerable.Range(0, table.Rows.Count)
            .Where(r => keep.Contains(Text(table[column, r])))
            .ToList();
        return table.KeepRows(rows, table.Name);
    }

    /// <summary>The declared columns of <see cref="TopicsTable"/> for the named output.</summary>
    public static SchemaSpec TopicsSchema(string output)
        => KindSchemas.Static(output,
            ColumnKinds.Title, ColumnKinds.Description, ColumnKinds.Status, ColumnKinds.Priority, ColumnKinds.Type,
            ColumnKinds.Elements.NotNull(), ColumnKinds.GlobalIds.NotNull(),
            KindColumn.Plain(AuthoringToolIdsColumn, ColumnType.Text, nullable: false));

    /// <summary>The topics-table column listing the ids not in IFC's GlobalId form.</summary>
    public const string AuthoringToolIdsColumn = "AuthoringToolIds";

    /// <summary>One row per topic: Title, Description, Status, Priority, Type, Elements, GlobalIds,
    /// AuthoringToolIds. Elements counts every id; the ids split by the writer's rule, so an id in
    /// IFC's 22-character form is listed under GlobalIds and any other (a Revit UniqueId, say)
    /// under AuthoringToolIds, the way bcf.write will emit it.</summary>
    public static IDataTable TopicsTable(IReadOnlyList<BcfIssue> issues, string name)
    {
        string Ids(BcfIssue issue, bool globalIds)
            => string.Join(", ", issue.GlobalIds.Where(id => BcfIssueTable.IsGlobalId(id) == globalIds));

        var builder = new DataTableBuilder(name);
        builder.AddColumn(issues.Select(i => (object?)i.Title).ToArray(), IssueColumns.Title, typeof(string));
        builder.AddColumn(issues.Select(i => (object?)i.Description).ToArray(), IssueColumns.Description, typeof(string));
        builder.AddColumn(issues.Select(i => (object?)i.Status).ToArray(), IssueColumns.Status, typeof(string));
        builder.AddColumn(issues.Select(i => (object?)i.Priority).ToArray(), IssueColumns.Priority, typeof(string));
        builder.AddColumn(issues.Select(i => (object?)i.Type).ToArray(), IssueColumns.Type, typeof(string));
        builder.AddColumn(issues.Select(i => (object?)(long)i.GlobalIds.Count).ToArray(), "Elements", typeof(long));
        builder.AddColumn(issues.Select(i => (object?)Ids(i, globalIds: true)).ToArray(), "GlobalIds", typeof(string));
        builder.AddColumn(issues.Select(i => (object?)Ids(i, globalIds: false)).ToArray(), AuthoringToolIdsColumn, typeof(string));
        return builder.Build();
    }

    /// <summary>The declared columns of the one-row table bcf.write's Run returns (see <see cref="SummaryRow"/>).</summary>
    public static SchemaSpec SummarySchema(string output)
        => KindSchemas.Static(output,
            KindColumn.Plain("path", ColumnType.Text, nullable: false),
            KindColumn.Plain("topics", ColumnType.Integer, nullable: false),
            KindColumn.Plain("viewpoints", ColumnType.Integer, nullable: false),
            KindColumn.Plain("elements", ColumnType.Integer, nullable: false),
            KindColumn.Plain("elementsWithoutGeometry", ColumnType.Integer, nullable: false),
            KindColumn.Plain("bytes", ColumnType.Integer, nullable: false),
            KindColumn.Plain("sha256", ColumnType.Text, nullable: false));

    /// <summary>A one-row table; long cells become Integer columns, everything else Text.</summary>
    public static IDataTable SummaryRow(string name, params (string Name, object Value)[] cells)
    {
        var builder = new DataTableBuilder(name);
        foreach (var (column, value) in cells)
            builder.AddColumn(new[] { value is long ? value : (object?)Text(value) }, column, value is long ? typeof(long) : typeof(string));
        return builder.Build();
    }

    private static int? Find(IDataTable table, string name)
    {
        for (var i = 0; i < table.Columns.Count; i++)
            if (string.Equals(table.Columns[i].Descriptor.Name, name, StringComparison.OrdinalIgnoreCase))
                return i;
        return null;
    }

    private static string Text(object? value)
        => value is { } v and not DBNull ? Convert.ToString(v, CultureInfo.InvariantCulture)?.Trim() ?? "" : "";
}
