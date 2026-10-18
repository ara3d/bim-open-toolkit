using System.Globalization;
using System.Text;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Puts text on the 3D view: appends label, labelX, labelY, labelZ to an instance table. The
/// label is a format string filled from a values table joined on a column; the anchor is the top
/// centre of the union of the labelled instances' boxes, in the frame of the table's minX..maxZ
/// columns (so it follows view3d.spacing and view3d.arrange offsets). The 3D pane reads only
/// these four columns.
/// </summary>
public sealed class LabelNode : IFlowNode, ISchemaNode
{
    public const string Kind = "view3d.label";
    public const string LabelColumn = "label";
    public static readonly string[] AnchorColumns = ["labelX", "labelY", "labelZ"];
    public const long DefaultLimit = 200;

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        [
            new("instances", PortType.Table),
            new("values", PortType.Table, Optional: true),
        ],
        [new("instances", PortType.Table)],
        [
            new("joinColumn", ParamKind.Text, "entityId",
                Suggest: SuggestSource.ColumnsOf("instances", ColumnUse.JoinKey, "values")),
            new("format", ParamKind.Text),
            new("groupColumn", ParamKind.Text, Suggest: SuggestSource.ColumnsOf("instances")),
            new("limit", ParamKind.Integer, DefaultLimit.ToString(CultureInfo.InvariantCulture)),
        ],
        "Writes text on elements in the 3D view. Adds label, labelX, labelY, labelZ columns to an "
        + "instance table; the 3D pane draws every non-null label as text at its anchor. `format` "
        + "is the text with {Column} or {Column:0.0} placeholders (.NET numeric formats, invariant "
        + "culture), for example \"{Name}: {OverallWidth:0} mm\", filled from the `values` table "
        + "joined to the instances on `joinColumn`; with no `values` input the placeholders read "
        + "the instance table's own columns. Without `groupColumn` there is one label per distinct "
        + "join value, anchored at the top centre of the union of that value's instance boxes; "
        + "with `groupColumn` (an instance or values column, such as the storey) there is one "
        + "label per group, anchored over the union of the group's boxes, its placeholders read "
        + "from the group's first values row (a per-storey total table is the intended use). A "
        + "row whose placeholder value is empty gets no label, never invented text. A placeholder "
        + "naming a column that does not exist is an error. Past `limit` labels the rest get "
        + "none and the node warns with how many were dropped.");

    public SchemaResult Infer(string output, IReadOnlyList<SchemaInput> inputs, ParamValues parameters, ISchemaCatalog catalog)
    {
        if (inputs[0].Schema is not { } input)
            return SchemaResult.Fail($"{Kind}: input 0 has no table connected.");
        if (!input.Ok)
            return input;
        var schema = input.Schema!;
        var joinName = parameters.GetText("joinColumn", "entityId");
        if (!schema.Has(joinName))
            return SchemaResult.Fail($"{Kind}: no column named '{joinName}'.");
        if (AnchorColumns.Prepend(LabelColumn).FirstOrDefault(schema.Has) is { } taken)
            return SchemaResult.Fail($"{Kind}: column '{taken}' already exists.");
        return SchemaResult.Of(new Schema([
            .. schema.Columns,
            new Column(LabelColumn, ColumnType.Text),
            .. AnchorColumns.Select(c => new Column(c, ColumnType.Number)),
        ]));
    }

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var instances = ((TableValue)inputs[0]).Table;
        var values = inputs.Count > 1 && inputs[1] is TableValue v ? v.Table : null;
        var source = values ?? instances;
        var joinName = parameters.GetText("joinColumn", "entityId");
        var groupName = parameters.GetText("groupColumn");
        var limit = parameters.GetInteger("limit", DefaultLimit);

        foreach (var taken in AnchorColumns.Prepend(LabelColumn))
            if (instances.ColumnIndex(taken) >= 0)
                throw new ArgumentException($"{Kind}: the instance table already has a column '{taken}'");

        var format = LabelFormat.Parse(parameters.GetText("format"), source);
        var instJoin = instances.RequireColumn(joinName);
        var valJoin = source.RequireColumn(joinName);
        var bounds = new[] { "minX", "minY", "minZ", "maxX", "maxY", "maxZ" }
            .Select(instances.RequireColumn).ToArray();

        var n = instances.RowCount();
        var valueRowOf = FirstRowByKey(source, valJoin);
        var matched = new int[n]; // values row for each instance row, -1 when none
        for (var i = 0; i < n; i++)
            matched[i] = TableOps.CanonicalText(instances[instJoin, i]) is { } k && valueRowOf.TryGetValue(k, out var r) ? r : -1;

        var groups = GroupRows(instances, source, matched, instJoin, groupName);

        var label = new object?[n];
        var anchors = AnchorColumns.Select(_ => new object?[n]).ToArray();
        var dropped = 0;
        var used = 0;
        foreach (var rows in groups)
        {
            var valueRow = rows.Select(r => matched[r]).FirstOrDefault(r => r >= 0, -1);
            if (valueRow < 0 || format.Render(source, valueRow) is not { } text
                || Union(instances, bounds, rows) is not { } box)
                continue;
            if (used >= limit)
            {
                dropped++;
                continue;
            }
            used++;
            var first = rows[0];
            label[first] = text;
            anchors[0][first] = (box[0] + box[3]) / 2;
            anchors[1][first] = (box[1] + box[4]) / 2;
            anchors[2][first] = box[5];
        }
        if (dropped > 0)
            context.Warn($"{Kind}: {dropped} labels dropped past the limit of {limit}; raise 'limit' or narrow the instances");

        var builder = new DataTableBuilder(instances.Name);
        builder.AddColumns(instances);
        builder.AddColumn(label, LabelColumn, typeof(string));
        for (var a = 0; a < AnchorColumns.Length; a++)
            builder.AddColumn(anchors[a], AnchorColumns[a], typeof(double));
        return [new TableValue(builder.Build())];
    }

    private static Dictionary<string, int> FirstRowByKey(IDataTable table, int keyColumn)
    {
        var first = new Dictionary<string, int>();
        for (var i = 0; i < table.RowCount(); i++)
            if (TableOps.CanonicalText(table[keyColumn, i]) is { } key)
                first.TryAdd(key, i);
        return first;
    }

    /// <summary>Instance rows per label, in the order of each group's first row. Rows with a null
    /// join value (or null group value) belong to no label.</summary>
    private static List<List<int>> GroupRows(IDataTable instances, IDataTable source, int[] matched, int instJoin, string groupName)
    {
        Func<int, string?> keyOf = groupName.Length == 0
            ? row => TableOps.CanonicalText(instances[instJoin, row])
            : GroupKey(instances, source, matched, groupName);
        var byKey = new Dictionary<string, List<int>>();
        var ordered = new List<List<int>>();
        for (var i = 0; i < instances.RowCount(); i++)
        {
            if (keyOf(i) is not { } key)
                continue;
            if (!byKey.TryGetValue(key, out var rows))
            {
                byKey[key] = rows = [];
                ordered.Add(rows);
            }
            rows.Add(i);
        }
        return ordered;
    }

    private static Func<int, string?> GroupKey(IDataTable instances, IDataTable source, int[] matched, string groupName)
    {
        if (instances.ColumnIndex(groupName) is var inst && inst >= 0)
            return row => TableOps.CanonicalText(instances[inst, row]);
        if (!ReferenceEquals(source, instances) && source.ColumnIndex(groupName) is var val && val >= 0)
            return row => matched[row] >= 0 ? TableOps.CanonicalText(source[val, matched[row]]) : null;
        throw new ArgumentException($"{Kind}: no groupColumn '{groupName}' in the instance or values table; "
            + $"instance columns: {string.Join(", ", instances.Columns.Select(c => c.Descriptor.Name))}");
    }

    /// <summary>minX minY minZ maxX maxY maxZ of the rows' union, or null when no row has a full box.</summary>
    private static double[]? Union(IDataTable instances, int[] bounds, IEnumerable<int> rows)
    {
        double[]? union = null;
        foreach (var row in rows)
        {
            var box = bounds.Select(c => TableOps.CellNumber(instances[c, row])).ToArray();
            if (box.Any(b => b is null))
                continue;
            union ??= [double.MaxValue, double.MaxValue, double.MaxValue, double.MinValue, double.MinValue, double.MinValue];
            for (var axis = 0; axis < 3; axis++)
            {
                union[axis] = Math.Min(union[axis], box[axis]!.Value);
                union[axis + 3] = Math.Max(union[axis + 3], box[axis + 3]!.Value);
            }
        }
        return union;
    }
}

/// <summary>A parsed label format: literal text and {Column} / {Column:fmt} placeholders;
/// {{ and }} are literal braces.</summary>
internal sealed class LabelFormat
{
    private readonly List<(string? Literal, int Column, string? Format)> _parts = [];

    public static LabelFormat Parse(string format, IDataTable source)
    {
        if (format.Length == 0)
            throw new ArgumentException($"{LabelNode.Kind}: 'format' is empty; give text such as \"{{Name}}: {{Width:0.0}}\"");
        var result = new LabelFormat();
        var literal = new StringBuilder();
        for (var i = 0; i < format.Length; i++)
        {
            var c = format[i];
            if ((c == '{' || c == '}') && i + 1 < format.Length && format[i + 1] == c)
            {
                literal.Append(c);
                i++;
            }
            else if (c == '}')
                throw new ArgumentException($"{LabelNode.Kind}: unmatched '}}' in format \"{format}\"");
            else if (c == '{')
            {
                var end = format.IndexOf('}', i);
                if (end < 0)
                    throw new ArgumentException($"{LabelNode.Kind}: unclosed '{{' in format \"{format}\"");
                if (literal.Length > 0)
                    result._parts.Add((literal.ToString(), -1, null));
                literal.Clear();
                var body = format[(i + 1)..end];
                var colon = body.IndexOf(':');
                var name = (colon < 0 ? body : body[..colon]).Trim();
                var column = source.ColumnIndex(name);
                if (column < 0)
                    throw new ArgumentException($"{LabelNode.Kind}: format placeholder '{{{name}}}' names no column of table "
                        + $"'{source.Name}'; columns: {string.Join(", ", source.Columns.Select(x => x.Descriptor.Name))}");
                result._parts.Add((null, column, colon < 0 ? null : body[(colon + 1)..]));
                i = end;
            }
            else
                literal.Append(c);
        }
        if (literal.Length > 0)
            result._parts.Add((literal.ToString(), -1, null));
        return result;
    }

    /// <summary>The text for one row of the source table, or null when any placeholder's cell is null.</summary>
    public string? Render(IDataTable source, int row)
    {
        var text = new StringBuilder();
        foreach (var (literal, column, format) in _parts)
        {
            if (literal is not null)
            {
                text.Append(literal);
                continue;
            }
            var cell = source[column, row];
            if (cell is null or DBNull)
                return null;
            text.Append(format is not null && cell is IFormattable f
                ? f.ToString(format, CultureInfo.InvariantCulture)
                : TableOps.CanonicalText(cell));
        }
        return text.ToString();
    }
}
