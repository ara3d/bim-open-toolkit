using System.Collections.Immutable;
using System.Security.Cryptography;
using System.Text;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Conservative source mapping. Each registered domain claims source categories and builds typed rows through one
/// shared kernel; unknown stored units and ambiguous quantity bases stay unavailable.</summary>
public static class BuildingMapper
{
    public const string PolicyVersion = "architectural-mapping/1";

    /// <summary>Registered domains. Every category key is claimed by exactly one domain; Rules checks this.</summary>
    public static ImmutableArray<DomainMapping> Domains { get; } =
    [
        CoreMapping.Domain, EnvelopeMapping.Domain, CirculationMapping.Domain, StructureMapping.Domain, PlacesMapping.Domain,
        HvacMapping.Domain, PlumbingMapping.Domain, ElectricalMapping.Domain, DefinitionsMapping.Domain
    ];

    public static BuildingProjection Map(BimModel model, MappingOptions options) => Map(model, options, Domains);

    public static BuildingProjection Map(BimModel model, MappingOptions options, ImmutableArray<DomainMapping> domains)
    {
        var rules = Rules(domains);
        var kernel = new MappingKernel(model, options, e => !e.IsType && !e.IsCategory && rules.TryGetValue(TextNormalization.Key(e.Category), out var rule) ? rule.Kind : "");
        var builder = new ProjectionBuilder();
        foreach (var e in kernel.Selected)
        {
            var (kind, domain) = rules[TextNormalization.Key(e.Category)];
            kernel.Bind(domain);
            domain.Map(kernel, e, kind, builder);
        }
        foreach (var domain in domains)
        {
            kernel.Bind(domain);
            domain.Complete?.Invoke(kernel, builder);
        }
        return kernel.Build(builder, domains);
    }

    /// <summary>Normalized category key to (kind, owning domain). A category claimed twice, or a kind without a projection
    /// table, is a contract error rather than a silent override.</summary>
    public static ImmutableDictionary<string, (string Kind, DomainMapping Domain)> Rules(ImmutableArray<DomainMapping> domains)
    {
        var claims = domains.SelectMany(d => d.Rules.Select(r => (Key: TextNormalization.Key(r.Category), r.Kind, Domain: d))).ToArray();
        var duplicates = claims.GroupBy(c => c.Key).Where(g => g.Count() > 1)
            .Select(g => $"{g.Key} ({string.Join(", ", g.Select(c => c.Domain.Name))})").ToArray();
        if (duplicates.Length > 0) throw new InvalidOperationException("Categories claimed by more than one domain: " + string.Join("; ", duplicates));
        var tables = ProjectionTables.All.Select(t => t.RecordType.Name).ToHashSet(StringComparer.Ordinal);
        var unknown = claims.Where(c => !tables.Contains(c.Kind)).Select(c => $"{c.Kind} ({c.Domain.Name})").Distinct().ToArray();
        if (unknown.Length > 0) throw new InvalidOperationException("Kinds without a projection table: " + string.Join("; ", unknown));
        return claims.ToImmutableDictionary(c => c.Key, c => (c.Kind, c.Domain));
    }

    internal static string Digest(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text))).ToLowerInvariant();
}
