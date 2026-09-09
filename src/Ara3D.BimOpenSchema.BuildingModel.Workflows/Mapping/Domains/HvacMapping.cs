namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Ducts, fittings, air terminals, dampers, air handling units, fans and HVAC systems. Wave R5 track E; see WAVE-R5.md.</summary>
public static class HvacMapping
{
    public static readonly DomainMapping Domain = new("Hvac", [], [], (kernel, entity, kind, builder) => { });
}
