using System.Collections.Immutable;
using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using Ara3D.BimOpenSchema.BuildingModel;
using Ara3D.BimOpenSchema.BuildingModel.Source;
using Ara3D.BimOpenSchema.BuildingModel.Workflows;
using Ara3D.BimOpenSchema.BuildingModel.Workflows.IO;
using Ara3D.BimOpenSchema.BuildingModel.Workflows.Operations;
using Platonic;

namespace BuildingModel.Workflows.Cli;

[Impure]
internal static class Program
{
    private static int Main(string[] args)
    {
        try
        {
            if (args.Length == 0) return Usage();
            switch (args[0])
            {
                case "prepare" when args.Length == 3:
                    Console.WriteLine(JsonSerializer.Serialize(SourceCache.Prepare(args[1], args[2]), ProjectionStore.Options()));
                    return 0;
                case "run" when args.Length is 3 or 4:
                    var policy = args.Length == 3 ? NumericStoragePolicy.Unknown : args[3] switch
                    {
                        "--declared-units" => NumericStoragePolicy.DeclaredDescriptor,
                        "--revit-internal" => NumericStoragePolicy.RevitInternal,
                        _ => throw new ArgumentException("Unknown storage policy option.")
                    };
                    Run(args[1], args[2], policy);
                    return 0;
                case "reopen" when args.Length == 3:
                    Reopen(args[1], args[2]);
                    return 0;
                case "portfolio" when args.Length >= 3:
                    Portfolio(args[1], args.Skip(2).ToArray());
                    return 0;
                case "compare" when args.Length is 4 or 5:
                    if (args.Length == 5 && args[4] != "--complete-scope") return Usage();
                    Compare(args[1], args[2], args[3], args.Length == 5);
                    return 0;
                case "calculate" when args.Length == 4:
                    Calculate(args[1], args[2], args[3]);
                    return 0;
                default: return Usage();
            }
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"{exception.GetType().Name}: {exception.Message}");
            return 1;
        }
    }

    private static int Usage()
    {
        Console.Error.WriteLine("Commands: prepare <source.bos> <cache.bfast> | run <cache.bfast> <output-directory> [--declared-units|--revit-internal] | reopen <projection.json> <output-directory> | portfolio <output-directory> <projection.json> [...] | compare <before.json> <after.json> <output-directory> [--complete-scope]");
        Console.Error.WriteLine("BFAST preparation is explicit; run/reopen never read or decode the original BOS. --declared-units asserts stored numeric units, not merely display units.");
        Console.Error.WriteLine("Supplemental workflows: calculate <estimate|reconcile|trace|coordinate|maintain|carbon> <request.json> <result.json>");
        return 2;
    }

    private static void Run(string cache, string directory, NumericStoragePolicy storagePolicy)
    {
        Directory.CreateDirectory(directory);
        var timer = Stopwatch.StartNew();
        var metadata = SourceCache.Inspect(cache);
        var source = SourceCache.Load(cache);
        var loadSeconds = timer.Elapsed.TotalSeconds;
        var projection = BuildingMapper.Map(source, new MappingOptions(metadata.SourceSha256,
            "sha256:" + metadata.SourceSha256, Path.GetFileNameWithoutExtension(metadata.SourcePath),
            DateTimeOffset.UtcNow, NumericStorage: storagePolicy));
        var projectionSeconds = timer.Elapsed.TotalSeconds - loadSeconds;
        var reports = Reports(projection);
        var firstQuerySeconds = timer.Elapsed.TotalSeconds;
        using (var destination = File.Create(Path.Combine(directory, "projection.json")))
            ProjectionStore.Write(projection, destination);
        WriteReports(directory, projection, reports);
        WriteJson(Path.Combine(directory, "source-inventory.json"), new
        {
            metadata.SourcePath, metadata.SourceSha256,
            SourceEntities = source.Tables.Entities.Length,
            SourceDocuments = source.Tables.Documents.Length,
            SourceProperties = source.Tables.Properties.Length,
            SourceEdges = source.Tables.Edges.Length,
            Categories = source.Tables.Entities.Where(x => !x.IsType && !x.IsCategory)
                .GroupBy(x => x.Category ?? "(unclassified)").OrderByDescending(x => x.Count())
                .Select(x => new { Category = x.Key, Count = x.Count() }).ToArray(),
            SourceIssues = source.Tables.Issues.GroupBy(x => x.Code).Select(x => new { Code = x.Key, Count = x.Count() }).ToArray()
        });
        WriteMetrics(directory, "bfast-load-map-query", loadSeconds, projectionSeconds, firstQuerySeconds,
            new FileInfo(cache).Length);
        Console.WriteLine($"{metadata.SourcePath}: {projection.Storeys.Length} storeys, {projection.Spaces.Length} spaces, {projection.Doors.Length} doors, {projection.Roofs.Length} roofs; BFAST load/map/query {firstQuerySeconds:F3}s. Results: {Path.GetFullPath(directory)}");
    }

    private static void Reopen(string path, string directory)
    {
        Directory.CreateDirectory(directory);
        var timer = Stopwatch.StartNew();
        BuildingProjection projection;
        using (var stream = File.OpenRead(path)) projection = ProjectionStore.Read(stream);
        var load = timer.Elapsed.TotalSeconds;
        var reports = Reports(projection);
        var query = timer.Elapsed.TotalSeconds;
        WriteReports(directory, projection, reports);
        WriteMetrics(directory, "prepared-projection-open-query", load, 0, query, new FileInfo(path).Length);
        Console.WriteLine($"Prepared projection opened and queried in {query:F3}s. Results: {Path.GetFullPath(directory)}");
    }

    private static ImmutableArray<WorkflowReport> Reports(BuildingProjection projection)
        => [ArchitecturalWorkflows.Schedule(projection),
            WorkflowReports.Missing("02", "Revision comparison", projection.Snapshot.Id.Value,
                "A second revision of the same source lineage and a correspondence policy are required. The three supplied files are not treated as revisions of each other."),
            ArchitecturalWorkflows.Takeoff(projection),
            .. OperationsWorkflows.InputRequirements(projection),
            PortfolioWorkflows.Compare([projection])];

    private static void Portfolio(string directory, string[] files)
    {
        Directory.CreateDirectory(directory);
        var projections = files.Select(file =>
        {
            using var input = File.OpenRead(file);
            return ProjectionStore.Read(input);
        }).ToImmutableArray();
        var report = PortfolioWorkflows.Compare(projections);
        WriteJson(Path.Combine(directory, "portfolio.json"), report);
        File.WriteAllText(Path.Combine(directory, "portfolio.csv"), Csv(report), Encoding.UTF8);
        Console.WriteLine($"Portfolio coverage for {projections.Length} source datasets: {Path.GetFullPath(directory)}");
    }

    private static void Compare(string beforeFile, string afterFile, string directory, bool completeScope)
    {
        using var beforeInput = File.OpenRead(beforeFile);
        using var afterInput = File.OpenRead(afterFile);
        var before = ProjectionStore.Read(beforeInput);
        var after = ProjectionStore.Read(afterInput);
        var report = ArchitecturalWorkflows.Compare(before, after, completeScope);
        Directory.CreateDirectory(directory);
        WriteJson(Path.Combine(directory, "comparison.json"), report);
        File.WriteAllText(Path.Combine(directory, "comparison.csv"), Csv(report), Encoding.UTF8);
        Console.WriteLine($"Revision comparison: {report.Status}, {report.Rows.Length} rows.");
    }

    private static void Calculate(string workflow, string input, string output)
    {
        object result = workflow switch
        {
            "estimate" => OperationsWorkflows.Estimate(ReadRequest<EstimateRequest>(input)),
            "reconcile" => OperationsWorkflows.Reconcile(ReadRequest<ReconciliationRequest>(input)),
            "trace" => OperationsWorkflows.Trace(ReadRequest<TraceRequest>(input)),
            "coordinate" => OperationsWorkflows.Coordinate(ReadRequest<CoordinationRequest>(input)),
            "maintain" => OperationsWorkflows.Maintain(ReadRequest<MaintenanceRequest>(input)),
            "carbon" => OperationsWorkflows.Carbon(ReadRequest<CarbonRequest>(input)),
            _ => throw new ArgumentException("Unknown supplemental workflow.")
        };
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output))!);
        WriteJson(output, result);
        Console.WriteLine($"Calculated {workflow} from explicit supplemental inputs. Result: {Path.GetFullPath(output)}");
    }

    private static T ReadRequest<T>(string path)
    {
        using var input = File.OpenRead(path);
        return JsonSerializer.Deserialize<T>(input, ProjectionStore.Options())
            ?? throw new InvalidDataException("Supplemental request is empty.");
    }

    private static void WriteReports(string directory, BuildingProjection projection, ImmutableArray<WorkflowReport> reports)
    {
        WriteJson(Path.Combine(directory, "workflows.json"), reports);
        WriteJson(Path.Combine(directory, "coverage.json"), projection.Coverage);
        WriteJson(Path.Combine(directory, "diagnostics.json"), projection.Diagnostics);
        foreach (var report in reports)
        {
            var name = new string(report.Id.Select(c => char.IsLetterOrDigit(c) || c == '-' ? c : '_').ToArray());
            File.WriteAllText(Path.Combine(directory, name + ".csv"), Csv(report), Encoding.UTF8);
        }
        var summary = new StringBuilder("# Building workflow results\n\n");
        summary.AppendLine($"Snapshot: `{projection.Snapshot.Id.Value}`. The source BFAST cache retains the original observations and geometry.");
        summary.AppendLine("\nThese are source-supported schedules and readiness findings. Supplemental fixtures are tested separately and are not imported facts.\n");
        summary.AppendLine("| Workflow | Status | Rows |\n|---|---|---:|");
        foreach (var report in reports)
            summary.AppendLine($"| {report.Id} {report.Title} | {report.Status} | {report.Rows.Length} |");
        foreach (var report in reports)
        {
            summary.AppendLine($"\n## {report.Id}: {report.Title}\n\n{report.Scope}\n");
            foreach (var finding in report.Findings) summary.AppendLine("- " + finding);
        }
        File.WriteAllText(Path.Combine(directory, "README.md"), summary.ToString(), Encoding.UTF8);
    }

    private static string Csv(WorkflowReport report)
        => string.Join("\r\n", new[] { report.Columns }.Concat(report.Rows)
            .Select(row => string.Join(",", row.Select(cell => "\"" + cell.Replace("\"", "\"\"") + "\"")))) + "\r\n";

    private static void WriteJson<T>(string path, T value)
    {
        using var output = File.Create(path);
        JsonSerializer.Serialize(output, value, ProjectionStore.Options());
    }

    private static void WriteMetrics(string directory, string operation, double load, double map, double query, long bytes)
    {
        using var process = Process.GetCurrentProcess();
        process.Refresh();
        WriteJson(Path.Combine(directory, "metrics.json"), new
        {
            Operation = operation, InputBytes = bytes, LoadSeconds = load, MappingSeconds = map,
            OpenAndFirstQuerySeconds = query, PeakWorkingSetBytes = process.PeakWorkingSet64,
            PeakVirtualMemoryBytes = process.PeakVirtualMemorySize64,
            ManagedAllocatedBytes = GC.GetTotalAllocatedBytes(),
            MeetsTenSecondOpeningTarget = query <= 10,
            MeetsSixteenGiBProcessWorkingSetTarget = process.PeakWorkingSet64 <= 16L * 1024 * 1024 * 1024,
            Measurement = "Fresh CLI process; OS file cache uncontrolled; peak working set includes resident mapped pages; no workers; source BOS preparation excluded."
        });
    }
}
