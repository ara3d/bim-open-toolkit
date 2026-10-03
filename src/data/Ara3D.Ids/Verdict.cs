namespace Ara3D.Ids;

/// <summary>The verdicts an IDS check produces, named as <c>check.rule</c> names them, so a
/// verdict table from either source reads the same. Declared from least to most severe:
/// combining outcomes keeps the larger.</summary>
public enum Verdict
{
    Pass,
    InfoNotAvailable,
    Fail,
}

/// <summary>One verdict with the reason behind it.</summary>
public readonly record struct Outcome(Verdict Verdict, string Reason)
{
    public static readonly Outcome Pass = new(Verdict.Pass, "");

    public static Outcome Fail(string reason)
        => new(Verdict.Fail, reason);

    public static Outcome Unknown(string reason)
        => new(Verdict.InfoNotAvailable, reason);
}

public static class OutcomeExtensions
{
    /// <summary>The most severe verdict, with the reasons of every outcome at that verdict.</summary>
    public static Outcome Combine(this IReadOnlyList<Outcome> outcomes)
    {
        var worst = outcomes.Count == 0 ? Verdict.Pass : outcomes.Max(o => o.Verdict);
        var reasons = outcomes.Where(o => o.Verdict == worst && o.Reason.Length > 0).Select(o => o.Reason);
        return new(worst, string.Join("; ", reasons));
    }
}
