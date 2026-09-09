namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Pipes, fittings, valves, sanitary fixtures, drains, pumps, fire protection terminals and piping systems. Wave R5 track F; see WAVE-R5.md.</summary>
public static class PlumbingMapping
{
    public static readonly DomainMapping Domain = new("Plumbing", [], [], (kernel, entity, kind, builder) => { });
}
