using Ara3D.BimOpenSchema.IO;

namespace Ara3D.Ids;

/// <summary>A parameter row of <c>ParameterText</c>, with its IFC data type when the database has
/// an <see cref="IfcDataTypes"/> table. A null value, or an empty string, is absent: IDS treats
/// both as "not provided", and BOS stores an IFC <c>$</c> property value as an empty string.</summary>
internal sealed record BosValue(string Group, string Name, string ValueType, string Value, string? DataType)
{
    public bool IsPresent
        => Value.Length > 0;

    public bool IsNumeric
        => ValueType is "Number" or "Int";
}

/// <summary>An entity with its parameters. BOS stores IFC property-set values under the set's
/// name and IFC attributes as parameters named <c>Ifc:{attribute}</c> grouped under the entity's
/// class; GlobalId and Name live on the entity itself.</summary>
internal sealed record BosEntity(
    long EntityIndex,
    string GlobalId,
    string Name,
    string Category,
    bool HasType,
    IReadOnlyList<BosValue> Values)
{
    private static readonly string AttributePrefix = IfcToBosConverter.ToIfcStdPropName("");

    public bool IsAttribute(BosValue value)
        => value.Group == Category && value.Name.StartsWith(AttributePrefix, StringComparison.Ordinal);

    public IEnumerable<BosValue> Properties
        => Values.Where(v => !IsAttribute(v));

    /// <summary>Every attribute BOS carries for the entity, keyed by the IFC attribute name.</summary>
    public IEnumerable<(string Name, BosValue Value)> Attributes
        => Values.Where(IsAttribute)
            .Select(v => (v.Name[AttributePrefix.Length..], v))
            .Prepend(("Name", new BosValue(Category, "Name", "String", Name, "IFCLABEL")))
            .Prepend(("GlobalId", new BosValue(Category, "GlobalId", "String", GlobalId, "IFCGLOBALLYUNIQUEID")));

    public BosValue? Attribute(string name)
        => Attributes.FirstOrDefault(a => a.Name == name).Value;
}
