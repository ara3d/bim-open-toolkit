namespace BimOpen.Launcher;

/// <summary>Where things are in the release folder. The folder is the one holding bimopen.exe.</summary>
public sealed record Layout(string Root)
{
    public string Bin => Path.Combine(Root, "bin");

    public string Web => Path.Combine(Root, "web");

    public string Samples => Path.Combine(Root, "samples");

    public string Notebooks => Path.Combine(Samples, "notebooks");

    public string NotebookGraphFolder => Path.Combine(Notebooks, "graphs");

    public string SkillSources => Path.Combine(Root, "skills");

    public string StudioExe => Path.Combine(Bin, "bimopenflow-studio.exe");

    public string IfcMcpExe => Path.Combine(Bin, "bimopenmcp-ifc.exe");

    public string State => Path.Combine(Root, "state");

    public string Store => Path.Combine(State, "store");

    public string Cache => Path.Combine(State, "cache");

    public string Logs => Path.Combine(State, "logs");

    public string HostFile => Path.Combine(State, "host.json");

    public string SettingsFile => Path.Combine(Root, "bimopen.json");

    public string SetupLog => Path.Combine(Root, "bimopen-setup.log");

    /// <summary>The model folders used when the user chooses none: the public samples and the NRC Duplex files.</summary>
    public IReadOnlyList<string> DefaultModelFolders
        => [Path.Combine(Samples, "public"), Path.Combine(Samples, "nrc")];

    /// <summary>The page that opens first: the NRC notebooks.</summary>
    public const string StartPage = "nrc.html";

    /// <summary>Files without which nothing runs, relative to the folder.</summary>
    public IReadOnlyList<string> Required
        =>
        [
            Path.Combine("bin", "bimopenflow-studio.exe"),
            Path.Combine("bin", "bimopenmcp-ifc.exe"),
            Path.Combine("web", StartPage),
            Path.Combine("samples", "nrc", "duplex-enriched.ifc"),
        ];

    public static Layout Here()
        => new(Path.GetDirectoryName(Environment.ProcessPath) ?? AppContext.BaseDirectory);
}
