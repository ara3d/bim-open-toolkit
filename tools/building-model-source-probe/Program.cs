using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using Ara3D.BimOpenSchema.BuildingModel.Source;

if (args.Length != 3) throw new ArgumentException("Usage: source-probe <source.bos> <cache.bfast> <report.json>");
var timer = Stopwatch.StartNew();
var metadata = SourceCache.Prepare(args[0], args[1]);
var prepareSeconds = timer.Elapsed.TotalSeconds;
Console.WriteLine($"Prepared {args[1]} in {prepareSeconds:F3}s; {metadata.Columns.Count} column chunks.");
timer.Restart();
var model = SourceCache.Load(args[1]);
var loadSeconds = timer.Elapsed.TotalSeconds;
var tables = model.Tables;
var propertiesByDescriptor = tables.Properties.ToLookup(p => p.DescriptorId);
var interesting = new Regex("room|door|roof|level|wall|finish|area|width|height|volume|fire|raum|tür|dach|ebene|fläche|wand|geschoss", RegexOptions.IgnoreCase);
var descriptors = tables.Descriptors.Where(d => interesting.IsMatch(d.Name ?? "")).Select(d => new
{
    d.Id, d.Name, d.Group, d.Units, Kind = d.Kind.ToString(),
    Count = propertiesByDescriptor[d.Id].Count(),
    Samples = propertiesByDescriptor[d.Id].Take(4).Select(p => new
    { p.EntityId, Entity = tables.Entities[p.EntityId].Name, tables.Entities[p.EntityId].Category, p.NumberValue, p.IntegerValue, p.TextValue, p.ReferenceEntityId,
        Target = p.ReferenceEntityId is {} target ? tables.Entities[target].Name : null, p.CanonicalUnits, p.IsValid, p.IsMissing }).ToArray()
}).ToArray();
var report = new
{
    metadata.SourcePath, metadata.SourceSha256, metadata.SourceBytes, CacheBytes = new FileInfo(args[1]).Length,
    metadata.CacheVersion, metadata.SourceManifestJson, PrepareSeconds = prepareSeconds, CoreLoadSeconds = loadSeconds,
    PeakWorkingSetBytes = Process.GetCurrentProcess().PeakWorkingSet64,
    Counts = new { Entities = tables.Entities.Length, Descriptors = tables.Descriptors.Length, Properties = tables.Properties.Length,
        Edges = tables.Edges.Length, Geometry = tables.Geometry.Length, Instances = tables.Instances.Length, Issues = tables.Issues.Length },
    tables.Metadata, tables.Documents,
    IdentityCoverage = new { WithGlobalId = tables.Entities.Count(e => !string.IsNullOrWhiteSpace(e.GlobalId)),
        WithDocument = tables.Entities.Count(e => e.DocumentId.HasValue), Total = tables.Entities.Length },
    EntitySamples = tables.Entities.Where(e => !e.IsType && !e.IsCategory && interesting.IsMatch(e.Category ?? ""))
        .GroupBy(e => e.Category).SelectMany(g => g.Take(2)).Select(e => new { e.Id, e.Name, e.Category, e.LocalId, e.GlobalId, e.DocumentId, e.DocumentTitle }).ToArray(),
    Categories = tables.Entities.GroupBy(e => e.Category).OrderByDescending(g => g.Count()).Select(g => new { Name = g.Key, Count = g.Count(), Examples = g.Take(3).Select(e => e.Name).ToArray() }).ToArray(),
    Descriptors = descriptors,
    Relations = tables.Edges.GroupBy(e => (e.Kind, e.Origin)).Select(g => new { g.Key.Kind, Origin = g.Key.Origin.ToString(), Count = g.Count() }).ToArray(),
    Issues = tables.Issues.GroupBy(i => i.Code).Select(g => new { Code = g.Key, Count = g.Count(), Example = g.First().Message }).ToArray(),
    Columns = metadata.Columns.Select(c => new { c.Table, c.Name, c.Count, c.Bytes, c.IsGeometry, c.TypeName }).ToArray()
};
Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(args[2]))!);
File.WriteAllText(args[2], JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
Console.WriteLine($"Core load {loadSeconds:F3}s; {tables.Entities.Length} entities, {tables.Properties.Length} properties; peak {Process.GetCurrentProcess().PeakWorkingSet64 / 1048576.0:F1} MiB. Report {args[2]}");
