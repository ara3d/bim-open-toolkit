namespace BimOpen.Launcher;

/// <summary>Step 3, second half: the bim-flow and ifc-ask skills, where Claude Code looks for personal skills.</summary>
public static class Skills
{
    /// <summary>Copies each skill folder into the skills folder; a file that already matches is not rewritten.
    /// Returns the files written.</summary>
    public static int Install(string sources, string target)
    {
        var written = 0;
        if (!Directory.Exists(sources))
            return written;
        foreach (var file in Directory.EnumerateFiles(sources, "*", SearchOption.AllDirectories))
        {
            var to = Path.Combine(target, Path.GetRelativePath(sources, file));
            if (File.Exists(to) && File.ReadAllBytes(to).AsSpan().SequenceEqual(File.ReadAllBytes(file)))
                continue;
            Directory.CreateDirectory(Path.GetDirectoryName(to)!);
            File.Copy(file, to, overwrite: true);
            written++;
        }
        return written;
    }

    /// <summary>The skill folders that are missing a file or hold another version of it.</summary>
    public static IReadOnlyList<string> Stale(string sources, string target)
        => Directory.Exists(sources)
            ? [.. Directory.EnumerateFiles(sources, "*", SearchOption.AllDirectories)
                .Where(file => Path.Combine(target, Path.GetRelativePath(sources, file)) is var to
                    && !(File.Exists(to) && File.ReadAllBytes(to).AsSpan().SequenceEqual(File.ReadAllBytes(file))))
                .Select(file => Path.GetRelativePath(sources, file).Split(Path.DirectorySeparatorChar)[0])
                .Distinct()]
            : [];

    public static Finding Report(int written, string target)
        => written == 0
            ? Finding.Ok("Skills", $"bim-flow and ifc-ask are already in {target}; nothing changed.")
            : Finding.Ok("Skills", $"bim-flow and ifc-ask installed in {target} ({written} files written).");
}
