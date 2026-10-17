using System.Diagnostics;
using Ara3D.Geometry.AST;
using Ara3D.Geometry.Compiler;
using Ara3D.Geometry.Compiler.Analysis;
using Ara3D.Geometry.Compiler.Checking;
using Ara3D.Geometry.Navigation;
using Ara3D.Utils;

// Usage: PlatoGate <plato-repo> <design-folder> [--exclude <stdlib file name> ...]
// Compiles <plato-repo>/stdlib/{foundation,geometry,graphics} (top level) plus every *.plato under
// <design-folder> (recursive, *.spec.plato excluded) as ONE program, then runs the plato_check
// gates. Prints findings located in <design-folder> only. Exit 1 on any error in scope.
var timer = Stopwatch.StartNew();
var plato = args[0];
var design = Path.GetFullPath(args[1]);
var excluded = args.SkipWhile(a => a != "--exclude").Skip(1).ToHashSet(StringComparer.OrdinalIgnoreCase);
var files = new List<FilePath>();
foreach (var tier in new[] { "foundation", "geometry", "graphics" })
    files.AddRange(Directory.GetFiles(Path.Combine(plato, "stdlib", tier), "*.plato")
        .Where(f => !excluded.Contains(Path.GetFileName(f))).Select(f => new FilePath(f)));
var designFiles = Directory.GetFiles(design, "*.plato", SearchOption.AllDirectories)
    .Where(f => !f.EndsWith(".spec.plato", StringComparison.OrdinalIgnoreCase)).ToList();
files.AddRange(designFiles.Select(f => new FilePath(f)));
Console.WriteLine($"files: {files.Count} ({designFiles.Count} in design folder; {excluded.Count} stdlib file(s) excluded)");

bool InScope(string path) => !string.IsNullOrEmpty(path)
    && Path.GetFullPath(path).StartsWith(design, StringComparison.OrdinalIgnoreCase);
string Rel(string path) => Path.GetRelativePath(design, Path.GetFullPath(path));
var errors = 0;

var snapshot = SourceSnapshot.FromFiles(files);
var cache = new ParseCache();
var parsed = CheckSupport.Parse(snapshot, cache);
foreach (var p in parsed.Where(p => !p.Parsed || p.ParseErrors.Count > 0))
{
    errors++;
    foreach (var e in p.ParseErrors)
        Console.WriteLine($"PARSE {p.File.Path}: {e}");
    if (p.ParseErrors.Count == 0) Console.WriteLine($"PARSE {p.File.Path}: no AST");
}
if (errors > 0) { Console.WriteLine($"FAIL parse ({timer.Elapsed.TotalSeconds:F1}s)"); return 1; }

var comp = CheckSupport.Compile(parsed);
foreach (var e in comp.SymbolFactory?.Errors ?? new())
{
    errors++;
    var r = e.Node?.GetRange();
    var where = r != null ? $"{Rel(r.FilePath.ToString())}({r.BeginLineIndex + 1})" : "?";
    Console.WriteLine($"RESOLVE {where}: {e.Message}");
}
foreach (var m in comp.InternalErrors) { errors++; Console.WriteLine($"INTERNAL {m.Split('\n')[0]}"); }
foreach (var m in comp.SemanticErrors) Console.WriteLine($"SEMANTIC {m}");
if (!comp.CompletedCompilation) { Console.WriteLine($"FAIL resolve ({timer.Elapsed.TotalSeconds:F1}s)"); return 1; }

var linter = new Linter(comp);
foreach (var f in linter.SortedFindings.Where(f => InScope(f.File)))
{
    // LINT001 is a Warning to the CLI, but SEMANTICS.md says to treat it as an error when authoring.
    if (f.Severity == LintSeverity.Error || f.Code == "LINT001") errors++;
    Console.WriteLine($"LINT {Rel(f.File)}({f.Line}) {f.Code} [{f.Severity}] {f.Message}");
}

var results = new TypeChecker(comp).CheckAll();
foreach (var r in results.Where(r => !r.Succeeded))
    foreach (var d in r.Errors)
    {
        // Scope by the function under check: a diagnostic's origin may sit in the stdlib.
        var fnode = comp.GetAstNode(r.Function)
            ?? (r.Function?.OwnerType?.Methods.FirstOrDefault(m => m.Function == r.Function) is { } m ? comp.GetAstNode(m) : null);
        var frange = fnode?.GetRange();
        var onode = d.Origin != null ? comp.GetAstNode(d.Origin) : null;
        var orange = onode?.GetRange();
        var range = orange != null && InScope(orange.FilePath.ToString()) ? orange : frange;
        var file = range?.FilePath.ToString() ?? "";
        if (!InScope(file)) continue;
        errors++;
        Console.WriteLine($"TYPE {Rel(file)}({(range?.BeginLineIndex ?? -1) + 1}) {r.Function?.Name}: {d.Code} {d.Message}");
    }

var sums = new SumTypeChecker(comp).Check().Concat(new ExistentialConceptChecker(comp).Check()).ToList();
foreach (var d in sums.Where(d => d.Severity == DiagnosticSeverity.Error))
{
    errors++;
    Console.WriteLine($"SUM {d.Code} {d.Message}");
}

foreach (var f in StyleChecker.Check(parsed.Where(p => InScope(p.File.Path.ToString()))))
{
    if (f.Severity == LintSeverity.Error) errors++;
    Console.WriteLine($"STYLE {Rel(f.File)}({f.Line}) {f.Code} [{f.Severity}] {f.Message}");
}

Console.WriteLine($"{(errors == 0 ? "PASS" : "FAIL")}: {errors} error(s) in scope; {results.Count} functions type-checked ({timer.Elapsed.TotalSeconds:F1}s)");
return errors == 0 ? 0 : 1;
