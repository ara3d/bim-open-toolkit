// The web seams live in vitest, beside the code they guard; this test fails if one of those
// files disappears or stops naming what it forbids. The notebook and the 3D pane are
// bim-open-notebook's (deps/bim-open-notebook, repository split, phase 6), which runs these
// vitest files; the toolkit checks only that its pinned copy still keeps them. The notebook's
// layering test keeps the 3D pane out of its embeds; seam.ts, shared by the notebook's and the
// 3D pane's seam tests, keeps both packages free of the toolkit. The generic packages' seam
// (client/test/genericPackages.test.ts) is bim-open-flow's, whose layering test checks it.
namespace BimOpenToolkit.Layering.Tests;

public class WebSeamTests
{
    [TestCase("deps/bim-open-notebook/bimopenflow/web/packages/bim-open-notebook/test/layering.test.ts", "@bim-open-viewer/", "@bimopenflow/pane-3d")]
    [TestCase("deps/bim-open-notebook/bimopenflow/web/packages/pane-3d/test/seam.ts",
        "@bimopenflow\\/app", "studio-web", "nrc-web", "samples/nrc-analyses", "{SNOWDON}", "BIMOPENFLOW_SNOWDON")]
    [TestCase("deps/bim-open-notebook/bimopenflow/web/packages/pane-3d/test/seam.test.ts", "seamOffences", "bim-open-notebook")]
    [TestCase("deps/bim-open-notebook/bimopenflow/web/packages/bim-open-notebook/test/seam.test.ts", "seamOffences")]
    public void WebSeamsAreEnforcedByVitest(string file, params string[] named)
    {
        var path = Path.Combine(Layering.Root.FullName, file);
        Assert.That(File.Exists(path), file);
        var text = File.ReadAllText(path);
        foreach (var name in named) Assert.That(text, Does.Contain(name), $"{file} no longer names {name}");
    }
}
