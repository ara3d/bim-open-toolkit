using System.Text.Json;

namespace Ara3D.NodeGraph.Tests;

internal static class TestDocs
{
    public static JsonElement Json(string text)
    {
        using var doc = JsonDocument.Parse(text);
        return doc.RootElement.Clone();
    }

    /// <summary>a (test.const, value=42) -> b (test.negate), with layout and session.</summary>
    public static GraphDocument ConstNegate()
        => GraphDocument.Empty
            .AddNode("b", "test.negate", 1)
            .AddNode("a", "test.const", 1)
            .Connect("a.out", "b.in")
            .SetParam("a", "value", "42")
            .SetLayout("a", new NodeLayout(100, 200.5))
            .SetLayout("b", new NodeLayout(300, 200.5, 160, 80)) with
        {
            Session = Json("""{"display":["b"],"camera":{"zoom":1.5,"x":0,"y":0}}"""),
        };
}
