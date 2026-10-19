namespace BimOpen.Launcher;

/// <summary>The self-check against the real host and MCP program in the release folder.</summary>
public sealed class RealSelfCheckPorts(Layout layout, Settings settings, HttpClient http) : ISelfCheckPorts
{
    private static readonly TimeSpan HostLimit = TimeSpan.FromSeconds(120);

    public async Task<IHostHandle?> StartHost()
    {
        var scratch = Path.Combine(layout.State, "selfcheck");
        if (Directory.Exists(scratch))
            Directory.Delete(scratch, recursive: true);
        var port = HostProcess.FreePort();
        var arguments = HostArguments.For(layout, settings, port, Path.Combine(scratch, "store"), layout.Cache);
        var host = HostProcess.Start(layout, arguments, port, Path.Combine(layout.Logs, SelfCheck.HostLogName));
        if (await host.WaitUntilUp(HostLimit, http))
            return new Handle(host, new HostApi(host.Port, http));
        host.Stop();
        return null;
    }

    public Task<string> CallIfcTool(string tool, string argumentsJson)
        => McpStdioClient.CallTool(layout.IfcMcpExe, tool, argumentsJson, HostLimit);

    private sealed class Handle(HostProcess host, HostApi api) : IHostHandle
    {
        public int Port => api.Port;

        public Task<(int Status, string Body)> Get(string path)
            => api.Get(path);

        public Task<(int Status, string Body)> Put(string path, string json)
            => api.Put(path, json);

        public void Dispose()
            => host.Stop();
    }
}
