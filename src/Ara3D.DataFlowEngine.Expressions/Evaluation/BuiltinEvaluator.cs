using Ara3D.DataFlowEngine.Expressions.Typing;

namespace Ara3D.DataFlowEngine.Expressions.Evaluation;

internal static class BuiltinEvaluator
{
    public static Scalar? EvalCall(TypedCall call, Func<string, Scalar?> lookup)
    {
        if (call.Builtin == Builtin.Coalesce)
        {
            foreach (var arg in call.Args)
            {
                var value = arg.Eval(lookup);
                if (value != null)
                    return value;
            }
            return null;
        }
        var args = new Scalar[call.Args.Count];
        for (var i = 0; i < call.Args.Count; i++)
        {
            var value = call.Args[i].Eval(lookup);
            if (value == null)
                return null;
            args[i] = value;
        }
        return call.Builtin switch
        {
            Builtin.Abs => Abs(args[0]),
            Builtin.Min => MinMax(call, args, min: true),
            Builtin.Max => MinMax(call, args, min: false),
            Builtin.Round => Round(args),
            Builtin.Floor => new NumberScalar(Math.Floor(args[0].AsDouble())),
            Builtin.Ceil => new NumberScalar(Math.Ceiling(args[0].AsDouble())),
            Builtin.Len => new IntegerScalar(ScalarOps.CodePointCount(args[0].AsText())),
            Builtin.Lower => new TextScalar(args[0].AsText().ToLowerInvariant()),
            Builtin.Upper => new TextScalar(args[0].AsText().ToUpperInvariant()),
            Builtin.Contains => new BooleanScalar(args[0].AsText().Contains(args[1].AsText(), StringComparison.Ordinal)),
            Builtin.StartsWith => new BooleanScalar(args[0].AsText().StartsWith(args[1].AsText(), StringComparison.Ordinal)),
            Builtin.EndsWith => new BooleanScalar(args[0].AsText().EndsWith(args[1].AsText(), StringComparison.Ordinal)),
            _ => throw new EvaluationException($"Unknown builtin {call.Builtin}"),
        };
    }

    private static Scalar Abs(Scalar value)
        => value is IntegerScalar i
            ? i.Value == long.MinValue
                ? throw new EvaluationException("Integer overflow in 'abs'")
                : new IntegerScalar(Math.Abs(i.Value))
            : new NumberScalar(Math.Abs(value.AsDouble()));

    private static Scalar MinMax(TypedCall call, Scalar[] args, bool min)
    {
        if (call.Type == ScalarType.Integer)
        {
            var result = args[0].AsLong();
            for (var i = 1; i < args.Length; i++)
                result = min ? Math.Min(result, args[i].AsLong()) : Math.Max(result, args[i].AsLong());
            return new IntegerScalar(result);
        }
        var value = args[0].AsDouble();
        for (var i = 1; i < args.Length; i++)
            value = min ? Math.Min(value, args[i].AsDouble()) : Math.Max(value, args[i].AsDouble());
        return new NumberScalar(value);
    }

    private static Scalar Round(Scalar[] args)
    {
        var value = args[0].AsDouble();
        var digits = args.Length > 1 ? args[1].AsLong() : 0;
        return digits is < 0 or > 15
            ? throw new EvaluationException($"round digits must be between 0 and 15, got {digits}")
            : new NumberScalar(Math.Round(value, (int)digits, MidpointRounding.AwayFromZero));
    }
}
