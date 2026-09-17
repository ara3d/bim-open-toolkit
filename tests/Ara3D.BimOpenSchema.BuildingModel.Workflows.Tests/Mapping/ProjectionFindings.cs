namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

/// <summary>Selects the validation findings that concern a given set of core records.</summary>
public static class ProjectionFindings
{
    /// <summary>Every `validation.*` finding naming one of these records. `ProjectionValidation` builds a subject from
    /// the projection's table name, which is the plural property name, and puts the record name in the Field of a
    /// reference finding, so both are matched; a literal singular subject prefix would match nothing.</summary>
    public static IReadOnlyList<MappingDiagnostic> Validation(BuildingProjection projection, params Type[] records)
    {
        var tables = records.Select(r => ProjectionTables.Table(r).Name).ToHashSet(StringComparer.Ordinal);
        var kinds = records.Select(r => r.Name).ToHashSet(StringComparer.Ordinal);
        return projection.Diagnostics.Where(d => d.Code.StartsWith("validation.", StringComparison.Ordinal)
            && (tables.Any(t => d.Subject == t || d.Subject.StartsWith(t + "/", StringComparison.Ordinal)) || kinds.Contains(d.Field))).ToArray();
    }
}
