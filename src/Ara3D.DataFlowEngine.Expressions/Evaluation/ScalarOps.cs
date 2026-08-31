namespace Ara3D.DataFlowEngine.Expressions.Evaluation;

public static class ScalarOps
{
    public static double AsDouble(this Scalar scalar)
        => scalar switch
        {
            IntegerScalar i => i.Value,
            NumberScalar n => n.Value,
            _ => throw new EvaluationException($"Expected a numeric value, got {scalar.Type}"),
        };

    public static long AsLong(this Scalar scalar)
        => scalar is IntegerScalar i ? i.Value
            : throw new EvaluationException($"Expected an Integer value, got {scalar.Type}");

    public static bool AsBool(this Scalar scalar)
        => scalar is BooleanScalar b ? b.Value
            : throw new EvaluationException($"Expected a Boolean value, got {scalar.Type}");

    public static string AsText(this Scalar scalar)
        => scalar is TextScalar t ? t.Value
            : throw new EvaluationException($"Expected a Text value, got {scalar.Type}");

    /// <summary>Ordinal comparison by Unicode code point (not UTF-16 code unit).</summary>
    public static int CompareCodePoints(string a, string b)
    {
        int i = 0, j = 0;
        while (i < a.Length && j < b.Length)
        {
            var ca = NextCodePoint(a, ref i);
            var cb = NextCodePoint(b, ref j);
            if (ca != cb)
                return ca < cb ? -1 : 1;
        }
        return (a.Length - i).CompareTo(b.Length - j);
    }

    /// <summary>Count of Unicode code points (surrogate pairs count once).</summary>
    public static int CodePointCount(string text)
    {
        var count = 0;
        for (var i = 0; i < text.Length; i++)
        {
            if (char.IsHighSurrogate(text[i]) && i + 1 < text.Length && char.IsLowSurrogate(text[i + 1]))
                i++;
            count++;
        }
        return count;
    }

    private static int NextCodePoint(string text, ref int i)
    {
        var c = text[i];
        if (char.IsHighSurrogate(c) && i + 1 < text.Length && char.IsLowSurrogate(text[i + 1]))
        {
            var cp = char.ConvertToUtf32(c, text[i + 1]);
            i += 2;
            return cp;
        }
        i++;
        return c;
    }
}
