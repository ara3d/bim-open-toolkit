using BimOpenFlow.Host;
using BimOpenFlow.NodeDocs;
using BimOpenFlow.Studio;
using BimOpenMcp.Flow;

// The studio composes the host with the bim profile (and the tables profile plus the NRC
// samples); the generic bimopenflow-host offers only "tables".
//
//   bimopenflow-studio [host options]   the host API plus POST /api/ask, which builds a graph
//                                       from a plain-language request through the MCP tools;
//                                       same options as bimopenflow-host, default profile "bim"
//   bimopenflow-studio mcp [options]    the bimopenflow MCP server over the studio's profiles
//   bimopenflow-studio nodedocs [dir]   writes nodes.md and nodes.catalog.json into dir
//                                       (default: the checkout's docs/)
return args.FirstOrDefault() switch
{
    "mcp" => FlowMcpProgram.Run(args[1..], StudioComposition.Profiles),
    "nodedocs" => WriteNodeDocs(args.Length > 1 ? args[1] : DocsDir()),
    _ => await HostRunner.RunAsync(args, StudioComposition.Profiles, host => host.App.MapAsk(host.Services),
        "BimOpenFlow studio"),
};

static int WriteNodeDocs(string dir)
{
    var catalog = Path.Combine(dir, NodeCatalogFile.FileName);
    File.WriteAllText(catalog, NodeCatalogFile.Text(StudioComposition.Profiles));
    Console.WriteLine($"Wrote {catalog}");
    return NodeDocsProgram.Run(Path.Combine(dir, "nodes.md"), StudioComposition.AllDocPacks);
}

static string DocsDir()
    => Path.Combine(
        SampleSeeding.FindRepoRoot(AppContext.BaseDirectory)
        ?? throw new InvalidOperationException("No solution file above the executable; pass the docs folder."),
        "docs");
