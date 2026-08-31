using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace Ara3D.NodeGraph;

/// <summary>
/// Canonical load/save for graph documents (.dfg.json). Writers always emit
/// canonical form; readers accept any valid document and canonicalize on save.
/// </summary>
public static class GraphDocumentIO
{
    public static readonly Encoding Utf8NoBom = new UTF8Encoding(false);

    /// <summary>
    /// The canonical serialization: sorted keys, sorted nodes/edges, LF lines,
    /// ending with exactly one LF. Empty layout and session layers are omitted.
    /// </summary>
    public static string ToCanonicalJson(this GraphDocument doc)
        => CanonicalJson.ToCanonicalString(doc.ToJsonElement(includePresentation: true)) + "\n";

    public static GraphDocument Parse(string text)
    {
        using var parsed = JsonDocument.Parse(text);
        var root = parsed.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
            throw new FormatException("Graph document must be a JSON object");

        JsonElement? structure = null, values = null, layout = null, session = null;
        foreach (var p in root.EnumerateObject())
            switch (p.Name)
            {
                case "formatVersion":
                    if (p.Value.ValueKind != JsonValueKind.String)
                        throw new FormatException("formatVersion must be a string");
                    break;
                case "structure": structure = p.Value; break;
                case "values": values = p.Value; break;
                case "layout": layout = p.Value; break;
                case "session": session = p.Value.Clone(); break;
                default: throw new FormatException($"Unknown top-level member '{p.Name}'");
            }

        if (structure is null)
            throw new FormatException("Missing required 'structure' layer");
        if (values is null)
            throw new FormatException("Missing required 'values' layer");

        var (nodes, edges) = ReadStructure(structure.Value);
        return new GraphDocument(nodes, edges, ReadValues(values.Value),
            layout is null ? new Dictionary<string, NodeLayout>() : ReadLayout(layout.Value), session);
    }

    public static void Save(this GraphDocument doc, string filePath)
        => File.WriteAllText(filePath, doc.ToCanonicalJson(), Utf8NoBom);

    public static GraphDocument Load(string filePath)
        => Parse(File.ReadAllText(filePath, Utf8NoBom));

    internal static JsonElement ToJsonElement(this GraphDocument doc, bool includePresentation)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        {
            w.WriteStartObject();
            if (includePresentation)
                w.WriteString("formatVersion", GraphFormat.Version);
            WriteStructure(w, doc);
            WriteValues(w, doc.Values);
            if (includePresentation)
            {
                if (doc.Layout.Count > 0)
                    WriteLayout(w, doc.Layout);
                if (HasContent(doc.Session))
                {
                    w.WritePropertyName("session");
                    doc.Session!.Value.WriteTo(w);
                }
            }
            w.WriteEndObject();
        }
        using var parsed = JsonDocument.Parse(stream.ToArray());
        return parsed.RootElement.Clone();
    }

    private static bool HasContent(JsonElement? session)
        => session is { } s
           && s.ValueKind != JsonValueKind.Undefined
           && !(s.ValueKind == JsonValueKind.Object && !s.EnumerateObject().Any());

    private static void WriteStructure(Utf8JsonWriter w, GraphDocument doc)
    {
        w.WritePropertyName("structure");
        w.WriteStartObject();
        w.WritePropertyName("edges");
        w.WriteStartArray();
        foreach (var e in doc.Edges.OrderBy(e => e.To, StringComparer.Ordinal))
        {
            w.WriteStartObject();
            w.WriteString("from", e.From);
            w.WriteString("to", e.To);
            w.WriteEndObject();
        }
        w.WriteEndArray();
        w.WritePropertyName("nodes");
        w.WriteStartArray();
        foreach (var n in doc.Nodes.OrderBy(n => n.Id, StringComparer.Ordinal))
        {
            w.WriteStartObject();
            w.WriteString("id", n.Id);
            w.WriteString("kind", n.Kind);
            w.WriteNumber("version", n.Version);
            w.WriteEndObject();
        }
        w.WriteEndArray();
        w.WriteEndObject();
    }

    private static void WriteValues(Utf8JsonWriter w, IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> values)
    {
        w.WritePropertyName("values");
        w.WriteStartObject();
        foreach (var (nodeId, parameters) in values)
        {
            w.WritePropertyName(nodeId);
            w.WriteStartObject();
            foreach (var (name, value) in parameters)
                w.WriteString(name, value);
            w.WriteEndObject();
        }
        w.WriteEndObject();
    }

    private static void WriteLayout(Utf8JsonWriter w, IReadOnlyDictionary<string, NodeLayout> layout)
    {
        w.WritePropertyName("layout");
        w.WriteStartObject();
        foreach (var (nodeId, l) in layout)
        {
            w.WritePropertyName(nodeId);
            w.WriteStartObject();
            w.WriteNumber("x", l.X);
            w.WriteNumber("y", l.Y);
            if (l.W is { } lw)
                w.WriteNumber("w", lw);
            if (l.H is { } lh)
                w.WriteNumber("h", lh);
            w.WriteEndObject();
        }
        w.WriteEndObject();
    }

    private static (IReadOnlyList<GraphNode>, IReadOnlyList<GraphEdge>) ReadStructure(JsonElement structure)
    {
        JsonElement? nodesEl = null, edgesEl = null;
        foreach (var p in structure.EnumerateObject())
            switch (p.Name)
            {
                case "nodes": nodesEl = p.Value; break;
                case "edges": edgesEl = p.Value; break;
                default: throw new FormatException($"Unknown structure member '{p.Name}'");
            }
        if (nodesEl is null || edgesEl is null)
            throw new FormatException("structure must contain 'nodes' and 'edges'");

        var nodes = nodesEl.Value.EnumerateArray().Select(ReadNode).ToList();
        var edges = edgesEl.Value.EnumerateArray().Select(ReadEdge).ToList();
        return (nodes, edges);
    }

    private static GraphNode ReadNode(JsonElement e)
        => new(RequiredString(e, "id"), RequiredString(e, "kind"), RequiredProperty(e, "version").GetInt32());

    private static GraphEdge ReadEdge(JsonElement e)
        => new(RequiredString(e, "from"), RequiredString(e, "to"));

    private static IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> ReadValues(JsonElement values)
    {
        var result = new Dictionary<string, IReadOnlyDictionary<string, string>>();
        foreach (var node in values.EnumerateObject())
        {
            var parameters = new Dictionary<string, string>();
            foreach (var p in node.Value.EnumerateObject())
                parameters[p.Name] = p.Value.ValueKind == JsonValueKind.String
                    ? p.Value.GetString()!
                    : throw new FormatException(
                        $"Parameter '{node.Name}.{p.Name}' must be a string (canonical string form)");
            result[node.Name] = parameters;
        }
        return result;
    }

    private static IReadOnlyDictionary<string, NodeLayout> ReadLayout(JsonElement layout)
    {
        var result = new Dictionary<string, NodeLayout>();
        foreach (var node in layout.EnumerateObject())
        {
            double? x = null, y = null, lw = null, lh = null;
            foreach (var p in node.Value.EnumerateObject())
                switch (p.Name)
                {
                    case "x": x = p.Value.GetDouble(); break;
                    case "y": y = p.Value.GetDouble(); break;
                    case "w": lw = p.Value.GetDouble(); break;
                    case "h": lh = p.Value.GetDouble(); break;
                    default: throw new FormatException($"Unknown layout member '{node.Name}.{p.Name}'");
                }
            if (x is null || y is null)
                throw new FormatException($"Layout for '{node.Name}' must contain 'x' and 'y'");
            result[node.Name] = new NodeLayout(x.Value, y.Value, lw, lh);
        }
        return result;
    }

    private static JsonElement RequiredProperty(JsonElement e, string name)
        => e.TryGetProperty(name, out var v) ? v : throw new FormatException($"Missing required member '{name}'");

    private static string RequiredString(JsonElement e, string name)
        => RequiredProperty(e, name).GetString() ?? throw new FormatException($"Member '{name}' must be a string");
}
