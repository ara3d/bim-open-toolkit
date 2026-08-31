using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;
using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.Runs;

/// <summary>One pinned external input: the resolved content behind a FilePath or
/// ModelRef parameter, identified by content hash. Source is informational only.</summary>
public sealed record RunInput(string Node, string Param, string ContentHash, string? Source = null)
{
    public string ContentHash { get; } = Hashes.IsHash(ContentHash)
        ? ContentHash
        : throw new ArgumentException($"'{ContentHash}' is not 64 lowercase hex characters", nameof(ContentHash));
}

public enum EffectStatus
{
    Ok,
    Failed,
}

/// <summary>One executed Effect node; Error is present only when Status is Failed.</summary>
public sealed record EffectRecord(string Node, EffectStatus Status, string? Error = null);

/// <summary>
/// A frozen evaluation per spec runs.md: graph hash, pinned input content hashes,
/// per-output value hashes, serialized terminal outputs, executed effects, and
/// provenance. Serialized as canonical JSON with extension ".run.json".
/// Warnings are in-memory provenance only: run.schema.json v0.1 has no warnings
/// member (additionalProperties is false), so they are never serialized.
/// TODO: propose a warnings member for a future runs.md minor version.
/// </summary>
public sealed record RunRecord(
    string GraphHash,
    string EngineVersion,
    string TimestampUtc,
    IReadOnlyList<RunInput> Inputs,
    IReadOnlyDictionary<string, string> NodeOutputs,
    IReadOnlyDictionary<string, FlowValue> RecordedOutputs,
    IReadOnlyList<EffectRecord> Effects,
    IReadOnlyList<string> Warnings)
{
    public const string RunVersion = "0.1.0";
    public const string FileExtension = ".run.json";

    public string GraphHash { get; } = Hashes.IsHash(GraphHash)
        ? GraphHash
        : throw new ArgumentException($"'{GraphHash}' is not 64 lowercase hex characters", nameof(GraphHash));

    public string TimestampUtc { get; } = RunTimestamp.IsValid(TimestampUtc)
        ? TimestampUtc
        : throw new ArgumentException($"'{TimestampUtc}' is not RFC 3339 UTC with millisecond precision", nameof(TimestampUtc));
}

/// <summary>RFC 3339 UTC with millisecond precision and a Z suffix (runs.md §2).</summary>
public static class RunTimestamp
{
    private static readonly Regex Pattern = new(
        @"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$", RegexOptions.Compiled);

    public static string Format(DateTimeOffset timestamp)
        => timestamp.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);

    public static bool IsValid(string text)
        => Pattern.IsMatch(text);
}
