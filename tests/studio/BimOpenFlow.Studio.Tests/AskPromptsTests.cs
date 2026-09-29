namespace BimOpenFlow.Studio.Tests;

/// <summary>The guides the Ask prompt embeds are the .claude/skills/bim-flow files; these
/// tests fail if the resource link breaks or a file loses the passage the agent depends on.</summary>
public sealed class AskPromptsTests
{
    [Test]
    public void SchemaGuideIsEmbedded()
        => Assert.That(AskPrompts.SchemaGuide, Does.Contain("x_reason"));

    [Test]
    public void NodeGuideIsEmbedded()
        => Assert.That(AskPrompts.NodeGuide, Does.Contain("table.derive"));

    [Test]
    public void RulesAreEmbedded()
        => Assert.That(AskPrompts.Rules, Does.Contain("editGraph"));

    // TKT-127: questions about the toolkit are answered from its documents, with no graph.
    [Test]
    public void RulesSayAToolkitQuestionIsAnsweredInTextFromTheDocuments()
        => Assert.That(AskPrompts.Rules, Does.Contain("searchDocs").And.Contain("Build no graph"));

    [Test]
    public void ThePrimerFitsItsLimitAndNamesTheDocsTools()
        => Assert.Multiple(() =>
        {
            Assert.That(System.Text.Encoding.UTF8.GetByteCount(AskPrompts.Primer), Is.LessThanOrEqualTo(AskPrompts.PrimerLimit));
            Assert.That(AskPrompts.Primer, Does.Contain("searchDocs").And.Contain("readDoc"));
        });
}
