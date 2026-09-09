using System.Collections.Immutable;
using System.Globalization;
using System.Text.RegularExpressions;
using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Identity, evidence, coverage and field resolution shared by every mapping domain during one call.
/// Domains read source rows and build typed records through this kernel; all mutable buffers stay inside it and
/// only immutable values escape. Field lookups match exact normalized aliases inside approved parameter groups.</summary>
[Platonic.TrustedMutableKernel]
public sealed class MappingKernel
{
    private readonly BimModel model;
    private readonly MappingOptions options;
    private readonly ReferenceKey<InterpretationPolicy> policy;
    private readonly Dictionary<int, string> kinds;
    private readonly Dictionary<int, ImmutableArray<PropertyRow>> properties;
    private readonly List<SourceDocument> documents = [];
    private readonly Dictionary<int, ReferenceKey<SourceObject>> sources = [];
    private readonly Dictionary<int, string> definitionIdentities = [];
    private readonly Dictionary<int, ReferenceKey<BimObject>> identities = [];
    private readonly Dictionary<int, ReferenceKey<Evidence>> identityEvidence = [];
    private readonly List<SourceRevision> revisions = [];
    private readonly List<SourceObject> sourceObjects = [];
    private readonly List<BimObject> objects = [];
    private readonly List<Evidence> evidence = [];
    private readonly HashSet<ReferenceKey<Evidence>> evidenceIds = [];
    private readonly List<MappingDiagnostic> diagnostics = [];
    private readonly Dictionary<(string Kind, string Field), List<Availability?>> coverage = [];
    private readonly HashSet<int> usedProducts = [];
    private readonly HashSet<int> usedAssemblies = [];
    private ImmutableHashSet<string> domainGroups = [];

    public BimModel Model => model;
    public MappingOptions Options => options;
    public NumericStoragePolicy Storage { get; }
    public ReferenceKey<ModelSnapshot> Snapshot { get; }
    public ReferenceKey<InterpretationPolicy> Policy => policy;
    public IReadOnlyCollection<int> UsedProductTypes => usedProducts;
    public IReadOnlyCollection<int> UsedAssemblyTypes => usedAssemblies;

    internal MappingKernel(BimModel model, MappingOptions options, Func<EntityRow, string> kindOf)
    {
        if (string.IsNullOrWhiteSpace(options.SourceId) || string.IsNullOrWhiteSpace(options.ContentFingerprint)
            || string.IsNullOrWhiteSpace(options.DocumentScope))
            throw new ArgumentException("Source, content fingerprint and caller-established document scope are required.", nameof(options));
        this.model = model;
        this.options = options;
        Storage = options.NumericStorage != NumericStoragePolicy.Unknown ? options.NumericStorage
            : options.NumericValuesUseDeclaredUnits ? NumericStoragePolicy.DeclaredDescriptor : NumericStoragePolicy.Unknown;
        policy = new($"{BuildingMapper.PolicyVersion}/{Storage}");
        Snapshot = new("snapshot/" + BuildingMapper.Digest(options.DocumentScope + "\n" + options.ContentFingerprint + "\n" + policy.Value));
        kinds = model.Tables.Entities.ToDictionary(e => e.Id, kindOf);
        properties = model.Tables.Properties.GroupBy(p => p.EntityId).ToDictionary(g => g.Key, g => g.ToImmutableArray());
        InitializeIdentity();
    }

    /// <summary>Source occurrences claimed by a registered domain, in source order.</summary>
    public IEnumerable<EntityRow> Selected => model.Tables.Entities.Where(e => kinds[e.Id] != "");

    /// <summary>The record kind an entity maps to, or an empty string when no domain claims it.</summary>
    public string Kind(int entityId) => kinds.GetValueOrDefault(entityId, "");

    public EntityRow Entity(int entityId) => model.Tables.Entities[entityId];

    public SnapshotKey<T> Key<T>(EntityRow e) => Key<T>(e.Id);
    public SnapshotKey<T> Key<T>(int entityId) => new(Snapshot, Identity(entityId).Value);

    public ReferenceKey<BimObject> Identity(int entityId)
        => identities.TryGetValue(entityId, out var id) ? id : throw new InvalidOperationException($"Entity {entityId} is not a selected occurrence.");

    public ReferenceKey<SourceObject> Source(int entityId)
        => sources.TryGetValue(entityId, out var id) ? id : throw new InvalidOperationException($"Entity {entityId} is not in the selected evidence closure.");

    public ReferenceKey<Evidence> IdentityEvidence(int entityId) => identityEvidence[entityId];

    /// <summary>Shared identity and spatial context of a selected occurrence. Counts Building coverage once per occurrence.</summary>
    public ElementInfo Element(EntityRow e)
    {
        var storey = Reference<Storey>(e, "Storey", "Storey", "Level", "Base Level", "Reference Level", "Ebene", "Basisebene", "Rvt:Element:Level");
        var adjacent = SpaceLinks(e);
        var name = string.IsNullOrWhiteSpace(e.Name) ? null : e.Name;
        var mark = Text(e, "Mark", "Mark", "Kennzeichen");
        var building = Unknown<SnapshotKey<Building>>();
        Count(e, "Building", building);
        return new(identities[e.Id], name, mark is Fact<string>.Known k ? k.Value : null, LifecycleState.NotObserved,
            new(building, storey, LinkSet<Storey>.Unknown(), adjacent, LinkSet<Zone>.Unknown()),
            Unknown<Placement>(), LinkSet<GeometryRepresentation>.Unknown(), [identityEvidence[e.Id]]);
    }

    /// <summary>Property rows of an entity followed by its type chain; a cycle is diagnosed and stopped.</summary>
    public ImmutableArray<PropertyRow> Rows(EntityRow e)
    {
        var rows = ImmutableArray.CreateBuilder<PropertyRow>();
        var seen = new HashSet<int>();
        int? id = e.Id;
        while (id is { } current && seen.Add(current))
        {
            rows.AddRange(properties.GetValueOrDefault(current, []));
            id = model.Tables.Entities[current].TypeId;
        }
        if (id is not null) Diagnose("type.cycle", e, "Type", "Type inheritance cycle stopped; values encountered remain visible.");
        return rows.ToImmutable();
    }

    /// <summary>Rows whose normalized name is one of the aliases, whose group is approved and whose kind matches.</summary>
    public ImmutableArray<PropertyRow> Select(EntityRow e, ParameterType kind, params string[] aliases)
    {
        var names = aliases.Select(TextNormalization.Key).ToHashSet();
        return Rows(e).Where(p => names.Contains(TextNormalization.Key(p.Name))
            && (ApprovedGroup(p.Group) || p.Name?.StartsWith("Rvt:", StringComparison.Ordinal) == true || p.Name == "Ifc:Room:Number")
            && p.Key.Kind == kind).ToImmutableArray();
    }

    public Fact<string> Text(EntityRow e, string field, params string[] aliases)
        => Resolve(e, field, Select(e, ParameterType.String, aliases), p => string.IsNullOrWhiteSpace(p.TextValue)
            ? Fact<string>.Unknown("Source text is empty.") : new Fact<string>.Known(p.TextValue, Assurance.Observed, []));

    public Fact<int> Integer(EntityRow e, string field, params string[] aliases)
        => Resolve<int>(e, field, Select(e, ParameterType.Int, aliases), p => p.IntegerValue is >= int.MinValue and <= int.MaxValue
            ? new Fact<int>.Known((int)p.IntegerValue.Value, Assurance.Observed, [])
            : new Fact<int>.Missing(Availability.Invalid, "Integer is absent or outside the supported range.", []));

    /// <summary>A yes/no parameter stored as 0 or 1; any other stored value is invalid rather than guessed.</summary>
    public Fact<bool> Flag(EntityRow e, string field, params string[] aliases)
        => Resolve<bool>(e, field, Select(e, ParameterType.Int, aliases), p => p.IntegerValue is 0 or 1
            ? new Fact<bool>.Known(p.IntegerValue == 1, Assurance.Observed, [])
            : new Fact<bool>.Missing(Availability.Invalid, "Yes/no value is not stored as 0 or 1.", []));

    public Fact<DurationValue> FireResistance(EntityRow e) => Duration(e, "FireResistance", "Fire Rating", "Fire Resistance");

    /// <summary>Text such as "2 HR" or "90 MIN"; a bare number carries no unit and stays unavailable.</summary>
    public Fact<DurationValue> Duration(EntityRow e, string field, params string[] aliases)
        => Resolve(e, field, Select(e, ParameterType.String, aliases), p =>
        {
            var match = Regex.Match(p.TextValue ?? "", @"^\s*(\d+(?:\.\d+)?)\s*(MIN|MINS|MINUTE|MINUTES|H|HR|HRS|HOUR|HOURS)\s*$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            if (!match.Success) return Fact<DurationValue>.Unknown("Rating does not carry an explicit, recognized time unit; original text remains evidence.");
            if (!double.TryParse(match.Groups[1].Value, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var number))
                return new Fact<DurationValue>.Missing(Availability.Invalid, "Duration cannot be parsed.", []);
            var minutes = number * (match.Groups[2].Value.StartsWith("H", StringComparison.OrdinalIgnoreCase) ? 60 : 1);
            return !double.IsFinite(minutes) || minutes >= TimeSpan.MaxValue.TotalMinutes
                ? new Fact<DurationValue>.Missing(Availability.Invalid, "Duration outside supported range.", [])
                : new Fact<DurationValue>.Known(new(TimeSpan.FromMinutes(minutes)), Assurance.Observed, []);
        });

    /// <summary>A canonical number in the given unit key (m, m2, m3, rad, min). Stored numbers are converted only under an
    /// explicit storage policy; otherwise a descriptor's display units are not trusted and the value stays unavailable.</summary>
    public Fact<T> Number<T>(EntityRow e, string field, string unit, Func<double, T> wrap, bool signed, params string[] aliases)
        => Resolve(e, field, Select(e, ParameterType.Number, aliases), p =>
        {
            var value = p.CanonicalNumber;
            var canonicalUnit = p.CanonicalUnits;
            if (value is null && Storage == NumericStoragePolicy.RevitInternal && p.NumberValue is { } internalValue && RevitInternalFactor(unit) is { } factor)
            {
                value = internalValue * factor;
                canonicalUnit = unit;
            }
            if (value is null && Storage == NumericStoragePolicy.DeclaredDescriptor && p.NumberValue is { } stored)
            {
                if (unit == "min" && TextNormalization.Key(p.Units) is "MIN" or "MINUTES") { value = stored; canonicalUnit = "min"; }
                else (value, canonicalUnit) = TextNormalization.CanonicalNumber(stored, TextNormalization.UnitKey(p.Units));
            }
            if (value is null) return Fact<T>.Unknown("Stored numeric units are not established; descriptor units may be display units.");
            if (canonicalUnit != unit || !double.IsFinite(value.Value) || !signed && value.Value < 0
                || unit == "min" && value.Value > TimeSpan.MaxValue.TotalMinutes)
                return new Fact<T>.Missing(Availability.Invalid, "Incompatible canonical dimension or invalid numerical range.", []);
            return new Fact<T>.Known(wrap(value.Value), Assurance.Observed, []);
        });

    // Revit stores lengths in feet and angles in radians; other dimensions need a documented factor before they are trusted.
    private static double? RevitInternalFactor(string unit) => unit switch
    {
        "m" => 0.3048, "m2" => 0.09290304, "m3" => 0.028316846592, "rad" => 1.0, _ => null
    };

    /// <summary>An entity-valued parameter that must point at a selected occurrence of kind T.</summary>
    public Fact<SnapshotKey<T>> Reference<T>(EntityRow e, string field, params string[] aliases)
        => Resolve<SnapshotKey<T>>(e, field, Select(e, ParameterType.Entity, aliases), p => p.ReferenceEntityId is { } id && Kind(id) == typeof(T).Name
            ? new Fact<SnapshotKey<T>>.Known(Key<T>(id), Assurance.Observed, [])
            : new Fact<SnapshotKey<T>>.Missing(Availability.Invalid, "Source reference target is outside the expected typed occurrence table.", []));

    public LinkSet<Space> SpaceLinks(EntityRow e)
        => Links<Space>(e, "Spaces", "From Room", "To Room", "Room", "Space", "FromRoom", "ToRoom", "Von Raum", "Nach Raum",
            "Rvt:FamilyInstance:FromRoom", "Rvt:FamilyInstance:ToRoom", "Rvt:FamilyInstance:Room");

    /// <summary>Entity-valued parameters gathered into a link set; targets outside kind T are diagnosed, never silently dropped.</summary>
    public LinkSet<T> Links<T>(EntityRow e, string field, params string[] aliases)
    {
        var rows = Select(e, ParameterType.Entity, aliases);
        var values = ImmutableArray.CreateBuilder<SnapshotKey<T>>();
        var evs = ImmutableArray.CreateBuilder<ReferenceKey<Evidence>>();
        var invalid = false;
        foreach (var p in rows)
        {
            evs.Add(PropertyEvidence(p));
            if (p.IsValid && !p.IsMissing && p.ReferenceEntityId is { } id && Kind(id) == typeof(T).Name) values.Add(Key<T>(id));
            else if (!p.IsMissing)
            {
                invalid = true;
                Diagnose("reference.invalid-target", e, field, $"{field} association does not resolve to a selected {typeof(T).Name} occurrence.");
            }
        }
        Count(e, field, invalid ? new Fact<string>.Missing(Availability.Invalid, "Invalid reference.", [])
            : values.Count > 0 ? new Fact<string>.Known("Observed members", Assurance.Observed, []) : Unknown<string>());
        return new(values.Distinct().ToImmutableArray(), rows.Length == 0 ? Completeness.NotObserved : Completeness.Partial, evs.ToImmutable());
    }

    /// <summary>The occurrence's declared type as a product definition; the type is remembered for the definitions pass.</summary>
    public Fact<ReferenceKey<ProductDefinition>> Product(EntityRow e) => Definition<ProductDefinition>(e, "Product", usedProducts);

    /// <summary>The occurrence's declared type as an assembly definition; the type is remembered for the definitions pass.</summary>
    public Fact<ReferenceKey<AssemblyDefinition>> Assembly(EntityRow e) => Definition<AssemblyDefinition>(e, "Assembly", usedAssemblies);

    // Definition keys follow the type's document-scoped identity, not the delivery, so reimports compare as unchanged.
    public ReferenceKey<ProductDefinition> ProductKey(int typeId) => new("product/" + BuildingMapper.Digest(DefinitionIdentity(typeId)));
    public ReferenceKey<AssemblyDefinition> AssemblyKey(int typeId) => new("assembly/" + BuildingMapper.Digest(DefinitionIdentity(typeId)));

    private string DefinitionIdentity(int typeId)
        => definitionIdentities.TryGetValue(typeId, out var identity) ? identity : throw new InvalidOperationException($"Entity {typeId} is not in the selected evidence closure.");

    private Fact<ReferenceKey<T>> Definition<T>(EntityRow e, string field, HashSet<int> used)
    {
        Fact<ReferenceKey<T>> fact = e.TypeId is { } t && sources.ContainsKey(t)
            ? new Fact<ReferenceKey<T>>.Known(new(typeof(T) == typeof(ProductDefinition) ? ProductKey(t).Value : AssemblyKey(t).Value), Assurance.Observed,
                [Evidence([sources[t]], field, $"Type entity row {t} '{model.Tables.Entities[t].Name}' is the declared {field.ToLowerInvariant()} definition.")])
            : Unknown<ReferenceKey<T>>();
        if (fact is Fact<ReferenceKey<T>>.Known) used.Add(e.TypeId!.Value);
        Count(e, field, fact);
        return fact;
    }

    /// <summary>Combines candidate observations: one distinct known value wins; disagreement, invalidity and absence stay distinct.</summary>
    public Fact<T> Resolve<T>(EntityRow e, string field, ImmutableArray<PropertyRow> rows, Func<PropertyRow, Fact<T>> convert)
    {
        var facts = rows.Select(p => !p.IsValid
            ? new Fact<T>.Missing(Availability.Invalid, "Source value could not be decoded.", [])
            : p.IsMissing ? Fact<T>.Unknown("Source value is missing.") : convert(p)).ToArray();
        var evs = rows.Select(PropertyEvidence).ToImmutableArray();
        Fact<T> result;
        var known = facts.OfType<Fact<T>.Known>().Select(k => k.Value).Distinct().ToArray();
        if (known.Length > 1) result = new Fact<T>.Missing(Availability.Conflicting, "Occurrence/type or descriptor alternatives disagree; none was selected.", evs);
        else if (facts.OfType<Fact<T>.Missing>().Any(m => m.Reason == Availability.Invalid)) result = new Fact<T>.Missing(Availability.Invalid, "At least one applicable source observation is invalid.", evs);
        else if (facts.OfType<Fact<T>.Missing>().Any() || known.Length == 0) result = new Fact<T>.Missing(Availability.NotObserved,
            rows.Length == 0 ? "No matching source descriptor observation." : "An applicable source observation lacks a value or established stored units.", evs);
        else result = new Fact<T>.Known(known[0], Assurance.Observed, evs);
        Count(e, field, result);
        if (result is Fact<T>.Missing m && rows.Length > 0)
            Diagnose("field." + m.Reason.ToString().ToLowerInvariant(), e, field, m.Explanation);
        return result;
    }

    public ReferenceKey<Evidence> PropertyEvidence(PropertyRow p)
    {
        var id = new ReferenceKey<Evidence>("evidence/" + BuildingMapper.Digest(Snapshot.Value + "/property/" + p.Id));
        if (!evidenceIds.Add(id)) return id;
        evidence.Add(new(id, EvidenceOrigin.Source, [sources[p.EntityId]], [], new Fact<ReferenceKey<InterpretationPolicy>>.Known(policy, Assurance.Derived, []),
            BuildingMapper.PolicyVersion, $"Parameters row {p.Id}; owner Entities row {p.EntityId}; descriptor {p.DescriptorId}; {p.Group}/{p.Name}; kind {p.Key.Kind}; units '{p.Units}'; stored text '{p.TextValue}', number '{p.NumberValue?.ToString("R", CultureInfo.InvariantCulture)}', integer '{p.IntegerValue}', reference '{p.ReferenceEntityId}'; valid={p.IsValid}; missing={p.IsMissing}."));
        return id;
    }

    /// <summary>Evidence derived from source objects by a named method; repeated calls with the same inputs share one row.</summary>
    public ReferenceKey<Evidence> Evidence(ImmutableArray<ReferenceKey<SourceObject>> refs, string method, string explanation)
    {
        var id = new ReferenceKey<Evidence>("evidence/" + BuildingMapper.Digest(Snapshot.Value + "/" + string.Join("|", refs) + "/" + method));
        if (!evidenceIds.Add(id)) return id;
        evidence.Add(new(id, EvidenceOrigin.Source, refs, [], new Fact<ReferenceKey<InterpretationPolicy>>.Known(policy, Assurance.Derived, []), BuildingMapper.PolicyVersion + "/" + method, explanation));
        return id;
    }

    /// <summary>Records one field observation in the coverage denominator of the entity's kind.</summary>
    public void Count<T>(EntityRow e, string field, Fact<T> fact)
    {
        var key = (CoverageKind(e), field);
        if (!coverage.TryGetValue(key, out var list)) coverage.Add(key, list = []);
        list.Add(fact is Fact<T>.Missing m ? m.Reason : null);
    }

    public void Diagnose(string code, EntityRow e, string field, string message)
        => diagnostics.Add(new(code, identities.TryGetValue(e.Id, out var id) ? id.Value : "Entities/" + e.Id.ToString(CultureInfo.InvariantCulture), field, message));

    public static Fact<T> Unknown<T>() => Fact<T>.Unknown("Not established by this source adapter.");

    internal void Bind(DomainMapping domain)
        => domainGroups = domain.ApprovedGroups.Select(TextNormalization.Key).ToImmutableHashSet();

    private string CoverageKind(EntityRow e) => kinds[e.Id] is "" ? (e.IsType ? "Type" : "Other") : kinds[e.Id];

    private bool ApprovedGroup(string? group) => TextNormalization.Key(group) is var key && (key is
        "" or "IDENTITY DATA" or "DIMENSIONS" or "CONSTRAINTS" or "DATA" or "GEOMETRY" or "TEXT" or "OTHER"
        or "IDENTITÄTSDATEN" or "ABMESSUNGEN" or "ABHÄNGIGKEITEN" || domainGroups.Contains(key));

    private void InitializeIdentity()
    {
        var neededOwners = new HashSet<int>();
        foreach (var occurrence in Selected)
        {
            int? owner = occurrence.Id;
            while (owner is { } id && neededOwners.Add(id)) owner = model.Tables.Entities[id].TypeId;
        }
        // Document paths/title are locators inside an explicitly supplied lineage, never building identities.
        string DocToken(EntityRow e) => e.DocumentId is { } id
            ? model.Tables.Documents[id].Path ?? model.Tables.Documents[id].Title ?? "unidentified-document/" + id
            : "unassigned-document";
        foreach (var group in model.Tables.Entities.GroupBy(DocToken))
        {
            var docId = new ReferenceKey<SourceDocument>("document/" + BuildingMapper.Digest(options.DocumentScope + "\n" + group.Key));
            documents.Add(new(docId, group.Key, Unknown<string>(), Unknown<string>(), new Fact<string>.Known(group.Key, Assurance.Observed, [])));
            var rev = new ReferenceKey<SourceRevision>("revision/" + BuildingMapper.Digest(docId.Value + "\n" + options.ContentFingerprint));
            revisions.Add(new(rev, docId, options.SourceId, Unknown<DateTimeOffset>(), options.ContentFingerprint, ExporterFamily.Unknown, Unknown<string>(), []));
            foreach (var e in group)
            {
                if (!neededOwners.Contains(e.Id)) continue;
                sources[e.Id] = new("source/" + BuildingMapper.Digest(rev.Value + "/Entities/" + e.Id));
                definitionIdentities[e.Id] = docId.Value + "/" + (string.IsNullOrWhiteSpace(e.GlobalId) ? "local/" + e.LocalId : "global/" + e.GlobalId);
                sourceObjects.Add(new(sources[e.Id], rev, "Entities", e.Id,
                    new Fact<string>.Known(e.LocalId.ToString(CultureInfo.InvariantCulture), Assurance.Observed, []),
                    e.IsType ? "Type" : e.IsCategory ? "Category" : "OccurrenceOrMetadata"));
            }
            foreach (var identityGroup in group.Where(e => kinds[e.Id] != "").GroupBy(e =>
                         string.IsNullOrWhiteSpace(e.GlobalId) ? "local/" + e.LocalId : "global/" + e.GlobalId))
            {
                var duplicate = identityGroup.Count() > 1;
                foreach (var e in identityGroup)
                {
                    var hasGlobal = !string.IsNullOrWhiteSpace(e.GlobalId);
                    var status = duplicate ? IdentityStatus.Disputed : hasGlobal ? IdentityStatus.Reconciled : IdentityStatus.Provisional;
                    var value = docId.Value + "/" + identityGroup.Key;
                    if (duplicate || !hasGlobal) value += "/delivery/" + options.ContentFingerprint + (duplicate ? "/row/" + e.Id : "");
                    identities[e.Id] = new("object/" + BuildingMapper.Digest(value));
                    var ev = Evidence([sources[e.Id]], "Identity", $"Document-scoped {(hasGlobal ? "global identifier" : "local identifier; delivery only")}: {identityGroup.Key}. Status {status}.");
                    identityEvidence[e.Id] = ev;
                    objects.Add(new(identities[e.Id], status, hasGlobal ? "Global identifier within caller-established document lineage" : "Delivery-scoped local identifier; no cross-revision correspondence", [sources[e.Id]], [ev]));
                    if (status != IdentityStatus.Reconciled)
                        diagnostics.Add(new("identity." + status.ToString().ToLowerInvariant(), identities[e.Id].Value, "Identity", duplicate ? "Duplicate identity remains disputed; rows were not merged." : "No stable global identifier; cross-revision identity remains unresolved."));
                }
            }
        }
    }

    internal BuildingProjection Build(ProjectionBuilder tables, ImmutableArray<DomainMapping> domains)
    {
        var total = model.Tables.Entities.Length;
        diagnostics.Add(new("scope.inventory", options.SourceId, "Entities", $"{total} source entities; {objects.Count} selected occurrences; {total - objects.Count} other/type/category entities outside the registered domains' declared scope."));
        diagnostics.Add(new("mapping.policy", options.SourceId, "Policy", $"{policy.Value}; domains {string.Join(", ", domains.Select(d => d.Name))}; exact normalized aliases and approved groups/kinds; type conflicts retained; no buildings inferred from documents; no finishes inferred from wall area. Numeric storage policy {Storage}; caller assertion, canonical metadata takes precedence."));
        diagnostics.AddRange(model.Tables.Issues.Select(i => new MappingDiagnostic("source." + i.Code, i.EntityId?.ToString(CultureInfo.InvariantCulture) ?? i.Table, i.Table, i.Message)));
        var usedSources = objects.SelectMany(o => o.SourceIdentities).Concat(evidence.SelectMany(e => e.Sources)).ToHashSet();
        var fieldCoverage = coverage.OrderBy(p => p.Key.Kind).ThenBy(p => p.Key.Field).Select(p => new FieldCoverage(p.Key.Kind, p.Key.Field,
            p.Value.Count, p.Value.Count(v => v is null), p.Value.Count(v => v is Availability.NotObserved or Availability.NotExported),
            p.Value.Count(v => v is Availability.Invalid), p.Value.Count(v => v is Availability.Conflicting), p.Value.Count(v => v is Availability.NotApplicable))).ToImmutableArray();
        var policyRecord = new InterpretationPolicy(policy, "Source adapter", BuildingMapper.PolicyVersion, BuildingMapper.Digest(policy.Value),
            $"Numeric storage policy {Storage}, explicitly supplied by caller; canonical numbers take precedence. Exact descriptor aliases, approved groups and parameter kinds. All type-chain alternatives remain evidence; disagreements are unavailable conflicts. Only explicit net surface aliases supply roof surface takeoff. Global identifiers are document scoped; duplicates disputed; local identifiers delivery scoped. Documents are not buildings. Domains: {string.Join(", ", domains.Select(d => d.Name))}.");
        var projection = tables.Apply(new BuildingProjection(new(Snapshot, options.SourceId, "1.0", revisions.Select(r => r.Id).ToImmutableArray(), [policy], options.PreparedAt),
            revisions.ToImmutableArray(), sourceObjects.Where(s => usedSources.Contains(s.Id)).ToImmutableArray(), objects.ToImmutableArray(), evidence.ToImmutableArray(),
            [], [], [], [], [], fieldCoverage, diagnostics.ToImmutableArray(), documents.ToImmutableArray(), [policyRecord]));
        return projection with { Diagnostics = projection.Diagnostics.AddRange(ProjectionValidation.Validate(projection)) };
    }
}
