using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Materials, product definitions and assembly definitions for referenced types. Wave R5 track H; see WAVE-R5.md.
/// Runs last: the definition rows cover every type another domain referenced through the kernel's Product or Assembly.</summary>
public static class DefinitionsMapping
{
    public static readonly DomainMapping Domain = new("Definitions", [], [], (kernel, entity, kind, builder) => { }, Complete);

    private static void Complete(MappingKernel k, ProjectionBuilder b)
    {
        foreach (var typeId in k.UsedProductTypes.Order())
        {
            var type = k.Entity(typeId);
            b.Add(new ProductDefinition(k.ProductKey(typeId), Name(type, typeId), k.Options.ContentFingerprint,
                k.Text(type, "Manufacturer", "Manufacturer"), k.Text(type, "ProductCode", "Type Mark"), k.Text(type, "ModelNumber", "Model"),
                MappingKernel.Unknown<ReferenceKey<Material>>(), MappingKernel.Unknown<ReferenceKey<AssemblyDefinition>>(), [],
                [k.Evidence([k.Source(typeId)], "Product", $"Type entity row {typeId} declares this product.")]));
        }
        foreach (var typeId in k.UsedAssemblyTypes.Order())
        {
            var type = k.Entity(typeId);
            b.Add(new AssemblyDefinition(k.AssemblyKey(typeId), Name(type, typeId), k.Options.ContentFingerprint, AssemblyKind.Other, "NotObserved", [],
                Completeness.NotObserved, MappingKernel.Unknown<ThermalTransmittance>(), MappingKernel.Unknown<ThermalResistance>(),
                k.FireResistance(type), MappingKernel.Unknown<string>(),
                [k.Evidence([k.Source(typeId)], "Assembly", $"Type entity row {typeId} declares this assembly.")]));
        }
    }

    private static string Name(EntityRow type, int typeId) => string.IsNullOrWhiteSpace(type.Name) ? "Type " + typeId : type.Name;
}
