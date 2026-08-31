using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Runs;

/// <summary>
/// Canonical load/save for run records (.run.json), using the format part's
/// canonical JSON rules via Ara3D.NodeGraph.CanonicalJson: sorted keys, LF
/// lines, one trailing LF. Inputs serialize sorted by (node, param); effects
/// keep execution order. The bytes are deterministic and hashable.
/// </summary>
public static class RunRecordJson
{
    public static string ToCanonicalJson(this RunRecord record)
    {
        using var doc = JsonDocument.Parse(WriteUtf8(record));
        return CanonicalJson.ToCanonicalString(doc.RootElement) + "\n";
    }

    public static void Save(this RunRecord record, string filePath)
        => File.WriteAllText(filePath, record.ToCanonicalJson(), GraphDocumentIO.Utf8NoBom);

    public static RunRecord Load(string filePath)
        => Parse(File.ReadAllText(filePath, GraphDocumentIO.Utf8NoBom));

    public static RunRecord Parse(string text)
    {
        using var parsed = JsonDocument.Parse(text);
        var root = parsed.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
            throw new FormatException("Run record must be a JSON object");

        string? runVersion = null, graphHash = null, engineVersion = null, timestampUtc = null;
        JsonElement? inputs = null, nodeOutputs = null, recordedOutputs = null, effects = null;
        foreach (var p in root.EnumerateObject())
            switch (p.Name)
            {
                case "runVersion": runVersion = p.Value.GetString(); break;
                case "graphHash": graphHash = p.Value.GetString(); break;
                case "engineVersion": engineVersion = p.Value.GetString(); break;
                case "timestampUtc": timestampUtc = p.Value.GetString(); break;
                case "inputs": inputs = p.Value; break;
                case "nodeOutputs": nodeOutputs = p.Value; break;
                case "recordedOutputs": recordedOutputs = p.Value; break;
                case "effects": effects = p.Value; break;
                default: throw new FormatException($"Unknown run record member '{p.Name}'");
            }

        if (runVersion != RunRecord.RunVersion)
            throw new FormatException($"Unsupported runVersion '{runVersion}'; expected {RunRecord.RunVersion}");
        return new(
            Required(graphHash, "graphHash"),
            Required(engineVersion, "engineVersion"),
            Required(timestampUtc, "timestampUtc"),
            ReadInputs(RequiredElement(inputs, "inputs")),
            ReadHashes(RequiredElement(nodeOutputs, "nodeOutputs")),
            ReadValues(RequiredElement(recordedOutputs, "recordedOutputs")),
            ReadEffects(RequiredElement(effects, "effects")),
            Array.Empty<string>());
    }

    private static byte[] WriteUtf8(RunRecord record)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        {
            w.WriteStartObject();
            w.WriteString("runVersion", RunRecord.RunVersion);
            w.WriteString("graphHash", record.GraphHash);
            w.WriteString("engineVersion", record.EngineVersion);
            w.WriteString("timestampUtc", record.TimestampUtc);
            WriteInputs(w, RunRecorder.SortInputs(record.Inputs));
            WriteHashes(w, record.NodeOutputs);
            WriteValues(w, record.RecordedOutputs);
            WriteEffects(w, record.Effects);
            w.WriteEndObject();
        }
        return stream.ToArray();
    }

    private static void WriteInputs(Utf8JsonWriter w, IReadOnlyList<RunInput> inputs)
    {
        w.WritePropertyName("inputs");
        w.WriteStartArray();
        foreach (var input in inputs)
        {
            w.WriteStartObject();
            w.WriteString("node", input.Node);
            w.WriteString("param", input.Param);
            w.WriteString("contentHash", input.ContentHash);
            if (input.Source is not null)
                w.WriteString("source", input.Source);
            w.WriteEndObject();
        }
        w.WriteEndArray();
    }

    private static void WriteHashes(Utf8JsonWriter w, IReadOnlyDictionary<string, string> hashes)
    {
        w.WritePropertyName("nodeOutputs");
        w.WriteStartObject();
        foreach (var (port, hash) in hashes)
            w.WriteString(port, hash);
        w.WriteEndObject();
    }

    private static void WriteValues(Utf8JsonWriter w, IReadOnlyDictionary<string, FlowValue> values)
    {
        w.WritePropertyName("recordedOutputs");
        w.WriteStartObject();
        foreach (var (port, value) in values)
        {
            w.WritePropertyName(port);
            ValueJson.Write(w, value);
        }
        w.WriteEndObject();
    }

    private static void WriteEffects(Utf8JsonWriter w, IReadOnlyList<EffectRecord> effects)
    {
        w.WritePropertyName("effects");
        w.WriteStartArray();
        foreach (var effect in effects)
        {
            w.WriteStartObject();
            w.WriteString("node", effect.Node);
            w.WriteString("status", effect.Status == EffectStatus.Ok ? "ok" : "failed");
            if (effect.Error is not null)
                w.WriteString("error", effect.Error);
            w.WriteEndObject();
        }
        w.WriteEndArray();
    }

    private static IReadOnlyList<RunInput> ReadInputs(JsonElement e)
        => e.EnumerateArray().Select(ReadInput).ToList();

    private static RunInput ReadInput(JsonElement e)
    {
        string? node = null, param = null, contentHash = null, source = null;
        foreach (var p in e.EnumerateObject())
            switch (p.Name)
            {
                case "node": node = p.Value.GetString(); break;
                case "param": param = p.Value.GetString(); break;
                case "contentHash": contentHash = p.Value.GetString(); break;
                case "source": source = p.Value.GetString(); break;
                default: throw new FormatException($"Unknown input member '{p.Name}'");
            }
        return new(Required(node, "node"), Required(param, "param"), Required(contentHash, "contentHash"), source);
    }

    private static IReadOnlyDictionary<string, string> ReadHashes(JsonElement e)
        => e.EnumerateObject().ToDictionary(
            p => p.Name,
            p => p.Value.GetString() ?? throw new FormatException($"Output hash '{p.Name}' must be a string"));

    private static IReadOnlyDictionary<string, FlowValue> ReadValues(JsonElement e)
        => e.EnumerateObject().ToDictionary(p => p.Name, p => ValueJson.Read(p.Value));

    private static IReadOnlyList<EffectRecord> ReadEffects(JsonElement e)
        => e.EnumerateArray().Select(ReadEffect).ToList();

    private static EffectRecord ReadEffect(JsonElement e)
    {
        string? node = null, status = null, error = null;
        foreach (var p in e.EnumerateObject())
            switch (p.Name)
            {
                case "node": node = p.Value.GetString(); break;
                case "status": status = p.Value.GetString(); break;
                case "error": error = p.Value.GetString(); break;
                default: throw new FormatException($"Unknown effect member '{p.Name}'");
            }
        var effectStatus = Required(status, "status") switch
        {
            "ok" => EffectStatus.Ok,
            "failed" => EffectStatus.Failed,
            var s => throw new FormatException($"Unknown effect status '{s}'"),
        };
        return new(Required(node, "node"), effectStatus, error);
    }

    private static string Required(string? value, string name)
        => value ?? throw new FormatException($"Missing required member '{name}'");

    private static JsonElement RequiredElement(JsonElement? value, string name)
        => value ?? throw new FormatException($"Missing required member '{name}'");
}
