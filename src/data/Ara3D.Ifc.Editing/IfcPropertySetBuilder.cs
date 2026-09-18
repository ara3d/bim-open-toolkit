namespace Ara3D.Ifc.Tests;

/// <summary>
/// Builds the STEP lines that attach a named property set to an existing element:
/// N IfcPropertySingleValue lines, one IfcPropertySet, and one IfcRelDefinesByProperties.
/// Ids are allocated sequentially from <see cref="NextId"/>; GlobalIds are deterministic hashes
/// of a caller-supplied key so repeated runs produce identical bytes.
/// </summary>
public sealed class IfcPropertySetBuilder
{
    public readonly int OwnerHistoryId;

    private readonly IfcStepLines _out;

    public IfcPropertySetBuilder(int firstNewId, int ownerHistoryId)
    {
        _out = new IfcStepLines(firstNewId);
        OwnerHistoryId = ownerHistoryId;
    }

    public int NextId
    {
        get => _out.NextId;
        set => _out.NextId = value;
    }

    public IReadOnlyList<string> Lines
        => _out.Lines;

    /// <summary>Every id allocated so far, in emission order.</summary>
    public IReadOnlyList<int> Ids
        => _out.Ids;

    public void AddPropertySet(int elementId, string psetName, IReadOnlyList<IfcPropertyValue> props, string guidKey)
    {
        var propIds = new int[props.Count];
        for (var i = 0; i < props.Count; i++)
            propIds[i] = _out.Emit("IFCPROPERTYSINGLEVALUE",
                $"{IfcStepText.String(props[i].Name)},$,{props[i].NominalValue},$");

        var psetId = _out.Emit("IFCPROPERTYSET",
            $"{IfcStepLines.GuidLiteral(guidKey + ":pset")},#{OwnerHistoryId},{IfcStepText.String(psetName)},$,{IfcStepText.IdList(propIds)}");

        _out.Emit("IFCRELDEFINESBYPROPERTIES",
            $"{IfcStepLines.GuidLiteral(guidKey + ":rel")},#{OwnerHistoryId},$,$,(#{elementId}),#{psetId}");
    }
}
