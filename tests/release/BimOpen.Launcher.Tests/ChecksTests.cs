using System.Runtime.InteropServices;

namespace BimOpen.Launcher.Tests;

[TestFixture]
public sealed class ChecksTests
{
    private static OsInfo Os(int build, Architecture arch = Architecture.X64, bool windows = true)
        => new(windows, new Version(10, 0, build), arch);

    [TestCase(26200, "Windows 11")]
    [TestCase(22000, "Windows 11")]
    [TestCase(19045, "Windows 10")]
    [TestCase(10240, "Windows 10")]
    public void Windows_NamesTheVersion(int build, string name)
    {
        var finding = SystemChecks.Windows(Os(build));
        Assert.That(finding.Status, Is.EqualTo(Status.Ok));
        Assert.That(finding.Message, Does.StartWith(name));
    }

    [Test]
    public void Windows_RefusesOldBuildsOtherSystemsAndArmWithAFix()
    {
        foreach (var os in new[] { Os(9600), Os(26200, Architecture.Arm64), Os(26200, windows: false) })
        {
            var finding = SystemChecks.Windows(os);
            Assert.That(finding.Status, Is.EqualTo(Status.Fail));
            Assert.That(finding.Fix, Is.Not.Empty);
        }
    }

    [Test]
    public void DiskSpace_FailsBelowTheWantedAmount()
    {
        Assert.That(SystemChecks.DiskSpace("C:\\x", SystemChecks.WantedFreeBytes).Status, Is.EqualTo(Status.Ok));
        var low = SystemChecks.DiskSpace("C:\\x", 100L << 20);
        Assert.That(low.Status, Is.EqualTo(Status.Fail));
        Assert.That(low.Message, Does.Contain("100 MB"));
    }

    [Test]
    public void InstallLocation_ReadOnlyFolderWarnsAndNamesTheFallback()
    {
        var layout = new Layout("C:\\Program Files\\BimOpen");
        Assert.That(SystemChecks.InstallLocation(layout, _ => true, "X").Status, Is.EqualTo(Status.Ok));
        var finding = SystemChecks.InstallLocation(layout, _ => false, "C:\\Users\\a\\AppData\\Local\\BimOpenToolkit");
        Assert.That(finding.Status, Is.EqualTo(Status.Warn));
        Assert.That(finding.Fix, Does.Contain("AppData\\Local\\BimOpenToolkit"));
    }

    [Test]
    public void IsWritable_TrueForATempFolderFalseForAMissingOne()
    {
        using var sandbox = new Sandbox();
        Assert.That(SystemChecks.IsWritable(sandbox.Folder), Is.True);
        Assert.That(SystemChecks.IsWritable(Path.Combine(sandbox.Folder, "missing")), Is.False);
    }

    [Test]
    public void FallbackFolder_IsUnderLocalAppData()
        => Assert.That(SystemChecks.FallbackFolder(n => n == "LOCALAPPDATA" ? "C:\\L" : null), Is.EqualTo("C:\\L\\BimOpenToolkit"));

    [Test]
    public void ClaudeFinder_PrefersPathThenKnownFolders()
    {
        string? Env(string name) => name switch
        {
            "PATH" => "C:\\first;C:\\second",
            "USERPROFILE" => "C:\\u",
            _ => null,
        };
        Assert.That(ClaudeFinder.Find(Env, p => p == "C:\\second\\claude.cmd"), Is.EqualTo("C:\\second\\claude.cmd"));
        Assert.That(ClaudeFinder.Find(Env, p => p == "C:\\u\\.local\\bin\\claude.exe"), Is.EqualTo("C:\\u\\.local\\bin\\claude.exe"));
        Assert.That(ClaudeFinder.Find(Env, _ => false), Is.Null);
    }

    [Test]
    public void ClaudeInstalled_MissingGivesTheDocumentedInstallCommand()
    {
        var finding = ClaudeSteps.Installed(null);
        Assert.That(finding.Status, Is.EqualTo(Status.Fail));
        Assert.That(finding.Fix, Does.Contain(ClaudeFinder.InstallCommand).And.Contain(ClaudeFinder.InstallPage));
    }

    [Test]
    public void ParseAuth_ReadsSignedInAndNotSignedIn()
    {
        Assert.That(ClaudeCli.ParseAuth(new(0, """{"loggedIn": true, "authMethod": "claude.ai"}""", "")), Is.EqualTo(new ClaudeAuth(true, "claude.ai")));
        Assert.That(ClaudeCli.ParseAuth(new(1, """{"loggedIn": false}""", "")), Is.EqualTo(new ClaudeAuth(false, null)));
        Assert.That(ClaudeCli.ParseAuth(new(1, "Anthropic base URL: x\nNot logged in. Run claude auth login to authenticate.", "")),
            Is.EqualTo(new ClaudeAuth(false, null)));
        Assert.That(ClaudeCli.ParseAuth(new(0, "garbage", "")), Is.Null);
    }

    [Test]
    public void SignedIn_NotSignedInSaysHowToSignIn()
    {
        using var sandbox = new Sandbox();
        var finding = ClaudeSteps.SignedIn(new ClaudeCli("claude", new FakeClaude(sandbox.UserConfig, signedIn: false)));
        Assert.That(finding.Status, Is.EqualTo(Status.Fail));
        Assert.That(finding.Fix, Does.Contain("claude auth login"));
    }

    [Test]
    public void Settings_SaveAndLoadRoundTripAndFallBackWhenDamaged()
    {
        using var sandbox = new Sandbox();
        var file = Path.Combine(sandbox.Folder, "bimopen.json");
        new Settings("D:\\models").Save(file);
        Assert.That(Settings.Load(file).ModelsFolder, Is.EqualTo("D:\\models"));
        File.WriteAllText(file, "{ not json");
        Assert.That(Settings.Load(file).ModelsFolder, Is.Null);
    }

    [Test]
    public void Settings_ModelFolders_PutTheChosenFolderBeforeTheNrcFiles()
    {
        var layout = new Layout("C:\\r");
        Assert.That(new Settings().ModelsArgument(layout), Is.EqualTo("C:\\r\\samples\\public;C:\\r\\samples\\nrc"));
        Assert.That(new Settings("D:\\m").ModelsArgument(layout), Is.EqualTo("D:\\m;C:\\r\\samples\\nrc"));
    }

    [Test]
    public void HostArguments_NameTheBimProfileTheWebFolderAndThePort()
    {
        var layout = new Layout("C:\\r");
        var arguments = HostArguments.For(layout, new Settings(), 5555, "S", "C");
        Assert.That(arguments, Is.EqualTo(new[]
        {
            "--profile", "bim", "--port", "5555", "--web", "C:\\r\\web", "--store", "S", "--cache", "C",
            "--models", "C:\\r\\samples\\public;C:\\r\\samples\\nrc",
        }));
        Assert.That(HostArguments.Url(5555, "nrc.html"), Is.EqualTo("http://127.0.0.1:5555/nrc.html"));
    }

    [Test]
    public void HostProcess_QuotesArgumentsWithSpacesOrSemicolons()
    {
        Assert.That(HostProcess.Quote("C:\\a b"), Is.EqualTo("\"C:\\a b\""));
        Assert.That(HostProcess.Quote("a;b"), Is.EqualTo("\"a;b\""));
        Assert.That(HostProcess.Quote("plain"), Is.EqualTo("plain"));
    }

    [Test]
    public void McpStdioClient_TextOf_JoinsTextPartsAndThrowsOnErrors()
    {
        var ok = System.Text.Json.JsonDocument.Parse("""{"result":{"content":[{"type":"text","text":"a"},{"type":"text","text":"b"}]}}""").RootElement;
        Assert.That(McpStdioClient.TextOf(ok), Is.EqualTo("a\nb"));
        var error = System.Text.Json.JsonDocument.Parse("""{"error":{"code":-1,"message":"no"}}""").RootElement;
        Assert.That(() => McpStdioClient.TextOf(error), Throws.InvalidOperationException);
    }

    [Test]
    public void ReleaseCopy_CopiesFilesButNotStateAndSkipsFilesAlreadyThere()
    {
        using var sandbox = new Sandbox();
        var from = Path.Combine(sandbox.Folder, "from");
        var to = Path.Combine(sandbox.Folder, "to");
        Sandbox.Touch(Path.Combine(from, "bin", "a.dll"));
        Sandbox.Touch(Path.Combine(from, "state", "store", "g.json"));
        Assert.That(ReleaseCopy.Copy(from, to), Is.EqualTo(1));
        Assert.That(File.Exists(Path.Combine(to, "bin", "a.dll")), Is.True);
        Assert.That(Directory.Exists(Path.Combine(to, "state")), Is.False);
        Assert.That(ReleaseCopy.Copy(from, to), Is.EqualTo(0));
    }
}
