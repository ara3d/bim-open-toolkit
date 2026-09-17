using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel;

public enum LifecycleState { NotObserved, Planned, Existing, Temporary, Removed, Unknown }
public enum IdentityStatus { Provisional, Reconciled, Disputed }
public enum EvidenceOrigin { Source, Derived, External, UserAssertion }
public enum CorrespondenceStatus { Candidate, Confirmed, Rejected }
public enum ExporterFamily { Unknown, Revit, Ifc, Other }

/// <summary>One immutable selection of source revisions and interpretation policies. A snapshot is not a building.</summary>
public sealed record ModelSnapshot(
    ReferenceKey<ModelSnapshot> Id,
    string Name,
    string SchemaVersion,
    ImmutableArray<ReferenceKey<SourceRevision>> Sources,
    ImmutableArray<ReferenceKey<InterpretationPolicy>> Policies,
    DateTimeOffset PreparedAt);

/// <summary>The shared identity of a physical, spatial or logical thing across deliveries and alternative representations.</summary>
/// <remarks>Typed domain rows reference this identity. A wall, its finish surfaces and its mesh must not be conflated.</remarks>
public sealed record BimObject(
    ReferenceKey<BimObject> Id,
    IdentityStatus IdentityStatus,
    string IdentityBasis,
    ImmutableArray<ReferenceKey<SourceObject>> SourceIdentities,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One authoring document, independently of its revisions or the buildings it describes.</summary>
public sealed record SourceDocument(
    ReferenceKey<SourceDocument> Id,
    string Name,
    Fact<string> Organization,
    Fact<string> Discipline,
    Fact<string> OriginalLocator);

/// <summary>One exact source delivery, identified by content and exporter information.</summary>
/// <param name="Id">Global identity of this immutable delivery.</param>
/// <param name="DocumentId">Authoring document from which this delivery originated.</param>
/// <param name="RevisionLabel">Human revision label; not assumed unique across documents.</param>
/// <param name="IssuedAt">Reported issue time, independent of local file modification time.</param>
/// <param name="ContentFingerprint">Content digest with algorithm prefix, identifying the exact bytes.</param>
/// <param name="Exporter">Known exporter family, not an inferred guarantee of completeness.</param>
/// <param name="ExporterVersion">Exporter release or build when supplied.</param>
/// <param name="KnownLimitations">Documented exporter limitations; this is not inferred from absent data.</param>
public sealed record SourceRevision(
    ReferenceKey<SourceRevision> Id,
    ReferenceKey<SourceDocument> DocumentId,
    string RevisionLabel,
    Fact<DateTimeOffset> IssuedAt,
    string ContentFingerprint,
    ExporterFamily Exporter,
    Fact<string> ExporterVersion,
    ImmutableArray<string> KnownLimitations);

/// <summary>A locator for one source row/entity. It may describe a type, metadata or a relationship rather than a physical component.</summary>
public sealed record SourceObject(
    ReferenceKey<SourceObject> Id,
    ReferenceKey<SourceRevision> SourceRevisionId,
    string Table,
    long Row,
    Fact<string> LocalId,
    string SourceRole);

/// <summary>An evidenced assertion that a source object describes a semantic object. Candidates do not authorize merging.</summary>
public sealed record ObjectCorrespondence(
    ReferenceKey<ObjectCorrespondence> Id,
    ReferenceKey<SourceObject> SourceObjectId,
    ReferenceKey<BimObject> ObjectId,
    CorrespondenceStatus Status,
    ReferenceKey<InterpretationPolicy> PolicyId,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One versioned interpretation or derivation policy, with reproducible configuration identity.</summary>
public sealed record InterpretationPolicy(
    ReferenceKey<InterpretationPolicy> Id,
    string Name,
    string Version,
    string ConfigurationFingerprint,
    string Description);

/// <summary>An addressable explanation supporting one or more domain facts.</summary>
/// <remarks>The presence of an evidence record does not prove truth. The method and source applicability must be reviewed.</remarks>
public sealed record Evidence(
    ReferenceKey<Evidence> Id,
    EvidenceOrigin Origin,
    ImmutableArray<ReferenceKey<SourceObject>> Sources,
    ImmutableArray<ExternalReference> ExternalReferences,
    Fact<ReferenceKey<InterpretationPolicy>> PolicyId,
    string Method,
    string Explanation);

/// <summary>A versioned external reference such as a specification, drawing, test report, EPD or manual.</summary>
public sealed record ExternalReference(string Authority, string Title, string Version, string Locator);

/// <summary>Shared display, identity, spatial and provenance fields of a typed domain occurrence.</summary>
/// <remarks>Name/mark are optional labels, never identity keys. This is composition, not a universal component property bag.</remarks>
public sealed record ElementInfo(
    ReferenceKey<BimObject> ObjectId,
    string? Name,
    string? Mark,
    LifecycleState Lifecycle,
    SpatialContext Location,
    Fact<Placement> Placement,
    LinkSet<GeometryRepresentation> Geometry,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>Human-facing spatial associations. Multiple spaces, zones and storeys can apply without forcing a containment tree.</summary>
public sealed record SpatialContext(
    Fact<SnapshotKey<Building>> Building,
    Fact<SnapshotKey<Storey>> PrimaryStorey,
    LinkSet<Storey> OtherStoreys,
    LinkSet<Space> Spaces,
    LinkSet<Zone> Zones);

/// <summary>A vocabulary concept for source properties that do not belong in the stable typed domain fields.</summary>
public sealed record PropertyConcept(
    ReferenceKey<PropertyConcept> Id,
    string Name,
    string Definition,
    string Vocabulary,
    string VocabularyVersion);

/// <summary>Explicit alternatives for an uncurated property value; typed domain fields should be used for common workflows.</summary>
public abstract record PropertyValue
{
    private PropertyValue() { }
    public sealed record Text(string Value) : PropertyValue;
    public sealed record Boolean(bool Value) : PropertyValue;
    public sealed record Integer(long Value) : PropertyValue;
    public sealed record Number(decimal Value) : PropertyValue;
    public sealed record Measured(Measurement Value) : PropertyValue;
    public sealed record ObjectReference(ReferenceKey<BimObject> Value) : PropertyValue;
}

/// <summary>One preserved property observation. Alternatives coexist; no implicit last-row-wins selection is made.</summary>
public sealed record PropertyObservation(
    SnapshotKey<PropertyObservation> Id,
    ReferenceKey<BimObject> ObjectId,
    ReferenceKey<PropertyConcept> ConceptId,
    string SourceLabel,
    Fact<PropertyValue> Value);

/// <summary>One entry in a named, versioned classification system.</summary>
public sealed record Classification(ReferenceKey<Classification> Id, string System, string Edition, string Code, string Title);

/// <summary>A classification assigned to an object with explicit provenance; multiple systems can classify the same object.</summary>
public sealed record ClassificationAssignment(
    SnapshotKey<ClassificationAssignment> Id,
    ReferenceKey<BimObject> ObjectId,
    ReferenceKey<Classification> ClassificationId,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);
