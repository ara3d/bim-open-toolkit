namespace BimOpenMcp.Ifc.Ask;

/// <summary>The command line, parsed. Every failure is an <see cref="ArgumentException"/> carrying
/// a sentence a user can act on, so Program has nothing to decide.</summary>
public sealed record IfcAskOptions(
    string ModelPath,
    IReadOnlyList<string> Questions,
    string? TranscriptPath = null,
    string? ResultsPath = null,
    int MaxTurns = IfcAskRunner.DefaultMaxTurns)
{
    public const string Usage =
        "bimopenmcp-ifc-ask --model <path.ifc> [--questions <file> | \"question\" ...] "
        + "[--out <transcript.md>] [--results <results.json>] [--turns <n>]";

    public static IfcAskOptions Parse(IReadOnlyList<string> args)
    {
        string? model = null, outPath = null, resultsPath = null, questionFile = null;
        var turns = IfcAskRunner.DefaultMaxTurns;
        var questions = new List<string>();
        for (var i = 0; i < args.Count; i++)
        {
            var arg = args[i];
            switch (arg)
            {
                case "--model": model = Value(args, ref i); break;
                case "--questions": questionFile = Value(args, ref i); break;
                case "--out": outPath = Value(args, ref i); break;
                case "--results": resultsPath = Value(args, ref i); break;
                case "--turns":
                    var text = Value(args, ref i);
                    turns = int.TryParse(text, out var n) && n > 0
                        ? n
                        : throw new ArgumentException($"--turns needs a positive whole number, not '{text}'.");
                    break;
                default:
                    if (arg.StartsWith("--", StringComparison.Ordinal))
                        throw new ArgumentException($"Unknown option '{arg}'.\n{Usage}");
                    questions.Add(arg);
                    break;
            }
        }
        if (string.IsNullOrWhiteSpace(model))
            throw new ArgumentException($"--model is required.\n{Usage}");
        if (questionFile is not null)
            questions.AddRange(ReadQuestions(questionFile));
        if (questions.Count == 0)
            throw new ArgumentException($"No questions: give --questions <file> or one or more questions.\n{Usage}");
        return new IfcAskOptions(Path.GetFullPath(model), questions, outPath, resultsPath, turns);
    }

    /// <summary>One question per line. Blank lines and lines starting with '#' are skipped, so a
    /// question file can carry headings and comments.</summary>
    public static IReadOnlyList<string> ReadQuestions(string path)
        => File.Exists(path)
            ? File.ReadAllLines(path).Select(l => l.Trim())
                .Where(l => l.Length > 0 && !l.StartsWith('#'))
                .ToList()
            : throw new ArgumentException($"Question file not found: {path}");

    private static string Value(IReadOnlyList<string> args, ref int i)
        => ++i < args.Count ? args[i] : throw new ArgumentException($"{args[i - 1]} needs a value.\n{Usage}");
}
