using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.Ids;
using Xbim.InformationSpecifications;

namespace BimOpenFlow.Nodes.Ids;

/// <summary>The one parameter both nodes share: the path of the IDS file.</summary>
internal static class IdsFiles
{
    public const string PathParam = "ids";

    public static readonly ParamSpec PathSpec =
        new(PathParam, ParamKind.FilePath, Bindable: PortType.Text, Suggest: SuggestSource.FilesWith(".ids"));

    public static Xids Load(ParamValues parameters, string kind)
    {
        var path = parameters.RequiredText(PathParam, kind);
        if (!File.Exists(path))
            throw new FileNotFoundException($"{kind}: IDS file not found: {path}", path);
        return IdsFile.Load(path);
    }
}
