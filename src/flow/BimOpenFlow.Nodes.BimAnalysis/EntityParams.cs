using Ara3D.BimOpenSchema;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Parameter reads over EntityModel that widen to the table columns' double,
/// shared by the source nodes. Each returns null when the value is absent.</summary>
public static class EntityParams
{
    public static double? NumberOrNull(this EntityModel e, string name)
        => e.GetParameterAsNumber(name);

    /// <summary>The element's level elevation, or null when it has no level or the
    /// level has no elevation parameter.</summary>
    public static double? ElevationOrNull(this EntityModel e)
        => e.Elevation;

    /// <summary>The containing room: the Space parameter when set, else Room.</summary>
    public static EntityModel? RoomOf(this EntityModel e)
        => e.GetParameterAsEntity(CommonRevitParameters.FISpace)
           ?? e.GetParameterAsEntity(CommonRevitParameters.FIRoom);
}
