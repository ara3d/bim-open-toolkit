namespace BimOpen.Launcher;

/// <summary>Copies a read-only release to a folder the user can write, leaving the state and settings of the source behind.</summary>
public static class ReleaseCopy
{
    private static readonly string[] Skipped = ["state"];

    public static int Copy(string from, string to)
    {
        var copied = 0;
        foreach (var file in Directory.EnumerateFiles(from, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(from, file);
            if (Skipped.Contains(relative.Split(Path.DirectorySeparatorChar)[0], StringComparer.OrdinalIgnoreCase))
                continue;
            var target = Path.Combine(to, relative);
            if (File.Exists(target) && new FileInfo(target).Length == new FileInfo(file).Length)
                continue;
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Copy(file, target, overwrite: true);
            File.SetAttributes(target, FileAttributes.Normal);
            copied++;
        }
        return copied;
    }
}
