using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

// Wave contract R4. SourceId identifies a delivery; DocumentScope identifies the
// source document lineage when a caller has independently established it.
public enum NumericStoragePolicy { Unknown, DeclaredDescriptor, RevitInternal }
public sealed record MappingOptions(string SourceId, string ContentFingerprint,
    string DocumentScope, DateTimeOffset PreparedAt, bool NumericValuesUseDeclaredUnits = false,
    NumericStoragePolicy NumericStorage = NumericStoragePolicy.Unknown);

public sealed record MappingDiagnostic(string Code, string Subject, string Field, string Message);
public sealed record FieldCoverage(string EntityKind, string Field, int Total, int Known,
    int Missing, int Invalid, int Conflicting, int Inapplicable);

public sealed record BuildingProjection(
    ModelSnapshot Snapshot,
    ImmutableArray<SourceRevision> SourceRevisions,
    ImmutableArray<SourceObject> SourceObjects,
    ImmutableArray<BimObject> Objects,
    ImmutableArray<Evidence> Evidence,
    ImmutableArray<Storey> Storeys,
    ImmutableArray<Space> Spaces,
    ImmutableArray<Door> Doors,
    ImmutableArray<Roof> Roofs,
    ImmutableArray<FinishSurface> Finishes,
    ImmutableArray<FieldCoverage> Coverage,
    ImmutableArray<MappingDiagnostic> Diagnostics,
    ImmutableArray<SourceDocument> Documents = default,
    ImmutableArray<InterpretationPolicy> Policies = default);

public enum WorkflowStatus { Supported, Partial, RequiresInput }
public sealed record WorkflowReport(string Id, string Title, WorkflowStatus Status,
    string Scope, ImmutableArray<string> Columns, ImmutableArray<ImmutableArray<string>> Rows,
    ImmutableArray<string> Findings);

public static class WorkflowReports
{
    public static WorkflowReport Missing(string id, string title, string scope, params string[] inputs)
        => new(id, title, WorkflowStatus.RequiresInput, scope, [], [], inputs.ToImmutableArray());
}
