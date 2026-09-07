using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel;

/// <summary>A global identity, typed by its referenced table. This value does not load an object.</summary>
/// <remarks>Source-local integers or names alone are not global identities. Default structs must be rejected at import boundaries.</remarks>
public readonly record struct ReferenceKey<T>
{
    public string Value { get; }
    public ReferenceKey(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("A key must be nonempty.", nameof(value));
        Value = value;
    }
    public override string ToString() => Value;
}

/// <summary>The complete identity of a table row within a published model snapshot.</summary>
/// <remarks>Two equal local values in different snapshots refer to different rows. Foreign references must agree with the intended query snapshot.</remarks>
public readonly record struct SnapshotKey<T>
{
    public ReferenceKey<ModelSnapshot> SnapshotId { get; }
    public string Value { get; }
    public SnapshotKey(ReferenceKey<ModelSnapshot> snapshotId, string value)
    {
        if (string.IsNullOrWhiteSpace(snapshotId.Value)) throw new ArgumentException("A snapshot is required.", nameof(snapshotId));
        if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("A local key must be nonempty.", nameof(value));
        SnapshotId = snapshotId;
        Value = value;
    }
    public override string ToString() => $"{SnapshotId.Value}/{Value}";
}

/// <summary>Why a domain value is unavailable. None of these states means numeric zero or confirmed absence.</summary>
public enum Availability { NotObserved, NotExported, NotApplicable, Invalid, Conflicting }
/// <summary>The declared origin/assurance of an available value; it is not a certification.</summary>
public enum Assurance { Observed, Derived, Estimated, Verified }
/// <summary>Whether a collection covers the declared scope. An empty unobserved collection is not proof of no members.</summary>
public enum Completeness { NotObserved, Partial, Complete, NotApplicable }

/// <summary>A typed domain value with evidence, or an explicit unavailable value with a reason.</summary>
/// <remarks>Use Missing(NotExported) only with exporter-capability evidence. Conflicting alternatives remain separate observations.</remarks>
public abstract record Fact<T>
{
    private Fact() { }
    /// <summary>An available value. Evidence can refer to source observations, external specifications or reproducible derivations.</summary>
    public sealed record Known(T Value, Assurance Assurance, ImmutableArray<ReferenceKey<Evidence>> Evidence) : Fact<T>;
    /// <summary>No value is supplied; consumers must report this state rather than substitute a default.</summary>
    public sealed record Missing(Availability Reason, string Explanation, ImmutableArray<ReferenceKey<Evidence>> Evidence) : Fact<T>;
    /// <summary>Convenience for an unavailable observation with unknown cause; does not invent evidence.</summary>
    public static Fact<T> Unknown(string explanation) => new Missing(Availability.NotObserved, explanation, ImmutableArray<ReferenceKey<Evidence>>.Empty);
    /// <summary>Convenience for an explicitly inapplicable field; the explanation should identify why.</summary>
    public static Fact<T> Inapplicable(string explanation) => new Missing(Availability.NotApplicable, explanation, ImmutableArray<ReferenceKey<Evidence>>.Empty);
}

/// <summary>Snapshot-scoped relationships plus an explicit statement of collection coverage.</summary>
/// <remarks>Items are links, not hydrated children. A Complete empty set is an assertion requiring evidence; Partial or NotObserved may also be empty.</remarks>
public sealed record LinkSet<T>(
    ImmutableArray<SnapshotKey<T>> Items,
    Completeness Completeness,
    ImmutableArray<ReferenceKey<Evidence>> Evidence)
{
    public static LinkSet<T> Unknown() => new(ImmutableArray<SnapshotKey<T>>.Empty, Completeness.NotObserved, ImmutableArray<ReferenceKey<Evidence>>.Empty);
}

/// <summary>Coverage of explicitly scoped observations, not a claim about every object in a source file.</summary>
public sealed record Coverage(int KnownCount, int MissingCount, int ConflictingCount, string ScopeDescription);

// Unit-bearing values keep dimensions visible in constructor signatures.
// Values in these wrappers are canonical units, never display-unit guesses.
// Import/analysis validation must reject NaN/infinity and enforce domain-specific ranges.
/// <summary>Length in metres; elevations may be negative relative to their coordinate origin.</summary>
public readonly record struct Length(double Metres);
/// <summary>Area in square metres. Gross, net, projected and actual-surface bases belong in the containing field/observation.</summary>
public readonly record struct Area(double SquareMetres);
/// <summary>Volume in cubic metres. A bounding volume is not a material quantity.</summary>
public readonly record struct Volume(double CubicMetres);
/// <summary>Mass in kilograms.</summary>
public readonly record struct Mass(double Kilograms);
/// <summary>Angle in radians, with axis/direction defined by the containing record.</summary>
public readonly record struct Angle(double Radians);
/// <summary>Dimensionless value; a fraction, efficiency and slope need distinct field meanings and applicable ranges.</summary>
public readonly record struct Ratio(double Value);
/// <summary>Power in watts, not energy consumption.</summary>
public readonly record struct Power(double Watts);
/// <summary>Energy in kilowatt-hours, with time period and measured/simulated basis stated separately.</summary>
public readonly record struct Energy(double KilowattHours);
/// <summary>Temperature in degrees Celsius, not a temperature difference.</summary>
public readonly record struct Temperature(double Celsius);
/// <summary>Pressure in pascals. Gauge/absolute/static/total basis must be declared by the containing specification.</summary>
public readonly record struct Pressure(double Pascals);
/// <summary>Volumetric flow in cubic metres per second; intended direction is defined by ports/connections.</summary>
public readonly record struct FlowRate(double CubicMetresPerSecond);
/// <summary>Electrical potential difference in volts; AC phase and line/phase conventions remain explicit.</summary>
public readonly record struct Voltage(double Volts);
/// <summary>Electrical current in amperes, with rated/design/measured basis defined by its field.</summary>
public readonly record struct ElectricCurrent(double Amperes);
/// <summary>Thermal transmittance in W/(m²·K); assembly boundary and test/derivation method remain evidence.</summary>
public readonly record struct ThermalTransmittance(double WattsPerSquareMetreKelvin);
/// <summary>Thermal resistance in m²·K/W.</summary>
public readonly record struct ThermalResistance(double SquareMetreKelvinPerWatt);
/// <summary>Acoustic level in decibels. Reference, weighting and frequency band must be stated separately.</summary>
public readonly record struct SoundLevel(double Decibels);
/// <summary>Money with explicit currency code; different currencies cannot be added without a supplied exchange-rate basis.</summary>
public readonly record struct Money(decimal Amount, string Currency);
/// <summary>An elapsed duration, not a calendar date or a schedule recurrence.</summary>
public readonly record struct DurationValue(TimeSpan Value);
/// <summary>Material density in kilograms per cubic metre, with condition/basis in evidence.</summary>
public readonly record struct MassDensity(double KilogramsPerCubicMetre);
/// <summary>Thermal conductivity in W/(m·K).</summary>
public readonly record struct ThermalConductivity(double WattsPerMetreKelvin);
/// <summary>Specific heat capacity in J/(kg·K).</summary>
public readonly record struct SpecificHeatCapacity(double JoulesPerKilogramKelvin);
