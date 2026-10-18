using System.Collections.Concurrent;
using Ara3D.BimOpenSchema.IO;
using Ara3D.BimOpenSchema.IO.Bcf;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.Utils;

namespace BimOpenFlow.Nodes.Bcf;

/// <summary>bcf.write: writes the input issues as a BCF 3.0 file. An Effect node: pending until
/// Run (PROJECT.md principle 2), then the file exists and the summary names it with its hash.</summary>
public sealed class BcfWriteNode : IFlowNode
{
    public const string Kind = "bcf.write";

    // TODO: unbounded cache, like bos.load's; add eviction if long-lived hosts cycle through many models.
    private static readonly ConcurrentDictionary<string, ElementBounds> BoundsCache = new();

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Effect,
        Inputs: [new PortSpec("issues", PortType.Table)],
        Outputs: [new PortSpec("out", PortType.Table)],
        Params:
        [
            new ParamSpec("path", ParamKind.FilePath),
            new ParamSpec("model", ParamKind.FilePath, Bindable: PortType.Text, Suggest: SuggestSource.FilesWith(".bos")),
            BcfIssues.PresetSpec,
            BcfIssues.VerdictsSpec,
            new ParamSpec("author", ParamKind.Text),
            new ParamSpec("guidSeed", ParamKind.Text),
            new ParamSpec("created", ParamKind.Text),
            new ParamSpec("modelDate", ParamKind.Text),
        ],
        "Writes the input issue or verdict table as a BCF 3.0 file at 'path' that Revit, Solibri and "
        + "BIMcollab open as topics. With 'model' (a .bos file) each topic gets a viewpoint selecting its "
        + "elements under a camera framing them; without it, or for elements with no geometry, the "
        + "GlobalIds go in the topic's description. 'model' also names the model file in the BCF header (file name and path), so a viewer can match the topic to its model; 'modelDate' (UTC, yyyy-MM-ddTHH:mm:ssZ) adds the file's date there, and is left out when empty because a file's last-write time changes with every checkout. 'created' (UTC, yyyy-MM-ddTHH:mm:ssZ) sets every topic's creation date and the zip entries' timestamps; empty uses the time of the Run, so two Runs differ, and set it to get the same bytes (and SHA-256) every time. A camera in the input (the CameraX..AspectRatio columns, as bcf.issue makes them) becomes the viewpoint's camera, and a Comment column becomes the topic's comments. 'guidSeed' keeps topic GUIDs stable across reruns "
        + "(default: the file name). Runs only inside a Run; outputs a one-row summary (path, topics, "
        + "viewpoints, elements, elementsWithoutGeometry, bytes, sha256). " + BcfIssues.ParamsDescription,
        Schemas: [BcfIssues.SummarySchema("out")]);

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        if (!context.IsRun)
            throw new InvalidOperationException($"'{Kind}' is an Effect node and can only execute inside a Run");
        var path = parameters.RequiredText("path", Kind);
        var (issues, rows) = BcfIssues.From(inputs.TableInput(0, Kind), parameters, Kind);
        if (rows == 0)
            context.Warn($"{Kind}: no rows left after the verdict filter; the BCF holds no topics");
        var model = parameters.GetText("model", "");
        var bounds = model.Length > 0 ? Bounds(model) : null;
        var modelDate = BcfIssues.UtcParam(parameters, "modelDate", Kind);
        var options = new BcfOptions
        {
            GuidSeed = parameters.GetText("guidSeed", "") is { Length: > 0 } seed ? seed : Path.GetFileNameWithoutExtension(path),
            ModelFile = model,
            ModelDate = modelDate,
        };
        if (BcfIssues.UtcParam(parameters, "created", Kind) is { } created)
            options = options with { CreationDate = created };
        if (parameters.GetText("author", "") is { Length: > 0 } author)
            options = options with { Author = author };
        var summary = BcfWriter.WriteFile(path, issues, options, bounds);
        var full = Path.GetFullPath(path);
        return
        [
            new TableValue(BcfIssues.SummaryRow("bcf.write",
                ("path", full),
                ("topics", (long)summary.Topics),
                ("viewpoints", (long)summary.Viewpoints),
                ("elements", (long)summary.Elements),
                ("elementsWithoutGeometry", (long)summary.ElementsWithoutGeometry),
                ("bytes", new FileInfo(full).Length),
                ("sha256", FileHashes.HashFile(full)))),
        ];
    }

    /// <summary>The element boxes of a .bos file, read once per file content.</summary>
    private static ElementBounds Bounds(string model)
    {
        if (!File.Exists(model))
            throw new FileNotFoundException($"{Kind}: model file not found: {model}", model);
        return BoundsCache.GetOrAdd(FileHashes.HashFile(model),
            _ => ElementBounds.FromBimData(new FilePath(model).ReadBimDataFromParquetZip()));
    }
}
