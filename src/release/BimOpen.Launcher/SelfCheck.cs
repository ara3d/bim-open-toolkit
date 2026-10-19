using System.Text.Json;

namespace BimOpen.Launcher;

/// <summary>The requests made of a running host.</summary>
public interface IHostApi
{
    int Port { get; }

    Task<(int Status, string Body)> Get(string path);

    Task<(int Status, string Body)> Put(string path, string json);
}

/// <summary>A host the self-check started; disposing it stops the host.</summary>
public interface IHostHandle : IHostApi, IDisposable;

/// <summary>What the self-check does to the outside world, so tests can stand in for the host and the MCP server.</summary>
public interface ISelfCheckPorts
{
    /// <summary>Starts the host on a free port with a scratch store; null when it does not answer in time.</summary>
    Task<IHostHandle?> StartHost();

    /// <summary>Calls one tool of the IFC MCP server through its program and returns the text it answered.</summary>
    Task<string> CallIfcTool(string tool, string argumentsJson);
}

/// <summary>Step 5: starts the host from the release folder, evaluates a sample graph, calls an MCP tool, stops the host.</summary>
public static class SelfCheck
{
    public const string SampleGraph = "bim-level-summary";

    public const string SampleModel = "duplex-enriched.ifc";

    public const string HostLogName = "selfcheck-host.log";

    public static IReadOnlyList<Finding> Files(Layout layout)
        => layout.Required.Where(file => !File.Exists(Path.Combine(layout.Root, file))).ToList() is { Count: > 0 } missing
            ? [Finding.Fail("Release files", $"missing: {string.Join(", ", missing)}.",
                "Unzip the release again into an empty folder. If the download is smaller than the size on the release page, download it again.")]
            : [Finding.Ok("Release files", "the host, the IFC server, the web pages, and the sample model are all there.")];

    public static async Task<IReadOnlyList<Finding>> Run(Layout layout, ISelfCheckPorts ports)
    {
        var findings = new List<Finding>(Files(layout));
        if (findings.AnyFailed())
            return findings;

        using var host = await ports.StartHost();
        if (host is null)
            findings.Add(Finding.Fail("Host", "the host did not answer in time.",
                $"Read the end of {Path.Combine(layout.Logs, HostLogName)} for the reason.\n"
                + "A program that blocks new executables (antivirus), or a folder you cannot write to, are the usual causes."));
        else
        {
            findings.Add(Finding.Ok("Host", $"started on port {host.Port} and answered."));
            findings.Add(await Graph(host));
            findings.Add(await Pages(host));
            findings.Add(await Notebooks(layout, host));
        }
        findings.Add(await IfcTool(layout, ports));
        return findings;
    }

    private static async Task<Finding> Graph(IHostApi host)
    {
        var (status, body) = await host.Get($"api/analyses/{SampleGraph}/state");
        var statuses = status == 200 ? NodeStatuses(body) : [];
        return statuses.Count > 0 && statuses.All(s => s == "Ok")
            ? Finding.Ok("Sample graph", $"{SampleGraph}: all {statuses.Count} nodes evaluated to Ok.")
            : Finding.Fail("Sample graph",
                status != 200
                    ? $"{SampleGraph}: the host answered {status}."
                    : $"{SampleGraph}: nodes are {string.Join(", ", statuses.Distinct())}, not all Ok.",
                "Read the end of the host log in the state\\logs folder. If it repeats after a restart, send that log to the people who gave you the release.");
    }

    private static async Task<Finding> Pages(IHostApi host)
    {
        var (page, _) = await host.Get(Layout.StartPage);
        var (listStatus, list) = await host.Get("__notebooks/");
        var count = listStatus == 200 ? NotebookNames(list).Count : 0;
        return page == 200 && count > 0
            ? Finding.Ok("Notebook page", $"{Layout.StartPage} is served, with {count} notebooks.")
            : Finding.Fail("Notebook page", $"{Layout.StartPage} answered {page}, and the notebook list has {count} entries.",
                "The web folder of the release is incomplete. Unzip the release again into an empty folder.");
    }

    private static async Task<Finding> Notebooks(Layout layout, IHostApi host)
    {
        var graphs = NotebookGraphs.All(layout);
        var result = await NotebookGraphs.Install(graphs, host);
        return graphs.Count == 0
            ? Finding.Fail("Notebook graphs", "the sample notebooks hold no graphs.", "The samples folder is incomplete. Unzip the release again into an empty folder.")
            : result.Failed > 0
                ? Finding.Fail("Notebook graphs", $"{result.Failed} of {graphs.Count} notebook graphs could not be put on the host.",
                    "Read the end of the host log in the state\\logs folder.")
                : Finding.Ok("Notebook graphs", $"{graphs.Count} graphs of the sample notebooks are on the host ({result.Put} put now), so Re-evaluate finds them.");
    }

    private static async Task<Finding> IfcTool(Layout layout, ISelfCheckPorts ports)
    {
        var model = Path.Combine(layout.Samples, "nrc", SampleModel).Replace('\\', '/');
        try
        {
            var answer = await ports.CallIfcTool("ifc_type_counts", JsonSerializer.Serialize(new { path = model }));
            return answer.Contains("IfcDoor", StringComparison.OrdinalIgnoreCase)
                ? Finding.Ok("IFC server", "ifc_type_counts answered for the sample Duplex model, and it lists IfcDoor.")
                : Finding.Fail("IFC server", "ifc_type_counts answered, but without IfcDoor in the counts.",
                    "The sample model may be damaged. Unzip the release again into an empty folder.");
        }
        catch (Exception e) when (e is IOException or InvalidOperationException or TimeoutException or System.ComponentModel.Win32Exception)
        {
            return Finding.Fail("IFC server", $"bimopenmcp-ifc.exe did not answer: {e.Message}",
                "Run bin\\bimopenmcp-ifc.exe in a terminal to see its error. Antivirus software that blocks new programs is the usual cause.");
        }
    }

    public static IReadOnlyList<string> NodeStatuses(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("nodes", out var nodes)
                ? [.. nodes.EnumerateArray().Select(n => n.TryGetProperty("status", out var s) ? s.GetString() ?? "" : "")]
                : [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static IReadOnlyList<string> NotebookNames(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<string[]>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
