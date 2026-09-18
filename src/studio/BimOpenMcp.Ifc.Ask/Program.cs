using BimOpenFlow.Ask;
using BimOpenMcp.Ifc;
using BimOpenMcp.Ifc.Ask;

try
{
    var options = IfcAskOptions.Parse(args);
    if (!File.Exists(options.ModelPath))
        throw new FileNotFoundException($"IFC file not found: {options.ModelPath}", options.ModelPath);
    var apiKey = OpenAiChat.ResolveApiKey()
        ?? throw new InvalidOperationException(
            "No OpenAI key: set OPENAI_API_KEY, or OPENAI_API_KEY_FILE to a file whose first line is the key.");
    var model = OpenAiChat.ResolveModel();

    using var cache = new IfcSessionCache();
    using var tools = IfcAskRunner.CreateServer(cache);
    using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
    var runner = new IfcAskRunner(tools, new OpenAiChat(http, apiKey, model), options.ModelPath, options.MaxTurns)
    {
        Progress = Console.Error.WriteLine,
    };

    Console.Error.WriteLine($"{options.Questions.Count} question(s) about {options.ModelPath} with {model}");
    var answers = await runner.RunAsync(options.Questions, CancellationToken.None);

    var header = new IfcAskReport.Header(DateTimeOffset.Now, model, options.ModelPath,
        IfcAskReport.GitCommit(AppContext.BaseDirectory));
    Write(options.TranscriptPath, IfcAskReport.Markdown(header, answers));
    Write(options.ResultsPath, IfcAskReport.Json(answers));
    if (options.TranscriptPath is null && options.ResultsPath is null)
        Console.Out.Write(IfcAskReport.Markdown(header, answers));
    return 0;
}
catch (Exception e)
{
    Console.Error.WriteLine(e.Message);
    return 1;
}

static void Write(string? path, string text)
{
    if (path is null)
        return;
    var directory = Path.GetDirectoryName(Path.GetFullPath(path));
    if (!string.IsNullOrEmpty(directory))
        Directory.CreateDirectory(directory);
    File.WriteAllText(path, text);
    Console.Error.WriteLine($"wrote {Path.GetFullPath(path)}");
}
