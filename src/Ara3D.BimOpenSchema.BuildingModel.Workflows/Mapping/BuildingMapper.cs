using System.Collections.Immutable;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Conservative architectural mapping. Unknown stored units and ambiguous quantity bases stay unavailable.</summary>
public static class BuildingMapper
{
    public const string PolicyVersion = "architectural-mapping/1";

    public static BuildingProjection Map(BimModel model, MappingOptions options) => new Mapper(model, options).Run();

    internal static string Digest(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text))).ToLowerInvariant();

    // All mutable buffers are private to one call; only a detached immutable projection escapes.
    [Platonic.TrustedMutableKernel]
    private sealed class Mapper
    {
        private readonly BimModel model;
        private readonly MappingOptions options;
        private readonly ReferenceKey<ModelSnapshot> snapshot;
        private readonly ReferenceKey<InterpretationPolicy> policy;
        private readonly NumericStoragePolicy storage;
        private readonly List<SourceDocument> documents = [];
        private readonly Dictionary<int, ReferenceKey<SourceObject>> sources = [];
        private readonly Dictionary<int, ReferenceKey<BimObject>> identities = [];
        private readonly Dictionary<int, IdentityStatus> statuses = [];
        private readonly Dictionary<int, string> kinds;
        private readonly List<SourceRevision> revisions = [];
        private readonly List<SourceObject> sourceObjects = [];
        private readonly List<BimObject> objects = [];
        private readonly List<Evidence> evidence = [];
        private readonly HashSet<ReferenceKey<Evidence>> evidenceIds = [];
        private readonly Dictionary<int, ImmutableArray<ReferenceKey<Evidence>>> identityEvidence = [];
        private readonly List<MappingDiagnostic> diagnostics = [];
        private readonly Dictionary<(string Kind, string Field), List<Availability?>> coverage = [];
        private readonly Dictionary<int, ImmutableArray<PropertyRow>> properties;

        public Mapper(BimModel model, MappingOptions options)
        {
            if (string.IsNullOrWhiteSpace(options.SourceId) || string.IsNullOrWhiteSpace(options.ContentFingerprint)
                || string.IsNullOrWhiteSpace(options.DocumentScope))
                throw new ArgumentException("Source, content fingerprint and caller-established document scope are required.", nameof(options));
            this.model = model;
            this.options = options;
            storage = options.NumericStorage != NumericStoragePolicy.Unknown ? options.NumericStorage
                : options.NumericValuesUseDeclaredUnits ? NumericStoragePolicy.DeclaredDescriptor : NumericStoragePolicy.Unknown;
            policy = new($"{PolicyVersion}/{storage}");
            snapshot = new("snapshot/" + Digest(options.DocumentScope + "\n" + options.ContentFingerprint + "\n" + policy.Value));
            kinds = model.Tables.Entities.ToDictionary(e => e.Id, Kind);
            properties = model.Tables.Properties.GroupBy(p => p.EntityId).ToDictionary(g => g.Key, g => g.ToImmutableArray());
        }

        private static string Kind(EntityRow e) => e.IsType || e.IsCategory ? "" : TextNormalization.Key(e.Category) switch
        {
            "LEVELS" or "LEVEL" or "STOREYS" or "IFCBUILDINGSTOREY" or "EBENEN" => "Storey",
            "ROOMS" or "ROOM" or "SPACES" or "IFCSPACE" or "RÄUME" => "Space",
            "DOORS" or "DOOR" or "IFCDOOR" or "TÜREN" => "Door",
            "ROOFS" or "ROOF" or "IFCROOF" or "DÄCHER" => "Roof",
            _ => ""
        };

        public BuildingProjection Run()
        {
            InitializeIdentity();
            var storeys = new List<Storey>();
            var spaces = new List<Space>();
            var doors = new List<Door>();
            var roofs = new List<Roof>();
            foreach (var e in model.Tables.Entities.Where(e => kinds[e.Id] != ""))
            {
                var element = Element(e);
                switch (kinds[e.Id])
                {
                    case "Storey":
                        storeys.Add(new(Key<Storey>(e.Id), element, Unknown<SnapshotKey<Building>>(),
                            Text(e, "Number", "Number", "Level Number"), Unknown<int>(),
                            Number(e, "Elevation", "m", x => new Length(x), true, "Elevation", "Rvt:Level:Elevation", "Ifc:Elevation"),
                            Unknown<SnapshotKey<CoordinateFrame>>(), Unknown<StoreyDatumKind>(), Unknown<Length>(), LinkSet<Space>.Unknown()));
                        break;
                    case "Space":
                        spaces.Add(new(Key<Space>(e.Id), element, Text(e, "Number", "Number", "Room Number", "Nummer", "Rvt:Room:Number", "Ifc:Room:Number"),
                            Unknown<SnapshotKey<Building>>(), element.Location.PrimaryStorey,
                            Text(e, "Use", "Occupancy", "Use"), Text(e, "Department", "Department", "Abteilung"),
                            Unknown<SpaceEnclosureKind>(), Number(e, "NetFloorArea", "m2", x => new Area(x), false, "Net Floor Area", "NetFloorArea"),
                            Text(e, "AreaMeasurementStandard", "Area Measurement Standard"),
                            Number(e, "ClearHeight", "m", x => new Length(x), false, "Clear Height"),
                            Number(e, "NetVolume", "m3", x => new Volume(x), false, "Net Volume", "NetVolume"),
                            Unknown<int>(), Unknown<SnapshotKey<GeometryRepresentation>>(), LinkSet<SpaceBoundary>.Unknown(),
                            LinkSet<FinishSurface>.Unknown(), LinkSet<Door>.Unknown()));
                        break;
                    case "Door":
                        doors.Add(new(Key<Door>(e.Id), element, Unknown<ReferenceKey<ProductDefinition>>(), Unknown<SnapshotKey<Opening>>(),
                            element.Location.Spaces, Unknown<DoorOperation>(), Unknown<int>(),
                            Number(e, "NominalWidth", "m", x => new Length(x), false, "Width", "Nominal Width", "Breite"),
                            Number(e, "NominalHeight", "m", x => new Length(x), false, "Height", "Nominal Height", "Höhe"),
                            Number(e, "ClearWidth", "m", x => new Length(x), false, "Clear Width", "Clear Opening Width"),
                            Number(e, "ClearHeight", "m", x => new Length(x), false, "Clear Height", "Clear Opening Height"),
                            FireResistance(e),
                            Unknown<bool>(), Text(e, "HardwareSet", "Hardware Set", "Hardware Set Number"), Unknown<bool>()));
                        break;
                    case "Roof":
                        roofs.Add(new(Key<Roof>(e.Id), element, Unknown<ReferenceKey<AssemblyDefinition>>(), element.Location.PrimaryStorey,
                            Number(e, "NetSurfaceArea", "m2", x => new Area(x), false, "Net Surface Area", "NetSurfaceArea"),
                            Number(e, "ProjectedArea", "m2", x => new Area(x), false, "Projected Area", "ProjectedArea"),
                            Unknown<Angle>(), Unknown<Length>(), Unknown<ThermalTransmittance>(),
                            Unknown<SnapshotKey<QuantityObservation>>(), LinkSet<Opening>.Unknown(), LinkSet<FinishSurface>.Unknown()));
                        break;
                }
                Count(e, "Building", element.Location.Building);
                if (kinds[e.Id] is "Space" or "Roof")
                    Count(e, "FinishSurfaces", Unknown<string>());
                if (kinds[e.Id] is "Roof" or "Space" && Rows(e).Any(p => TextNormalization.Key(p.Name) is "AREA" or "FLÄCHE"))
                    diagnostics.Add(new("quantity.unspecified-basis", identities[e.Id].Value, "Area", "Generic Area is retained in the source cache; its net/surface/deduction basis is not established by its name."));
            }
            var spacesByStorey = spaces.Where(s => s.Storey is Fact<SnapshotKey<Storey>>.Known)
                .GroupBy(s => ((Fact<SnapshotKey<Storey>>.Known)s.Storey).Value).ToDictionary(g => g.Key, g => g.Select(s => s.Id).ToImmutableArray());
            storeys = storeys.Select(s => s with { Spaces = new(spacesByStorey.GetValueOrDefault(s.Id, []), Completeness.Partial, []) }).ToList();
            var doorsBySpace = doors.SelectMany(d => d.AdjacentSpaces.Items.Select(s => (Space: s, Door: d.Id)))
                .GroupBy(x => x.Space).ToDictionary(g => g.Key, g => g.Select(x => x.Door).Distinct().ToImmutableArray());
            spaces = spaces.Select(s => s with { Doors = new(doorsBySpace.GetValueOrDefault(s.Id, []), Completeness.Partial, []) }).ToList();
            diagnostics.Add(new("scope.inventory", options.SourceId, "Entities", $"{model.Tables.Entities.Length} source entities; {objects.Count} selected architectural occurrences; {model.Tables.Entities.Length - objects.Count} other/type/category entities outside this adapter's declared scope."));
            diagnostics.Add(new("mapping.policy", options.SourceId, "Policy", $"{policy.Value}; exact normalized aliases and approved groups/kinds; type conflicts retained; no buildings inferred from documents; no finishes inferred from wall area. Numeric storage policy {storage}; caller assertion, canonical metadata takes precedence."));
            diagnostics.AddRange(model.Tables.Issues.Select(i => new MappingDiagnostic("source." + i.Code, i.EntityId?.ToString(CultureInfo.InvariantCulture) ?? i.Table, i.Table, i.Message)));
            var usedSources = objects.SelectMany(o => o.SourceIdentities).Concat(evidence.SelectMany(e => e.Sources)).ToHashSet();
            var result = new BuildingProjection(new(snapshot, options.SourceId, "1.0", revisions.Select(r => r.Id).ToImmutableArray(), [policy], options.PreparedAt),
                revisions.ToImmutableArray(), sourceObjects.Where(s => usedSources.Contains(s.Id)).ToImmutableArray(), objects.ToImmutableArray(), evidence.ToImmutableArray(),
                storeys.ToImmutableArray(), spaces.ToImmutableArray(), doors.ToImmutableArray(), roofs.ToImmutableArray(), [],
                coverage.OrderBy(p => p.Key.Kind).ThenBy(p => p.Key.Field).Select(p => new FieldCoverage(p.Key.Kind, p.Key.Field,
                    p.Value.Count, p.Value.Count(v => v is null), p.Value.Count(v => v is Availability.NotObserved or Availability.NotExported),
                    p.Value.Count(v => v is Availability.Invalid), p.Value.Count(v => v is Availability.Conflicting), p.Value.Count(v => v is Availability.NotApplicable))).ToImmutableArray(), diagnostics.ToImmutableArray(),
                documents.ToImmutableArray(), [new(policy, "Architectural source adapter", PolicyVersion, Digest(policy.Value),
                    $"Numeric storage policy {storage}, explicitly supplied by caller; canonical numbers take precedence. Exact descriptor aliases, approved groups and parameter kinds. All type-chain alternatives remain evidence; disagreements are unavailable conflicts. Only explicit net surface aliases supply roof surface takeoff. Global identifiers are document scoped; duplicates disputed; local identifiers delivery scoped. Documents are not buildings.")]);
            return result with { Diagnostics = result.Diagnostics.AddRange(ProjectionValidation.Validate(result)) };
        }

        private void InitializeIdentity()
        {
            var neededOwners = new HashSet<int>();
            foreach (var occurrence in model.Tables.Entities.Where(e => kinds[e.Id] != ""))
            {
                int? owner = occurrence.Id;
                while (owner is { } id && neededOwners.Add(id)) owner = model.Tables.Entities[id].TypeId;
            }
            // Document paths/title are locators inside an explicitly supplied lineage, never building identities.
            string DocToken(EntityRow e) => e.DocumentId is { } id
                ? model.Tables.Documents[id].Path ?? model.Tables.Documents[id].Title ?? "unidentified-document/" + id
                : "unassigned-document";
            var documentGroups = model.Tables.Entities.GroupBy(DocToken).ToArray();
            foreach (var group in documentGroups)
            {
                var docId = new ReferenceKey<SourceDocument>("document/" + Digest(options.DocumentScope + "\n" + group.Key));
                documents.Add(new(docId, group.Key, Unknown<string>(), Unknown<string>(),
                    new Fact<string>.Known(group.Key, Assurance.Observed, [])));
                var rev = new ReferenceKey<SourceRevision>("revision/" + Digest(docId.Value + "\n" + options.ContentFingerprint));
                revisions.Add(new(rev, docId, options.SourceId, Unknown<DateTimeOffset>(), options.ContentFingerprint,
                    ExporterFamily.Unknown, Unknown<string>(), []));
                foreach (var e in group)
                {
                    if (!neededOwners.Contains(e.Id)) continue;
                    sources[e.Id] = new("source/" + Digest(rev.Value + "/Entities/" + e.Id));
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
                        identities[e.Id] = new("object/" + Digest(value));
                        statuses[e.Id] = status;
                        var ev = AddEvidence([sources[e.Id]], "Identity", $"Document-scoped {(hasGlobal ? "global identifier" : "local identifier; delivery only")}: {identityGroup.Key}. Status {status}.");
                        identityEvidence[e.Id] = [ev];
                        objects.Add(new(identities[e.Id], status, hasGlobal ? "Global identifier within caller-established document lineage" : "Delivery-scoped local identifier; no cross-revision correspondence", [sources[e.Id]], [ev]));
                        if (status != IdentityStatus.Reconciled)
                            diagnostics.Add(new("identity." + status.ToString().ToLowerInvariant(), identities[e.Id].Value, "Identity", duplicate ? "Duplicate identity remains disputed; rows were not merged." : "No stable global identifier; cross-revision identity remains unresolved."));
                    }
                }
            }
        }

        private ElementInfo Element(EntityRow e)
        {
            var storey = Reference<Storey>(e, "Storey", "Storey", "Level", "Base Level", "Reference Level", "Ebene", "Basisebene", "Rvt:Element:Level");
            var adjacent = SpaceLinks(e);
            var name = string.IsNullOrWhiteSpace(e.Name) ? null : e.Name;
            var mark = Text(e, "Mark", "Mark", "Kennzeichen");
            var ev = identityEvidence[e.Id];
            return new(identities[e.Id], name, mark is Fact<string>.Known k ? k.Value : null, LifecycleState.NotObserved,
                new(Unknown<SnapshotKey<Building>>(), storey, LinkSet<Storey>.Unknown(), adjacent, LinkSet<Zone>.Unknown()),
                Unknown<Placement>(), LinkSet<GeometryRepresentation>.Unknown(), ev);
        }

        private ImmutableArray<PropertyRow> Rows(EntityRow e)
        {
            var rows = ImmutableArray.CreateBuilder<PropertyRow>();
            var seen = new HashSet<int>();
            int? id = e.Id;
            while (id is { } current && seen.Add(current))
            {
                rows.AddRange(properties.GetValueOrDefault(current, []));
                id = model.Tables.Entities[current].TypeId;
            }
            if (id is not null) diagnostics.Add(new("type.cycle", identities[e.Id].Value, "Type", "Type inheritance cycle stopped; values encountered remain visible."));
            return rows.ToImmutable();
        }

        private static bool ApprovedGroup(string? group) => TextNormalization.Key(group) is
            "" or "IDENTITY DATA" or "DIMENSIONS" or "CONSTRAINTS" or "DATA" or "GEOMETRY" or "TEXT"
            or "ROOMS" or "ROOM" or "OTHER" or "PSET_DOORCOMMON" or "PSET_SPACECOMMON" or "QTO_ROOFBASEQUANTITIES"
            or "QTO_SPACEBASEQUANTITIES" or "QTO_DOORBASEQUANTITIES" or "IFCBUILDINGSTOREY"
            or "IDENTITÄTSDATEN" or "ABMESSUNGEN" or "ABHÄNGIGKEITEN";

        private ImmutableArray<PropertyRow> Select(EntityRow e, ParameterType kind, string[] aliases)
        {
            var names = aliases.Select(TextNormalization.Key).ToHashSet();
            return Rows(e).Where(p => names.Contains(TextNormalization.Key(p.Name))
                && (ApprovedGroup(p.Group) || p.Name?.StartsWith("Rvt:", StringComparison.Ordinal) == true || p.Name == "Ifc:Room:Number")
                && p.Key.Kind == kind).ToImmutableArray();
        }

        private Fact<string> Text(EntityRow e, string field, params string[] aliases)
            => Resolve(e, field, Select(e, ParameterType.String, aliases), p => string.IsNullOrWhiteSpace(p.TextValue)
                ? Fact<string>.Unknown("Source text is empty.") : new Fact<string>.Known(p.TextValue, Assurance.Observed, []));

        private Fact<DurationValue> FireResistance(EntityRow e)
            => Resolve(e, "FireResistance", Select(e, ParameterType.String, ["Fire Rating", "Fire Resistance"]), p =>
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

        private Fact<T> Number<T>(EntityRow e, string field, string unit, Func<double, T> wrap, bool signed, params string[] aliases)
            => Resolve(e, field, Select(e, ParameterType.Number, aliases), p =>
            {
                var value = p.CanonicalNumber;
                var canonicalUnit = p.CanonicalUnits;
                if (value is null && storage == NumericStoragePolicy.RevitInternal && p.NumberValue is { } internalValue && unit is "m" or "m2" or "m3")
                {
                    value = internalValue * (unit == "m" ? 0.3048 : unit == "m2" ? 0.09290304 : 0.028316846592);
                    canonicalUnit = unit;
                }
                if (value is null && storage == NumericStoragePolicy.DeclaredDescriptor && p.NumberValue is { } stored)
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

        private Fact<SnapshotKey<T>> Reference<T>(EntityRow e, string field, params string[] aliases)
            => Resolve<SnapshotKey<T>>(e, field, Select(e, ParameterType.Entity, aliases), p => p.ReferenceEntityId is { } id && kinds[id] == typeof(T).Name
                ? new Fact<SnapshotKey<T>>.Known(Key<T>(id), Assurance.Observed, [])
                : new Fact<SnapshotKey<T>>.Missing(Availability.Invalid, "Source reference target is outside the expected typed occurrence table.", []));

        private LinkSet<Space> SpaceLinks(EntityRow e)
        {
            var rows = Select(e, ParameterType.Entity, ["From Room", "To Room", "Room", "Space", "FromRoom", "ToRoom", "Von Raum", "Nach Raum",
                "Rvt:FamilyInstance:FromRoom", "Rvt:FamilyInstance:ToRoom", "Rvt:FamilyInstance:Room"]);
            var values = ImmutableArray.CreateBuilder<SnapshotKey<Space>>();
            var evs = ImmutableArray.CreateBuilder<ReferenceKey<Evidence>>();
            var invalid = false;
            foreach (var p in rows)
            {
                evs.Add(PropertyEvidence(p));
                if (p.IsValid && !p.IsMissing && p.ReferenceEntityId is { } id && kinds[id] == "Space") values.Add(Key<Space>(id));
                else if (!p.IsMissing)
                {
                    invalid = true;
                    diagnostics.Add(new("reference.invalid-target", identities[e.Id].Value, "Spaces", "Room association does not resolve to a selected Space occurrence."));
                }
            }
            Count(e, "Spaces", invalid ? new Fact<string>.Missing(Availability.Invalid, "Invalid room reference.", [])
                : values.Count > 0 ? new Fact<string>.Known("Observed members", Assurance.Observed, []) : Unknown<string>());
            return new(values.Distinct().ToImmutableArray(), rows.Length == 0 ? Completeness.NotObserved : Completeness.Partial, evs.ToImmutable());
        }

        private Fact<T> Resolve<T>(EntityRow e, string field, ImmutableArray<PropertyRow> rows, Func<PropertyRow, Fact<T>> convert)
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
                diagnostics.Add(new("field." + m.Reason.ToString().ToLowerInvariant(), identities[e.Id].Value, field, m.Explanation));
            return result;
        }

        private ReferenceKey<Evidence> PropertyEvidence(PropertyRow p)
        {
            var id = new ReferenceKey<Evidence>("evidence/" + Digest(snapshot.Value + "/property/" + p.Id));
            if (!evidenceIds.Add(id)) return id;
            evidence.Add(new(id, EvidenceOrigin.Source, [sources[p.EntityId]], [], new Fact<ReferenceKey<InterpretationPolicy>>.Known(policy, Assurance.Derived, []),
                PolicyVersion, $"Parameters row {p.Id}; owner Entities row {p.EntityId}; descriptor {p.DescriptorId}; {p.Group}/{p.Name}; kind {p.Key.Kind}; units '{p.Units}'; stored text '{p.TextValue}', number '{p.NumberValue?.ToString("R", CultureInfo.InvariantCulture)}', integer '{p.IntegerValue}', reference '{p.ReferenceEntityId}'; valid={p.IsValid}; missing={p.IsMissing}."));
            return id;
        }

        private ReferenceKey<Evidence> AddEvidence(ImmutableArray<ReferenceKey<SourceObject>> refs, string method, string explanation)
        {
            var id = new ReferenceKey<Evidence>("evidence/" + Digest(snapshot.Value + "/" + string.Join("|", refs) + "/" + method));
            evidence.Add(new(id, EvidenceOrigin.Source, refs, [], new Fact<ReferenceKey<InterpretationPolicy>>.Known(policy, Assurance.Derived, []), PolicyVersion + "/" + method, explanation));
            return id;
        }

        private void Count<T>(EntityRow e, string field, Fact<T> fact)
        {
            var key = (kinds[e.Id], field);
            if (!coverage.TryGetValue(key, out var list)) coverage.Add(key, list = []);
            list.Add(fact is Fact<T>.Missing m ? m.Reason : null);
        }

        private SnapshotKey<T> Key<T>(int id) => new(snapshot, identities[id].Value);
        private static Fact<T> Unknown<T>() => Fact<T>.Unknown("Not established by this source adapter.");
    }
}
