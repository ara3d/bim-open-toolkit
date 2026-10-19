namespace BimOpen.Launcher;

public enum RegistrationState
{
    Missing,
    Different,
    Current,
}

/// <summary>Step 3: the two MCP servers in Claude Code at user scope.</summary>
public static class Registration
{
    public static RegistrationState StateOf(McpServer wanted, IReadOnlyDictionary<string, McpServer> registered)
        => !registered.TryGetValue(wanted.Name, out var existing)
            ? RegistrationState.Missing
            : existing.SameAs(wanted) ? RegistrationState.Current : RegistrationState.Different;

    /// <summary>What a read-only look finds, for the doctor.</summary>
    public static Finding Inspect(McpServer wanted, IReadOnlyDictionary<string, McpServer> registered)
        => StateOf(wanted, registered) switch
        {
            RegistrationState.Current => Finding.Ok(wanted.Name, "registered in Claude Code, pointing at this release."),
            RegistrationState.Different => Finding.Fail(wanted.Name, "registered in Claude Code, but for another folder or with other options.",
                "Run: bimopen setup"),
            _ => Finding.Fail(wanted.Name, "not registered in Claude Code.", "Run: bimopen setup"),
        };

    /// <summary>Registers one server, replacing a different registration of the same name; one that is already current is left alone,
    /// so running setup twice changes nothing.</summary>
    public static Finding Apply(ClaudeCli claude, McpServer wanted, IReadOnlyDictionary<string, McpServer> registered)
    {
        var state = StateOf(wanted, registered);
        if (state == RegistrationState.Current)
            return Finding.Ok(wanted.Name, "already registered in Claude Code; nothing changed.");
        if (state == RegistrationState.Different)
            claude.Remove(wanted.Name);
        var result = claude.Add(wanted);
        return result.Succeeded
            ? Finding.Ok(wanted.Name, state == RegistrationState.Different ? "registration updated in Claude Code." : "registered in Claude Code.")
            : Finding.Fail(wanted.Name, $"claude mcp add failed: {FirstLine(result)}",
                $"Run it yourself to see the whole message: claude mcp add --scope user {wanted.Name} -- {wanted.Command} {string.Join(' ', wanted.Args)}");
    }

    private static string FirstLine(RunResult result)
        => (result.Error.Length > 0 ? result.Error : result.Output).ReplaceLineEndings("\n").Split('\n')[0].Trim();
}
