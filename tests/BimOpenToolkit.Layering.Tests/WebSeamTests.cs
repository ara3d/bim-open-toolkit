// The notebook's web seam lives in vitest, beside the code it guards; this test fails if that
// file disappears or stops naming what it forbids. The generic packages' seam
// (client/test/genericPackages.test.ts) moved with them to bim-open-flow, whose layering test
// checks it.
namespace BimOpenToolkit.Layering.Tests;

public class WebSeamTests
{
    [TestCase("bimopenflow/web/packages/bim-open-notebook/test/layering.test.ts", "@bim-open-viewer/", "@bimopenflow/pane-3d")]
    public void WebSeamsAreEnforcedByVitest(string file, string viewer, string pane)
    {
        var path = Path.Combine(Layering.Root.FullName, file);
        Assert.That(File.Exists(path), file);
        var text = File.ReadAllText(path);
        Assert.That(text, Does.Contain(viewer).And.Contain(pane));
    }
}
