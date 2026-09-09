namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Stairs, flights, landings, ramps, railings, vertical transport and furniture. Wave R5 track B; see WAVE-R5.md.</summary>
public static class CirculationMapping
{
    public static readonly DomainMapping Domain = new("Circulation", [], [], (kernel, entity, kind, builder) => { });
}
