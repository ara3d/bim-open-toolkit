namespace PlatoFlow.Host;

/// <summary>Locates the PoC tree from wherever the exe happens to run. The marker is CONTRACTS.md
/// at the root of <c>the platoflow directory</c>, so <c>dotnet run</c>, a published exe and a test
/// runner all find the same <c>data/</c>.</summary>
public static class PocPaths
{
    public const string RootEnvVar = "PLATOFLOW_POC_ROOT";

    public static string FindRoot()
    {
        var fromEnv = Environment.GetEnvironmentVariable(RootEnvVar);
        if (!string.IsNullOrWhiteSpace(fromEnv) && File.Exists(Path.Combine(fromEnv, "CONTRACTS.md")))
            return Path.GetFullPath(fromEnv);

        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 10 && dir != null; i++, dir = dir.Parent)
            if (File.Exists(Path.Combine(dir.FullName, "CONTRACTS.md")))
                return dir.FullName;

        throw new DirectoryNotFoundException(
            $"Could not find the PoC root (a folder containing CONTRACTS.md) above {AppContext.BaseDirectory}. "
            + $"Set {RootEnvVar} to the platoflow directory.");
    }

    /// <summary>Source data outside the platoflow tree. Duplex/carbon come from the toolkit's
    /// repo-root <c>data/</c> (populated by <c>data/get-test-data.ps1</c>); the Snowdon models and
    /// rac_basic are optional extras resolved via <c>PLATOFLOW_EXTRA_DATA</c> if set.
    /// Missing files are reported, never fatal.</summary>
    public static class Source
    {
        private static string RepoData => Path.GetFullPath(Path.Combine(FindRoot(), "..", "data"));
        private static string Extra(string name)
            => Path.Combine(Environment.GetEnvironmentVariable("PLATOFLOW_EXTRA_DATA") ?? RepoData, name);

        public static string DuplexIfc => Path.Combine(RepoData, "duplex.ifc");
        public static string CarbonCsv => Path.Combine(RepoData, "analytics_dataset_with_levels.csv");
        public static string RacBasicBos => Extra("rac_basic_sample_project-2025.bos");
        public static string SnowdonIfc => Extra("Snowdon Towers Sample Architectural.ifc");
        public static string SnowdonHvacIfc => Extra("Snowdon Towers Sample HVAC.ifc");
        public static string SnowdonStructIfc => Extra("Snowdon Towers Sample Structural.ifc");
    }
}
