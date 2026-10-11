using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.Ids;

namespace BimOpenFlow.Nodes.Ids;

/// <summary>The one parameter both nodes share: the path of the IDS file.</summary>
internal static class IdsFiles
{
    public const string PathParam = "ids";

    public static readonly ParamSpec PathSpec =
        new(PathParam, ParamKind.FilePath, Bindable: PortType.Text, Suggest: SuggestSource.FilesWith(".ids"));

    /// <summary>The document and, on the context, the loader's warnings: a facet the loader
    /// skipped is a requirement nobody checked, so it is never silent.</summary>
    public static IdsDocument Load(ParamValues parameters, IEvalContext context, string kind)
    {
        var path = parameters.RequiredText(PathParam, kind);
        if (!File.Exists(path))
            throw new FileNotFoundException($"{kind}: IDS file not found: {path}", path);
        var document = IdsFile.Load(path);
        foreach (var warning in document.Warnings)
            context.Warn($"{kind}: {warning}");
        return document;
    }
}
