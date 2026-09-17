using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Structural members, foundations, connections and reinforcement. Wave R5 track C; see WAVE-R5.md.</summary>
public static class StructureMapping
{
    public static readonly DomainMapping Domain = new("Structure",
    [
        new("Structural Framing", "StructuralMember"), new("Structural Columns", "StructuralMember"),
        new("Structural Trusses", "StructuralMember"), new("IFCBEAM", "StructuralMember"), new("IFCCOLUMN", "StructuralMember"),
        new("Structural Foundations", "Foundation"), new("IFCFOOTING", "Foundation"), new("IFCPILE", "Foundation"),
        new("Structural Connections", "StructuralConnection"),
        new("Structural Rebar", "ReinforcementGroup"), new("Structural Area Reinforcement", "ReinforcementGroup"),
        new("Structural Fabric Reinforcement", "ReinforcementGroup"), new("IFCREINFORCINGBAR", "ReinforcementGroup"),
        new("IFCREINFORCINGMESH", "ReinforcementGroup")
    ],
    ["Structural", "Materials and Finishes", "Rebar Set", "Construction"],
    Map);

    private static void Map(MappingKernel k, EntityRow e, string kind, ProjectionBuilder b)
    {
        var element = k.Element(e);
        switch (kind)
        {
            case "StructuralMember":
                k.DiagnoseUnspecifiedQuantity(e, "NetVolume", "Volume");
                b.Add(new StructuralMember(k.Key<StructuralMember>(e), element, MemberRole(k, e), k.Product(e),
                    k.Global<Material>(e, "Material", "Structural Material", "Rvt:FamilyInstance:StructuralMaterial"),
                    MappingKernel.Unknown<string>(), MappingKernel.Unknown<string>(), element.Location.PrimaryStorey,
                    MappingKernel.Unknown<SnapshotKey<GeometryRepresentation>>(),
                    k.Number(e, "CutLength", "m", x => new Length(x), false, "Cut Length"),
                    k.Number(e, "CenterlineLength", "m", x => new Length(x), false, "Length"),
                    MappingKernel.Unknown<Volume>(), MappingKernel.Unknown<Mass>(), MappingKernel.Unknown<string>(),
                    LinkSet<StructuralConnection>.Unknown()));
                break;
            case "Foundation":
                k.DiagnoseUnspecifiedQuantity(e, "NetVolume", "Volume");
                b.Add(new Foundation(k.Key<Foundation>(e), element, FoundationRoleFact(k, e),
                    k.Global<Material>(e, "Material", "Structural Material", "Rvt:FamilyInstance:StructuralMaterial"), MappingKernel.Unknown<string>(),
                    k.Number(e, "Length", "m", x => new Length(x), false, "Length"),
                    k.Number(e, "Width", "m", x => new Length(x), false, "Width"),
                    k.Number(e, "Depth", "m", x => new Length(x), false, "Foundation Thickness"),
                    MappingKernel.Unknown<Volume>(), MappingKernel.Unknown<Pressure>(),
                    LinkSet<StructuralMember>.Unknown(), LinkSet<ReinforcementGroup>.Unknown()));
                break;
            case "StructuralConnection":
                b.Add(new StructuralConnection(k.Key<StructuralConnection>(e), element,
                    Product: k.Product(e),
                    ConnectionRole: MappingKernel.Unknown<string>(),
                    PrimaryMember: MappingKernel.Unknown<SnapshotKey<StructuralMember>>(),
                    ConnectedMembers: LinkSet<StructuralMember>.Unknown(),
                    OtherHost: MappingKernel.Unknown<ReferenceKey<BimObject>>(),
                    DetailReference: MappingKernel.Unknown<string>(),
                    BoltCount: MappingKernel.Unknown<int>(),
                    BoltDesignation: MappingKernel.Unknown<string>(),
                    WeldLength: MappingKernel.Unknown<Length>(),
                    InstallationMethod: MappingKernel.Unknown<string>()));
                break;
            case "ReinforcementGroup":
                b.Add(new ReinforcementGroup(k.Key<ReinforcementGroup>(e), element, MappingKernel.Unknown<ReferenceKey<BimObject>>(),
                    MappingKernel.Unknown<string>(), k.Global<Material>(e, "Material", "Material"), MappingKernel.Unknown<string>(),
                    k.Number(e, "Diameter", "m", x => new Length(x), false, "Bar Diameter"),
                    k.Integer(e, "BarCount", "Quantity"), k.Text(e, "ShapeCode", "Shape"),
                    MappingKernel.Unknown<Length>(),
                    k.Number(e, "TotalLength", "m", x => new Length(x), false, "Total Bar Length"),
                    MappingKernel.Unknown<Mass>(),
                    k.Number(e, "Spacing", "m", x => new Length(x), false, "Spacing"),
                    MappingKernel.Unknown<Length>()));
                break;
        }
    }

    private static Fact<StructuralMemberRole> MemberRole(MappingKernel k, EntityRow e)
    {
        var role = TextNormalization.Key(e.Category) switch
        {
            "STRUCTURAL FRAMING" or "IFCBEAM" => FromCategory(StructuralMemberRole.Beam, k, e),
            "STRUCTURAL COLUMNS" or "IFCCOLUMN" => FromCategory(StructuralMemberRole.Column, k, e),
            _ => MappingKernel.Unknown<StructuralMemberRole>()
        };
        k.Count(e, "Role", role);
        return role;
    }

    private static Fact<FoundationRole> FoundationRoleFact(MappingKernel k, EntityRow e)
    {
        var role = TextNormalization.Key(e.Category) == "IFCPILE" ? FromCategory(FoundationRole.Pile, k, e) : MappingKernel.Unknown<FoundationRole>();
        k.Count(e, "Role", role);
        return role;
    }

    // The category itself, not a lookup, establishes the value; identity evidence supports it instead of a property row.
    private static Fact<T> FromCategory<T>(T value, MappingKernel k, EntityRow e)
        => new Fact<T>.Known(value, Assurance.Derived, [k.IdentityEvidence(e.Id)]);

}
