namespace BimOpen.Launcher;

/// <summary>One stdio MCP server as Claude registers it: a name, a program, and its arguments.</summary>
public sealed record McpServer(string Name, string Command, IReadOnlyList<string> Args)
{
    public const string IfcName = "bimopen-ifc";

    public const string FlowName = "bimopenflow-duckdb";

    public bool SameAs(McpServer other)
        => Name == other.Name
            && string.Equals(Command, other.Command, StringComparison.OrdinalIgnoreCase)
            && Args.SequenceEqual(other.Args);

    /// <summary>The two servers of the release, named as the bim-flow and ifc-ask skills name them. The dataflow server is the
    /// studio program in its mcp mode, so it carries the BIM node packs; it shares the host store, so a graph Claude builds
    /// is in the editor.</summary>
    public static IReadOnlyList<McpServer> For(Layout layout, Settings settings)
        =>
        [
            new(IfcName, layout.IfcMcpExe, []),
            new(FlowName, layout.StudioExe,
                ["mcp", "--profile", "bim", "--store", layout.Store, "--cache", layout.Cache, "--models", settings.ModelsArgument(layout)]),
        ];
}
