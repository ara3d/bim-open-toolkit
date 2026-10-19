namespace BimOpen.Launcher;

/// <summary>What the wizard says and asks; a fake stands in for the console in tests.</summary>
public interface ITerminal
{
    void Line(string text = "");

    /// <summary>The user's answer to a prompt; null when input has ended.</summary>
    string? Read(string prompt);
}

public sealed class ConsoleTerminal : ITerminal
{
    public void Line(string text = "")
        => Console.WriteLine(text);

    public string? Read(string prompt)
    {
        Console.Write(prompt);
        return Console.ReadLine();
    }
}

public static class TerminalExtensions
{
    /// <summary>A yes/no question; an empty answer, or none, takes the default.</summary>
    public static bool Confirm(this ITerminal terminal, string question, bool defaultYes = true)
        => terminal.Read($"{question} [{(defaultYes ? "Y/n" : "y/N")}] ") is { } answer && answer.Trim().Length > 0
            ? answer.Trim().StartsWith('y') || answer.Trim().StartsWith('Y')
            : defaultYes;

    /// <summary>A free-text question; an empty answer, or none, takes the default.</summary>
    public static string Ask(this ITerminal terminal, string question, string defaultValue)
        => terminal.Read($"{question} [{defaultValue}] ") is { } answer && answer.Trim().Length > 0
            ? answer.Trim().Trim('"')
            : defaultValue;
}
