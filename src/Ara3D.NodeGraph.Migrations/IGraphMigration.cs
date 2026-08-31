namespace Ara3D.NodeGraph.Migrations;

/// <summary>
/// One version-to-version upgrade of a graph document. Operates on raw JSON
/// text because an old format may not be representable by the current model.
/// </summary>
public interface IGraphMigration
{
    string FromVersion { get; }
    string ToVersion { get; }
    string Migrate(string documentJson);
}
