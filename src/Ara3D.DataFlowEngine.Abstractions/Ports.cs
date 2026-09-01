namespace Ara3D.DataFlowEngine.Abstractions;

public enum PortType
{
    Boolean,
    Integer,
    Number,
    Text,
    Table,
    Any,
}

/// <summary>
/// An input or output port. Optional applies to inputs only (spec semantics §2):
/// an unconnected optional input does not make the node unready — the node
/// receives MissingValue.Instance in that position instead.
/// </summary>
public readonly record struct PortSpec(string Name, PortType Type, bool Optional = false);

public static class PortTypeExtensions
{
    public static bool Accepts(this PortType port, ValueKind value)
        => port switch
        {
            PortType.Any => true,
            PortType.Boolean => value == ValueKind.Boolean,
            PortType.Integer => value == ValueKind.Integer,
            PortType.Number => value == ValueKind.Number,
            PortType.Text => value == ValueKind.Text,
            PortType.Table => value == ValueKind.Table,
            _ => false,
        };
}
