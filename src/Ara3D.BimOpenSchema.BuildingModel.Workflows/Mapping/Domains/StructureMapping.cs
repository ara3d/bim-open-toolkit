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
                DiagnoseGenericVolume(k, e);
                b.Add(new StructuralMember(k.Key<StructuralMember>(e), element, MemberRole(k, e), k.Product(e),
                    Material(k, e, "Material", "Structural Material", "Rvt:FamilyInstance:StructuralMaterial"),
                    MappingKernel.Unknown<string>(), MappingKernel.Unknown<string>(), element.Location.PrimaryStorey,
                    MappingKernel.Unknown<SnapshotKey<GeometryRepresentation>>(),
                    k.Number(e, "CutLength", "m", x => new Length(x), false, "Cut Length"),
                    k.Number(e, "CenterlineLength", "m", x => new Length(x), false, "Length"),
                    MappingKernel.Unknown<Volume>(), MappingKernel.Unknown<Mass>(), MappingKernel.Unknown<string>(),
                    LinkSet<StructuralConnection>.Unknown()));
                break;
            case "Foundation":
                DiagnoseGenericVolume(k, e);
                b.Add(new Foundation(k.Key<Foundation>(e), element, FoundationRoleFact(k, e),
                    Material(k, e, "Material", "Structural Material", "Rvt:FamilyInstance:StructuralMaterial"), MappingKernel.Unknown<string>(),
                    k.Number(e, "Length", "m", x => new Length(x), false, "Length"),
                    k.Number(e, "Width", "m", x => new Length(x), false, "Width"),
                    k.Number(e, "Depth", "m", x => new Length(x), false, "Foundation Thickness"),
                    MappingKernel.Unknown<Volume>(), MappingKernel.Unknown<Pressure>(),
                    LinkSet<StructuralMember>.Unknown(), LinkSet<ReinforcementGroup>.Unknown()));
                break;
            case "StructuralConnection":
                b.Add(new StructuralConnection(k.Key<StructuralConnection>(e), element, k.Product(e),
                    MappingKernel.Unknown<string>(), MappingKernel.Unknown<SnapshotKey<StructuralMember>>(),
                    LinkSet<StructuralMember>.Unknown(), MappingKernel.Unknown<ReferenceKey<BimObject>>(),
                    MappingKernel.Unknown<string>(), MappingKernel.Unknown<int>(), MappingKernel.Unknown<string>(),
                    MappingKernel.Unknown<Length>(), MappingKernel.Unknown<string>()));
                break;
            case "ReinforcementGroup":
                b.Add(new ReinforcementGroup(k.Key<ReinforcementGroup>(e), element, MappingKernel.Unknown<ReferenceKey<BimObject>>(),
                    MappingKernel.Unknown<string>(), Material(k, e, "Material", "Material"), MappingKernel.Unknown<string>(),
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

    // A generic Volume parameter carries no stated net/gross deduction basis; CoreMapping's roof/space handling
    // leaves the typed net quantity unavailable and records the retained value as a diagnostic instead of guessing.
    private static void DiagnoseGenericVolume(MappingKernel k, EntityRow e)
    {
        if (k.Rows(e).Any(p => TextNormalization.Key(p.Name) == "VOLUME"))
            k.Diagnose("quantity.unspecified-basis", e, "NetVolume", "Generic Volume is retained in the source cache; its net/gross deduction basis is not established by its name.");
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

    // Mirrors how MappingKernel.Reference<T> treats a wrong target, but yields the global Material key the Definitions
    // domain (track H) assigns its own Material rows, since Material is a non-element record keyed by identity.
    private static Fact<ReferenceKey<Material>> Material(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Resolve<ReferenceKey<Material>>(e, field, k.Select(e, ParameterType.Entity, aliases), p => p.ReferenceEntityId is { } id && k.Kind(id) == "Material"
            ? new Fact<ReferenceKey<Material>>.Known(new(k.Identity(id).Value), Assurance.Observed, [])
            : new Fact<ReferenceKey<Material>>.Missing(Availability.Invalid, "Source reference target is outside the expected typed occurrence table.", []));
}
