using System;

namespace Ara3D.DataFlowEngine.Abstractions;

/// <summary>A finite proportion in the inclusive interval [0, 1].</summary>
public readonly record struct Fraction
{
    public double Value { get; }
    public Fraction(double value)
    {
        if (!double.IsFinite(value) || value < 0 || value > 1)
            throw new ArgumentOutOfRangeException(nameof(value), "Fraction must be between 0 and 1.");
        Value = value;
    }
    public Percent ToPercent() => new(Value * 100);
}

/// <summary>A finite percentage in the inclusive interval [0, 100].</summary>
public readonly record struct Percent
{
    public double Value { get; }
    public Percent(double value)
    {
        if (!double.IsFinite(value) || value < 0 || value > 100)
            throw new ArgumentOutOfRangeException(nameof(value), "Percent must be between 0 and 100.");
        Value = value;
    }
    public Fraction ToFraction() => new(Value / 100);
}
