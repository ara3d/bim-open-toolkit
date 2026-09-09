namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Panels, circuits, lighting, devices, cables and containment. Wave R5 track G; see WAVE-R5.md.</summary>
public static class ElectricalMapping
{
    public static readonly DomainMapping Domain = new("Electrical", [], [], (kernel, entity, kind, builder) => { });
}
