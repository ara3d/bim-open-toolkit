using Ara3D.DataTable;

namespace Ara3D.DataFlowEngine.Abstractions;

public enum ValueKind
{
    Boolean,
    Integer,
    Number,
    Text,
    Table,
}

/// <summary>
/// The immutable values that flow along graph edges. Exactly one subtype per ValueKind.
/// </summary>
public abstract record FlowValue
{
    public abstract ValueKind Kind { get; }
}

public sealed record BooleanValue(bool Value) : FlowValue
{
    public override ValueKind Kind => ValueKind.Boolean;
}

public sealed record IntegerValue(long Value) : FlowValue
{
    public override ValueKind Kind => ValueKind.Integer;
}

public sealed record NumberValue(double Value) : FlowValue
{
    public override ValueKind Kind => ValueKind.Number;
}

public sealed record TextValue(string Value) : FlowValue
{
    public override ValueKind Kind => ValueKind.Text;
}

public sealed record TableValue(IDataTable Table) : FlowValue
{
    public override ValueKind Kind => ValueKind.Table;
}
