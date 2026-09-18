namespace BimOpenMcp.Ifc.Ask.Tests;

public sealed class IfcAskOptionsTests
{
    [Test]
    public void PositionalArgumentsAreTheQuestions()
    {
        var options = IfcAskOptions.Parse(["--model", "m.ifc", "how many doors?", "how many storeys?"]);
        Assert.That(options.Questions, Is.EqualTo(new[] { "how many doors?", "how many storeys?" }));
        Assert.That(options.ModelPath, Is.EqualTo(Path.GetFullPath("m.ifc")), "the model path is made absolute");
        Assert.That(options.MaxTurns, Is.EqualTo(IfcAskRunner.DefaultMaxTurns));
        Assert.That((options.TranscriptPath, options.ResultsPath), Is.EqualTo(((string?)null, (string?)null)));
    }

    [Test]
    public void OutputPathsAndTurnLimitAreRead()
    {
        var options = IfcAskOptions.Parse(
            ["--model", "m.ifc", "--out", "t.md", "--results", "r.json", "--turns", "7", "q?"]);
        Assert.That((options.TranscriptPath, options.ResultsPath, options.MaxTurns), Is.EqualTo(("t.md", "r.json", 7)));
    }

    [Test]
    public void AQuestionFileSkipsBlanksAndComments()
    {
        var file = Path.GetTempFileName();
        try
        {
            File.WriteAllText(file, "# NRC questions\n\nhow many doors?\n  how many storeys?  \n\n# end\n");
            var options = IfcAskOptions.Parse(["--model", "m.ifc", "--questions", file]);
            Assert.That(options.Questions, Is.EqualTo(new[] { "how many doors?", "how many storeys?" }));
        }
        finally
        {
            File.Delete(file);
        }
    }

    public static readonly TestCaseData[] BadCommandLines =
    [
        new TestCaseData((object)new[] { "how many doors?" }).SetName("no model"),
        new TestCaseData((object)new[] { "--model", "m.ifc" }).SetName("no questions"),
        new TestCaseData((object)new[] { "--model", "m.ifc", "--turns", "none", "q?" }).SetName("turns is not a number"),
        new TestCaseData((object)new[] { "--model", "m.ifc", "--turns", "0", "q?" }).SetName("turns is zero"),
        new TestCaseData((object)new[] { "--model", "m.ifc", "--verbose", "q?" }).SetName("unknown option"),
        new TestCaseData((object)new[] { "--model" }).SetName("option without a value"),
        new TestCaseData((object)new[] { "--model", "m.ifc", "--questions", "Z:/no/such/file.txt" })
            .SetName("missing question file"),
    ];

    [TestCaseSource(nameof(BadCommandLines))]
    public void BadCommandLinesSayWhatIsWrong(string[] args)
        => Assert.That(Assert.Throws<ArgumentException>(() => IfcAskOptions.Parse(args))!.Message, Is.Not.Empty);
}
