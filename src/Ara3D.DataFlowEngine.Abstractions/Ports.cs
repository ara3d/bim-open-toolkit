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

public readonly record struct PortSpec(string Name, PortType Type);

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
