namespace BimOpen.Launcher;

public enum Status
{
    Ok,
    Warn,
    Fail,
}

/// <summary>The outcome of one check: what was looked at, what was found, and, when it is not fine, what to do.</summary>
public sealed record Finding(string Subject, Status Status, string Message, string? Fix = null)
{
    public static Finding Ok(string subject, string message)
        => new(subject, Status.Ok, message);

    public static Finding Warn(string subject, string message, string fix)
        => new(subject, Status.Warn, message, fix);

    public static Finding Fail(string subject, string message, string fix)
        => new(subject, Status.Fail, message, fix);
}

public static class Findings
{
    public static string Mark(this Status status)
        => status switch
        {
            Status.Ok => "[ ok ]",
            Status.Warn => "[warn]",
            _ => "[FAIL]",
        };

    /// <summary>The message line, then the fix beneath it when there is one.</summary>
    public static void Print(this ITerminal terminal, Finding finding)
    {
        terminal.Line($"  {finding.Status.Mark()} {finding.Subject}: {finding.Message}");
        if (finding.Fix is { } fix)
            foreach (var line in fix.Split('\n'))
                terminal.Line($"         {line}");
    }

    /// <summary>The last finding for each subject: a check that failed and then passed after the user fixed it is not a problem.</summary>
    public static IReadOnlyList<Finding> Latest(this IEnumerable<Finding> findings)
        => [.. findings.GroupBy(f => f.Subject).Select(g => g.Last())];

    public static bool AnyFailed(this IEnumerable<Finding> findings)
        => findings.Any(f => f.Status == Status.Fail);

    public static string Text(this IEnumerable<Finding> findings)
        => string.Join(Environment.NewLine, findings.Select(f => $"{f.Status.Mark()} {f.Subject}: {f.Message}"
            + (f.Fix is null ? "" : $" Fix: {f.Fix.ReplaceLineEndings(" ")}")));
}
