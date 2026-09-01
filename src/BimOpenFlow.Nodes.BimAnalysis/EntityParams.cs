using Ara3D.BimOpenSchema;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Null-safe reads over EntityModel.ParameterValues, shared by the source
/// nodes. (EntityModel's own GetParameterAsNumber/AsInt throw on absent values.)</summary>
public static class EntityParams
{
    public static double? NumberOrNull(this EntityModel e, string name)
        => e.ParameterValues.TryGetValue(name, out var v) && v is float f ? f : null;

    /// <summary>The element's level elevation, or null when it has no level or the
    /// level has no elevation parameter.</summary>
    public static double? ElevationOrNull(this EntityModel e)
        => e.GetParameterAsEntity(CommonRevitParameters.ElementLevel)
            ?.NumberOrNull(CommonRevitParameters.LevelElevation);

    /// <summary>The containing room: the Space parameter when set, else Room.</summary>
    public static EntityModel? RoomOf(this EntityModel e)
        => e.GetParameterAsEntity(CommonRevitParameters.FISpace)
           ?? e.GetParameterAsEntity(CommonRevitParameters.FIRoom);
}
