namespace BimOpen.Launcher.Tests;

[TestFixture]
public sealed class NotebookGraphsTests
{
    [Test]
    public void In_FindsGraphEmbedsWithADocumentOncePerId()
    {
        var json = """
            {"turns":[
              {"reply":{"embeds":[{"kind":"graph","analysisId":"a","document":"DOC-A"},{"kind":"table","analysisId":"t","document":"x"}]}},
              {"reply":{"embeds":[{"kind":"graph","analysisId":"a","document":"DOC-A2"},{"kind":"graph","analysisId":"b"},{"kind":"graph","analysisId":"c","document":"DOC-C"}]}}
            ]}
            """;
        Assert.That(NotebookGraphs.In(json).Select(g => (g.Id, g.Document)), Is.EqualTo(new[] { ("a", "DOC-A"), ("c", "DOC-C") }));
        Assert.That(NotebookGraphs.In("{ broken"), Is.Empty);
    }

    [Test]
    public void All_ReadsEveryNotebookInTheSamplesFolder()
    {
        using var sandbox = new Sandbox().WithRelease();
        Sandbox.Touch(Path.Combine(sandbox.Layout.Notebooks, "two.notebook.json"), """{"x":{"kind":"graph","analysisId":"nb-two","document":"{}"}}""");
        Assert.That(NotebookGraphs.All(sandbox.Layout).Select(g => g.Id), Is.EqualTo(new[] { "nb-one-graph", "nb-two" }));
        Assert.That(NotebookGraphs.All(new Layout(Path.Combine(sandbox.Folder, "none"))), Is.Empty);
    }

    [Test]
    public async Task Install_PutsOnlyTheMissingGraphs()
    {
        using var sandbox = new Sandbox().WithRelease();
        var ports = new FakePorts();
        using var host = (await ports.StartHost())!;
        var graphs = NotebookGraphs.All(sandbox.Layout);

        var first = await NotebookGraphs.Install(graphs, host);
        var second = await NotebookGraphs.Install(graphs, host);

        Assert.That(first, Is.EqualTo(new NotebookGraphs.Result(1, 0, 0)));
        Assert.That(second, Is.EqualTo(new NotebookGraphs.Result(0, 1, 0)));
        Assert.That(ports.Puts, Is.EqualTo(new[] { "api/analyses/nb-one-graph" }));
    }

    [Test]
    public async Task Install_CountsAGraphTheHostRefuses()
    {
        using var sandbox = new Sandbox().WithRelease();
        using var host = (await new FakePorts(putStatus: 500).StartHost())!;

        var result = await NotebookGraphs.Install(NotebookGraphs.All(sandbox.Layout), host);

        Assert.That(result, Is.EqualTo(new NotebookGraphs.Result(0, 0, 1)));
    }

    [Test]
    public async Task SelfCheck_FailsWhenTheHostRefusesTheNotebookGraphs()
    {
        using var sandbox = new Sandbox().WithRelease();
        var findings = await SelfCheck.Run(sandbox.Layout, new FakePorts(putStatus: 500));
        Assert.That(findings.Single(f => f.Subject == "Notebook graphs").Status, Is.EqualTo(Status.Fail));
    }

    [Test]
    public void All_AddsTheGraphFilesWithTheirPlaceholdersFilledAndSkipsSnowdon()
    {
        using var sandbox = new Sandbox().WithRelease();
        var graphs = Path.Combine(sandbox.Layout.NotebookGraphFolder, "s14");
        Sandbox.Touch(Path.Combine(graphs, "nb-s14-review.json"), """{"path":"{SAMPLES}/duplex.bos","out":"{ARTIFACTS}/x.bcf"}""");
        Sandbox.Touch(Path.Combine(graphs, "nb-s10-open.json"), """{"path":"{SNOWDON}"}""");
        Sandbox.Touch(Path.Combine(graphs, "nb-one-graph.json"), """{"file":"loses to the embed"}""");

        var all = NotebookGraphs.All(sandbox.Layout);

        Assert.That(all.Select(g => g.Id), Is.EqualTo(new[] { "nb-one-graph", "nb-s14-review" }));
        Assert.That(all.Single(g => g.Id == "nb-one-graph").Document, Does.Contain("formatVersion"));
        var root = sandbox.Layout.Root.Replace('\\', '/');
        Assert.That(all.Single(g => g.Id == "nb-s14-review").Document, Is.EqualTo($$"""{"path":"{{root}}/samples/nrc/duplex.bos","out":"{{root}}/artifacts/x.bcf"}"""));
    }

    [Test]
    public void All_FillsPlaceholdersInAnEmbeddedDocumentToo()
    {
        using var sandbox = new Sandbox().WithRelease();
        Sandbox.Touch(Path.Combine(sandbox.Layout.Notebooks, "two.notebook.json"),
            """{"x":{"kind":"graph","analysisId":"nb-two","document":"{\"model\":\"{SAMPLES}/duplex-enriched.bos\"}"}}""");

        var document = NotebookGraphs.All(sandbox.Layout).Single(g => g.Id == "nb-two").Document;

        Assert.That(document, Does.Contain("/samples/nrc/duplex-enriched.bos").And.Not.Contain("{SAMPLES}"));
    }

    [Test]
    public async Task Install_WithReplace_PutsGraphsTheHostAlreadyHas()
    {
        using var sandbox = new Sandbox().WithRelease();
        var ports = new FakePorts();
        using var host = (await ports.StartHost())!;
        var graphs = NotebookGraphs.All(sandbox.Layout);
        await NotebookGraphs.Install(graphs, host);

        var again = await NotebookGraphs.Install(graphs, host, replace: true);

        Assert.That(again, Is.EqualTo(new NotebookGraphs.Result(1, 0, 0)));
        Assert.That(ports.Puts, Has.Count.EqualTo(2));
    }

    [Test]
    public void Marker_SaysMovedUntilRecordedAndAgainWhenTheFolderChanges()
    {
        using var sandbox = new Sandbox().WithRelease();
        Assert.That(NotebookGraphMarker.Moved(sandbox.Layout), Is.True);
        NotebookGraphMarker.Record(sandbox.Layout);
        Assert.That(NotebookGraphMarker.Moved(sandbox.Layout), Is.False);
        Assert.That(NotebookGraphMarker.Moved(new Layout(sandbox.Layout.Root) with { }), Is.False);
        File.WriteAllText(NotebookGraphMarker.FileOf(sandbox.Layout), "C:\\elsewhere");
        Assert.That(NotebookGraphMarker.Moved(sandbox.Layout), Is.True);
    }
}
