using System.Text.Json;
using System.Text.Json.Nodes;
using BimOpenFlow.Ask;
using BimOpenToolkit.TestSupport;

namespace BimOpenMcp.Ifc.Ask.Tests;

/// <summary>One whole run over a real building model, from the command line to the two files it
/// leaves behind, with the language model scripted. Needs data/duplex.ifc (data/get-test-data.ps1);
/// the test is ignored rather than failed when the fixture has not been fetched.</summary>
public sealed class DuplexAskTests
{
    private static string Model()
    {
        var path = RepoPaths.Data("duplex.ifc");
        if (!File.Exists(path))
            Assert.Ignore($"{path} not found; run data/get-test-data.ps1");
        return path;
    }

    [Test]
    public async Task ARunOverDuplexProducesATranscriptAndAResultsFile()
    {
        var path = Model();
        var options = IfcAskOptions.Parse(["--model", path, "How many building storeys are there?"]);
        var scripted = new ScriptedModel(
            ScriptedModel.ToolCall("c1", "ifc_open", $$"""{"path":{{JsonSerializer.Serialize(path)}}}"""),
            ScriptedModel.Text("Duplex is an IFC2X3 model; from ifc_open, 1 row of header information."));

        using var cache = new IfcSessionCache();
        using var tools = IfcAskRunner.CreateServer(cache);
        var runner = new IfcAskRunner(tools, new OpenAiChat(new HttpClient(scripted), "sk-test", "gpt-test"),
            options.ModelPath, options.MaxTurns);
        var answers = await runner.RunAsync(options.Questions, CancellationToken.None);

        Assert.That(answers, Has.Count.EqualTo(1));
        var call = answers[0].ToolCalls.Single();
        Assert.That((call.Name, call.Ok), Is.EqualTo(("ifc_open", (bool?)true)));
        Assert.That(call.Summary, Does.Contain("IFC"), "the real file was opened and its schema read");

        var header = new IfcAskReport.Header(DateTimeOffset.Now, "gpt-test", options.ModelPath, "abc1234");
        var markdown = IfcAskReport.Markdown(header, answers);
        Assert.That(markdown, Does.Contain("### How many building storeys are there?"));
        Assert.That(markdown, Does.Contain("**Agent calls** `ifc_open` with"));
        Assert.That(markdown, Does.Contain("**Answer:** Duplex is an IFC2X3 model"));
        Assert.That(markdown, Does.Contain("Turns 2;"));

        var results = JsonNode.Parse(IfcAskReport.Json(answers))!.AsArray();
        Assert.That(results, Has.Count.EqualTo(1));
        Assert.That(results[0]!["toolCalls"]!.AsArray()[0]!["name"]!.GetValue<string>(), Is.EqualTo("ifc_open"));
        Assert.That(results[0]!["toolCalls"]!.AsArray()[0]!["args"]!["path"]!.GetValue<string>(), Is.EqualTo(path));

        var offered = scripted.FunctionsOffered(0);
        Assert.That(offered, Does.Not.Contain("ifc_export_glb").And.Not.Contain("ifc_sql_export"));
        Assert.That(offered, Does.Contain("ifc_sql"));
    }
}
