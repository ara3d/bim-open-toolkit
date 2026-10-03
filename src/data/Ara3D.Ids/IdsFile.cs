using Xbim.InformationSpecifications;

namespace Ara3D.Ids;

/// <summary>Reads a buildingSMART IDS 1.0 file with Xbim.InformationSpecifications, the parser the
/// reuse check chose (docs/proposals/ids-reuse.md).</summary>
public static class IdsFile
{
    public static Xids Load(string path)
        => File.Exists(path)
            ? Xids.LoadBuildingSmartIDS(path) ?? throw new InvalidDataException($"Not a readable IDS file: {path}")
            : throw new FileNotFoundException("IDS file not found", path);
}
