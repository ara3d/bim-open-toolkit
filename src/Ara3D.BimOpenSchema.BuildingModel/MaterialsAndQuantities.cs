using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel;

public enum MaterialClass { Concrete, Steel, Timber, Masonry, Glass, Gypsum, Insulation, Metal, Polymer, Soil, Vegetation, Composite, Other, Unclassified }
public enum AssemblyKind { Wall, Floor, Roof, Ceiling, Facade, Finish, Insulation, Pavement, Other }
public enum QuantityScopeKind { WholeObject, MaterialPart, Surface, LinearPortion, WorkScope }
public enum MeasureKind { Count, Length, Area, Volume, Mass, Energy, Power, Flow, Other }
public enum QuantityBasis { Gross, Net, Projected, Surface, Centerline, Nominal, Declared, Measured, Unspecified }
public enum QuantitySelection { Unresolved, Selected, Alternative, Rejected }
public enum ContributionRole { Unresolved, LeafContribution, AssemblyTotal, Alternative }

/// <summary>A material definition, not its contribution to an occurrence. Properties apply only under the stated evidence conditions.</summary>
public sealed record Material(
    ReferenceKey<Material> Id,
    string Name,
    MaterialClass Class,
    Fact<string> Grade,
    Fact<MassDensity> Density,
    Fact<ThermalConductivity> ThermalConductivity,
    Fact<SpecificHeatCapacity> SpecificHeat,
    Fact<Ratio> RecycledContent,
    Fact<string> FireReactionClassification,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>A product/type definition shared by occurrences. Manufacturer identity is distinct from an installed asset serial number.</summary>
public sealed record ProductDefinition(
    ReferenceKey<ProductDefinition> Id,
    string Name,
    string Version,
    Fact<string> Manufacturer,
    Fact<string> ProductCode,
    Fact<string> ModelNumber,
    Fact<ReferenceKey<Material>> PrincipalMaterial,
    Fact<ReferenceKey<AssemblyDefinition>> Assembly,
    ImmutableArray<ExternalReference> Documents,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>An ordered material layer in an assembly definition; its layer key is local to the containing definition/version.</summary>
/// <param name="LayerKey">Stable identity within the containing assembly version.</param>
/// <param name="Sequence">Order along the assembly's declared direction, not an assumed inside/outside orientation.</param>
/// <param name="Function">Construction role such as structure, insulation or weatherproofing.</param>
/// <param name="MaterialId">Specified material definition; not an installed material quantity.</param>
/// <param name="Thickness">Specified layer thickness in metres.</param>
/// <param name="CoverageFraction">Fraction of assembly area occupied by this layer, when defined.</param>
/// <param name="Evidence">Specification or source supporting the layer definition.</param>
public sealed record AssemblyLayer(
    string LayerKey,
    int Sequence,
    string Function,
    ReferenceKey<Material> MaterialId,
    Fact<Length> Thickness,
    Fact<Ratio> CoverageFraction,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>A versioned construction recipe. It does not imply that every occurrence has the specified thickness or complete layers.</summary>
public sealed record AssemblyDefinition(
    ReferenceKey<AssemblyDefinition> Id,
    string Name,
    string Version,
    AssemblyKind Kind,
    string LayerDirection,
    ImmutableArray<AssemblyLayer> Layers,
    Completeness LayerCompleteness,
    Fact<ThermalTransmittance> ThermalTransmittance,
    Fact<ThermalResistance> ThermalResistance,
    Fact<DurationValue> FireResistance,
    Fact<string> AcousticClassification,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>A measurement subject within one object's scope. Distinct material parts can have independently selected masses.</summary>
/// <remarks>Whole-object and part scopes are not automatically disjoint or additive.</remarks>
public sealed record QuantityScope(
    SnapshotKey<QuantityScope> Id,
    ReferenceKey<BimObject> ObjectId,
    QuantityScopeKind Kind,
    string Description,
    Fact<string> PartIdentity,
    Fact<SnapshotKey<GeometryRepresentation>> Region,
    LinkSet<QuantityScope> Parts,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>An exact source/selected scalar measurement with explicit unit code and dimension.</summary>
/// <remarks>UnitCode must resolve through a declared vocabulary before arithmetic. Domain fields use the more specific SI value types.</remarks>
public readonly record struct Measurement(decimal Amount, string UnitCode, MeasureKind Kind);

/// <summary>One measurement observation on a declared scope, preserving alternatives and selection policy.</summary>
public sealed record QuantityObservation(
    SnapshotKey<QuantityObservation> Id,
    SnapshotKey<QuantityScope> ScopeId,
    QuantityBasis Basis,
    Fact<Measurement> Value,
    QuantitySelection Selection,
    ReferenceKey<InterpretationPolicy> SelectionPolicy,
    string Method);

/// <summary>One material contribution to an occurrence. Repeated representations must not multiply this row.</summary>
/// <remarks>Totals should select disjoint leaf contributions under one scenario and measurement basis.</remarks>
public sealed record MaterialUse(
    SnapshotKey<MaterialUse> Id,
    ReferenceKey<BimObject> ObjectId,
    ReferenceKey<Material> MaterialId,
    SnapshotKey<QuantityScope> ScopeId,
    Fact<ReferenceKey<AssemblyDefinition>> Assembly,
    Fact<string> LayerKey,
    ContributionRole Role,
    Fact<Area> CoveredArea,
    Fact<Volume> NetVolume,
    Fact<Mass> NetMass,
    LinkSet<QuantityObservation> Observations,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);
