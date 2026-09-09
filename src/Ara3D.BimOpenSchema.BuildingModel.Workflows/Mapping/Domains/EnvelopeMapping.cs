namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Walls, floors, ceilings, windows, openings and facade panels. Wave R5 track A; see WAVE-R5.md.</summary>
public static class EnvelopeMapping
{
    public static readonly DomainMapping Domain = new("Envelope", [], [], (kernel, entity, kind, builder) => { });
}
