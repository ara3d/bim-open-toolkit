using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using BimOpenFlow.Nodes.Support;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Breadth-first hop distances from a start room over an undirected edge
/// table, exposing unreachable rooms as nulls.</summary>
public sealed class BimHopsNode : IFlowNode
{
    public const string Kind = "bim.hops";

    // TODO: a bim.shortestPath node listing the actual room sequence between two rooms.
    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("edges", PortType.Table)],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("from", ParamKind.Text, BimColumns.FromRoom, Suggest: SuggestSource.ColumnsOf("edges")),
            new ParamSpec("to", ParamKind.Text, BimColumns.ToRoom, Suggest: SuggestSource.ColumnsOf("edges")),
            new ParamSpec("start", ParamKind.Text),
        ],
        "Walks the undirected graph whose edges are the (from, to) column pairs, breadth-first "
        + "from the 'start' room, into one row per room seen in either column: Room, Hops (0 for "
        + "the start, null for unreachable rooms), ordered by Hops then Room. An unknown start "
        + "room is an error. Typical input: the bim.navGraph edge table.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var edges = inputs.TableInput(0, Kind);
        var fromColumn = edges.RequireColumn(parameters.GetText("from", BimColumns.FromRoom), Kind);
        var toColumn = edges.RequireColumn(parameters.GetText("to", BimColumns.ToRoom), Kind);
        var start = parameters.RequiredText("start", Kind);

        var neighbors = BuildGraph(edges, fromColumn, toColumn);
        if (!neighbors.ContainsKey(start))
            throw new ArgumentException($"{Kind}: start room '{start}' is not in the edge table.");
        var hops = HopsFrom(neighbors, start);

        var rooms = neighbors.Keys
            .OrderBy(r => hops.TryGetValue(r, out var h) ? h : long.MaxValue)
            .ThenBy(r => r, StringComparer.Ordinal)
            .ToList();
        var builder = new DataTableBuilder("hops");
        builder.AddColumn(rooms.Select(r => (object?)r).ToArray(), BimColumns.Room, typeof(string));
        builder.AddColumn(rooms.Select(r => hops.TryGetValue(r, out var h) ? (object?)h : null).ToArray(),
            BimColumns.Hops, typeof(long));
        return [new TableValue(builder.Build())];
    }

    /// <summary>The undirected adjacency over the distinct non-null endpoint labels.</summary>
    private static Dictionary<string, List<string>> BuildGraph(IDataTable edges, int fromColumn, int toColumn)
    {
        var neighbors = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        List<string> Node(string room)
            => neighbors.TryGetValue(room, out var list) ? list : neighbors[room] = [];
        for (var row = 0; row < edges.RowCount(); row++)
        {
            var from = TableColumns.CellText(edges[fromColumn, row]);
            var to = TableColumns.CellText(edges[toColumn, row]);
            var fromList = from is null ? null : Node(from);
            var toList = to is null ? null : Node(to);
            if (from is null || to is null)
                continue;
            fromList!.Add(to);
            toList!.Add(from);
        }
        return neighbors;
    }

    private static Dictionary<string, long> HopsFrom(Dictionary<string, List<string>> neighbors, string start)
    {
        var hops = new Dictionary<string, long>(StringComparer.Ordinal) { [start] = 0 };
        var queue = new Queue<string>([start]);
        while (queue.TryDequeue(out var room))
            foreach (var next in neighbors[room].Where(n => !hops.ContainsKey(n)))
            {
                hops[next] = hops[room] + 1;
                queue.Enqueue(next);
            }
        return hops;
    }
}
