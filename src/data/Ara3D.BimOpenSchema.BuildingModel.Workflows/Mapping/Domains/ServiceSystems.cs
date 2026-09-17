using System.Collections.Immutable;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>ServiceSystem rows, system membership and the unit readers shared by the Hvac and Plumbing domains.
/// A duct's or pipe's "System Type" parameter names the system <i>type</i> element, not the mapped system occurrence,
/// so membership is joined on the exact "System Name" text that the occurrence and the system both carry.</summary>
public static class ServiceSystems
{
    /// <summary>The one descriptor both sides of the membership join carry.</summary>
    public const string NameAlias = "System Name";

    // Flow, pressure, power, sound level and temperature have no documented Revit-internal factor in this kernel; the
    // unit keys below are unfamiliar to it on purpose, so the fact stays unavailable rather than guessed.
    public static Fact<FlowRate> ReadFlow(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Number(e, field, "m3/s", x => new FlowRate(x), false, aliases);

    public static Fact<Pressure> ReadPressure(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Number(e, field, "Pa", x => new Pressure(x), false, aliases);

    public static Fact<Power> ReadPower(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Number(e, field, "W", x => new Power(x), false, aliases);

    public static Fact<SoundLevel> ReadSound(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Number(e, field, "dB", x => new SoundLevel(x), false, aliases);

    public static Fact<Temperature> ReadTemperature(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Number(e, field, "K", x => new Temperature(x), false, aliases);

    /// <summary>A system row. It has no element identity or storey/space context, and its discipline is fixed only when
    /// the classification text equals a ServiceDiscipline member name once its spaces are removed.</summary>
    public static ServiceSystem Build(MappingKernel k, EntityRow e)
    {
        var classification = k.Text(e, "Classification", "System Classification");
        var discipline = classification is Fact<string>.Known known
            && Enum.TryParse<ServiceDiscipline>(known.Value.Replace(" ", ""), out var parsed) && parsed != ServiceDiscipline.Unknown
            ? parsed : ServiceDiscipline.Unknown;
        return new(k.Key<ServiceSystem>(e), Name(e), discipline,
            MappingKernel.Unknown<string>(),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            MappingKernel.Unknown<Temperature>(),
            ReadPressure(k, e, "DesignPressure", "Static Pressure"),
            LinkSet<Space>.Unknown(), LinkSet<ServicePort>.Unknown(),
            k.IdentityEvidence(e.Id));
    }

    // A persisted name must not bake in a positional export row index, so the delivery's own identifier stands in.
    private static string Name(EntityRow e)
        => !string.IsNullOrWhiteSpace(e.Name) ? e.Name
            : "System " + (string.IsNullOrWhiteSpace(e.GlobalId) ? "local/" + e.LocalId : e.GlobalId);

    /// <summary>Exact "System Name" text of every mapped system in the given source categories, to its key.
    /// A name two systems share identifies neither of them, so it is left out.</summary>
    public static ImmutableDictionary<string, SnapshotKey<ServiceSystem>> Index(MappingKernel k, params string[] categories)
    {
        var claimed = categories.Select(TextNormalization.Key).ToHashSet();
        return k.Selected.Where(e => k.Kind(e.Id) == nameof(ServiceSystem) && claimed.Contains(TextNormalization.Key(e.Category)))
            .SelectMany(e => Names(k, e).Select(name => (Name: name, Key: k.Key<ServiceSystem>(e))))
            .GroupBy(x => x.Name)
            .Where(g => g.Select(x => x.Key).Distinct().Count() == 1)
            .ToImmutableDictionary(g => g.Key, g => g.First().Key);
    }

    private static IEnumerable<string> Names(MappingKernel k, EntityRow e)
        => k.Select(e, ParameterType.String, NameAlias).Select(p => TextNormalization.Key(p.TextValue)).Where(n => n != "").Distinct();

    /// <summary>The system each selected occurrence of the given record kinds belongs to, keyed by object identity.
    /// A name no mapped system carries is not observed; it is never an invalid reference.</summary>
    public static ImmutableDictionary<ReferenceKey<BimObject>, Fact<SnapshotKey<ServiceSystem>>> SystemIds(
        MappingKernel k, ImmutableDictionary<string, SnapshotKey<ServiceSystem>> systems, params string[] kinds)
    {
        var wanted = kinds.ToHashSet(StringComparer.Ordinal);
        return k.Selected.Where(e => wanted.Contains(k.Kind(e.Id)))
            .ToImmutableDictionary(e => k.Identity(e.Id), e => SystemId(k, e, systems));
    }

    private static Fact<SnapshotKey<ServiceSystem>> SystemId(MappingKernel k, EntityRow e,
        ImmutableDictionary<string, SnapshotKey<ServiceSystem>> systems)
        => k.Resolve<SnapshotKey<ServiceSystem>>(e, "SystemId", k.Select(e, ParameterType.String, NameAlias), p =>
        {
            var name = TextNormalization.Key(p.TextValue);
            return name == "" ? Fact<SnapshotKey<ServiceSystem>>.Unknown("System name is empty.")
                : systems.TryGetValue(name, out var key) ? new Fact<SnapshotKey<ServiceSystem>>.Known(key, Assurance.Observed, [])
                : Fact<SnapshotKey<ServiceSystem>>.Unknown("No mapped system carries this exact system name.");
        });

    /// <summary>A single-system link set for records that hold their systems as links rather than one reference.</summary>
    public static LinkSet<ServiceSystem> Links(Fact<SnapshotKey<ServiceSystem>> systemId)
        => systemId is Fact<SnapshotKey<ServiceSystem>>.Known known
            ? MappingKernel.Observed<ServiceSystem>([known.Value], known.Evidence)
            : LinkSet<ServiceSystem>.Unknown();

    /// <summary>One membership row per element with a resolved system, carrying the element's own identity evidence.</summary>
    public static void Memberships(MappingKernel k, ProjectionBuilder b,
        IEnumerable<(ElementInfo Element, Fact<SnapshotKey<ServiceSystem>> SystemId)> rows)
    {
        foreach (var (element, systemId) in rows)
        {
            if (systemId is not Fact<SnapshotKey<ServiceSystem>>.Known known) continue;
            var id = new SnapshotKey<SystemMembership>(k.Snapshot, "membership/" + BuildingMapper.Digest(known.Value.Value + "/" + element.ObjectId.Value));
            b.Add(new SystemMembership(id, known.Value, element.ObjectId, MappingKernel.Unknown<string>(), element.Evidence.Single()));
        }
    }
}
