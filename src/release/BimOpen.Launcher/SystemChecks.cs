using System.Runtime.InteropServices;

namespace BimOpen.Launcher;

public sealed record OsInfo(bool IsWindows, Version Version, Architecture Architecture)
{
    public static OsInfo Current
        => new(OperatingSystem.IsWindows(), Environment.OSVersion.Version, RuntimeInformation.OSArchitecture);
}

/// <summary>Step 1: is this computer one the release runs on.</summary>
public static class SystemChecks
{
    /// <summary>The first Windows 10 build; Windows 11 starts at build 22000.</summary>
    public const int FirstWindows10Build = 10240;

    public const int FirstWindows11Build = 22000;

    public const string InstallFolder = "Install folder";

    /// <summary>Free space wanted: the unpacked release is about 0.5 GB, and converting a large IFC file writes more.</summary>
    public const long WantedFreeBytes = 3L << 30;

    public static Finding Windows(OsInfo os)
        => !os.IsWindows
            ? Finding.Fail("Windows", "This is not Windows.", "The release runs on Windows 10 or 11 (64-bit) only.")
            : os.Architecture != Architecture.X64
                ? Finding.Fail("Windows", $"This is a {os.Architecture} processor.",
                    "The release is built for 64-bit Intel or AMD (x64) processors. Use a computer with one.")
                : os.Version.Build < FirstWindows10Build
                    ? Finding.Fail("Windows", $"Windows build {os.Version.Build} is older than Windows 10.",
                        "Update Windows to Windows 10 or 11, then run setup again.")
                    : Finding.Ok("Windows",
                        $"Windows {(os.Version.Build >= FirstWindows11Build ? "11" : "10")} (build {os.Version.Build}), 64-bit.");

    public static Finding DiskSpace(string folder, long freeBytes)
        => freeBytes >= WantedFreeBytes
            ? Finding.Ok("Disk space", $"{freeBytes >> 30} GB free where {folder} is.")
            : Finding.Fail("Disk space", $"Only {freeBytes >> 20} MB free where {folder} is; about {WantedFreeBytes >> 30} GB is wanted.",
                "Free some space on that drive, or move the folder to a drive with more, then run setup again.");

    public static long FreeBytes(string folder)
        => new DriveInfo(Path.GetPathRoot(Path.GetFullPath(folder))!).AvailableFreeSpace;

    /// <summary>True when a file can be created and deleted in the folder.</summary>
    public static bool IsWritable(string folder)
    {
        try
        {
            var probe = Path.Combine(folder, $".bimopen-write-{Environment.ProcessId}");
            File.WriteAllText(probe, "");
            File.Delete(probe);
            return true;
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    /// <summary>Where the release runs from: its own folder when that is writable (the host writes its
    /// store, caches, and the samples derived files there), else the per-user folder setup copies it to.</summary>
    public static Finding InstallLocation(Layout layout, Func<string, bool> isWritable, string fallback)
        => isWritable(layout.Root)
            ? Finding.Ok(InstallFolder, $"{layout.Root} is writable.")
            : Finding.Warn(InstallFolder, $"{layout.Root} is read-only.",
                $"Setup can copy the release to {fallback} and run from there.");

    /// <summary>The per-user folder a read-only release is copied to.</summary>
    public static string FallbackFolder(Func<string, string?> env)
        => Path.Combine(env("LOCALAPPDATA") ?? Path.GetTempPath(), "BimOpenToolkit");
}
