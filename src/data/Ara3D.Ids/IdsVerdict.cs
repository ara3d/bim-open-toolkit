namespace Ara3D.Ids;

/// <summary>One row of an IDS verdict table: one entity against one specification. A row about
/// the model as a whole (a required specification that applies to nothing) has an empty
/// <see cref="GlobalId"/> and an <see cref="EntityIndex"/> of -1.
/// <para><see cref="CheckId"/> is the specification's name, <see cref="CheckTitle"/> its
/// description (or its name when it has none), and <see cref="Citation"/> the requirements as the
/// IDS states them, so the columns line up with <c>check.rule</c>'s.</para></summary>
public sealed record IdsVerdict(
    string GlobalId,
    long EntityIndex,
    string CheckId,
    string CheckTitle,
    string Citation,
    Verdict Verdict,
    string Reason);

/// <summary>The verdict rows of every specification in an IDS, and the warnings raised while
/// evaluating it: facets the evaluator does not support, and information the database lacks.</summary>
public sealed record IdsReport(IReadOnlyList<IdsVerdict> Verdicts, IReadOnlyList<string> Warnings);
