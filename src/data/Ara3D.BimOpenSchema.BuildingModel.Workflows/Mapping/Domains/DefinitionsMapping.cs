using System.Collections.Immutable;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Materials, product definitions and assembly definitions. Wave R5 track H; see WAVE-R5.md.
/// Materials map from Materials/IFCMATERIAL occurrences during Map; product and assembly definitions run last in
/// Complete, covering every type another domain referenced through the kernel's Product or Assembly.</summary>
public static class DefinitionsMapping
{
    public static readonly DomainMapping Domain = new("Definitions",
        [new("Materials", "Material"), new("IFCMATERIAL", "Material")],
        ["Materials and Finishes"], Map, Complete);

    private static readonly ImmutableHashSet<string> MaterialClassNames = Enum.GetNames<MaterialClass>().ToImmutableHashSet(StringComparer.Ordinal);

    // Only the category names Track A's Envelope domain claims for these kinds; a type outside them stays Other.
    private static readonly ImmutableDictionary<string, AssemblyKind> AssemblyKindByCategory = new Dictionary<string, AssemblyKind>
    {
        ["WALLS"] = AssemblyKind.Wall, ["IFCWALL"] = AssemblyKind.Wall, ["IFCWALLSTANDARDCASE"] = AssemblyKind.Wall, ["IFCCURTAINWALL"] = AssemblyKind.Wall, ["WÄNDE"] = AssemblyKind.Wall,
        ["FLOORS"] = AssemblyKind.Floor, ["IFCSLAB"] = AssemblyKind.Floor, ["GESCHOSSDECKEN"] = AssemblyKind.Floor,
        ["ROOFS"] = AssemblyKind.Roof, ["IFCROOF"] = AssemblyKind.Roof, ["DÄCHER"] = AssemblyKind.Roof,
        ["CEILINGS"] = AssemblyKind.Ceiling, ["DECKEN"] = AssemblyKind.Ceiling,
        ["CURTAIN PANELS"] = AssemblyKind.Facade, ["IFCPLATE"] = AssemblyKind.Facade,
    }.ToImmutableDictionary();

    private static void Map(MappingKernel k, EntityRow e, string kind, ProjectionBuilder b)
    {
        var classText = k.Text(e, "Class", "Class", "Material Class", "Rvt:Material:Class");
        b.Add(new Material(new ReferenceKey<Material>(k.Identity(e.Id).Value), Name(e, "Material " + e.Id), ClassOf(classText),
            k.Text(e, "Grade", "Grade"), MappingKernel.Unknown<MassDensity>(), MappingKernel.Unknown<ThermalConductivity>(),
            MappingKernel.Unknown<SpecificHeatCapacity>(), MappingKernel.Unknown<Ratio>(),
            k.Text(e, "FireReactionClassification", "FireReactionClassification", "Fire Reaction Classification", "Reaction to Fire Classification"),
            [k.IdentityEvidence(e.Id)]));
    }

    private static void Complete(MappingKernel k, ProjectionBuilder b)
    {
        using (k.CountingAs(nameof(ProductDefinition)))
        foreach (var typeId in k.UsedProductTypes.Order())
        {
            var type = k.Entity(typeId);
            b.Add(new ProductDefinition(k.ProductKey(typeId), Name(type, "Type " + typeId), k.Options.ContentFingerprint,
                k.Text(type, "Manufacturer", "Manufacturer"), k.Text(type, "ProductCode", "Type Mark"), k.Text(type, "ModelNumber", "Model"),
                PrincipalMaterial(k, type), MappingKernel.Unknown<ReferenceKey<AssemblyDefinition>>(), Documents(k, type),
                [k.Evidence([k.Source(typeId)], "Product", $"Type entity row {typeId} declares this product.")]));
        }
        using (k.CountingAs(nameof(AssemblyDefinition)))
        foreach (var typeId in k.UsedAssemblyTypes.Order())
        {
            var type = k.Entity(typeId);
            b.Add(new AssemblyDefinition(k.AssemblyKey(typeId), Name(type, "Type " + typeId), k.Options.ContentFingerprint,
                AssemblyKindByCategory.GetValueOrDefault(TextNormalization.Key(type.Category), AssemblyKind.Other),
                "NotObserved", [], Completeness.NotObserved, MappingKernel.Unknown<ThermalTransmittance>(), MappingKernel.Unknown<ThermalResistance>(),
                k.FireResistance(type), MappingKernel.Unknown<string>(),
                [k.Evidence([k.Source(typeId)], "Assembly", $"Type entity row {typeId} declares this assembly.")]));
        }
    }

    private static Fact<ReferenceKey<Material>> PrincipalMaterial(MappingKernel k, EntityRow type)
        => k.Global<Material>(type, "PrincipalMaterial", "Structural Material", "Material");

    // Description/Assembly Code are locators only when their stored text is itself an absolute URI or file path;
    // nothing here is inferred from the field's name.
    private static ImmutableArray<ExternalReference> Documents(MappingKernel k, EntityRow type)
    {
        var candidates = new[] { ("AssemblyCode", k.Text(type, "AssemblyCode", "Assembly Code")), ("Description", k.Text(type, "Description", "Description")) };
        var docs = ImmutableArray.CreateBuilder<ExternalReference>();
        foreach (var (field, fact) in candidates)
            if (fact is Fact<string>.Known known && Uri.TryCreate(known.Value, UriKind.Absolute, out _))
                docs.Add(new("Source", field, k.Options.ContentFingerprint, known.Value));
        return docs.ToImmutable();
    }

    // Only text equal to a MaterialClass member name fixes the class; anything else, "Generic" included, stays
    // Unclassified. Snowdon's plain "Class" descriptor is an Int, so only the "Rvt:Material:Class" alias resolves there.
    private static MaterialClass ClassOf(Fact<string> text)
        => text is Fact<string>.Known known && MaterialClassNames.Contains(known.Value) ? Enum.Parse<MaterialClass>(known.Value) : MaterialClass.Unclassified;

    private static string Name(EntityRow entity, string fallback) => string.IsNullOrWhiteSpace(entity.Name) ? fallback : entity.Name;
}
