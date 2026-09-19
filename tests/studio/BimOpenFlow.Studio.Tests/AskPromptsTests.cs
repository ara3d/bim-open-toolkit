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
}
