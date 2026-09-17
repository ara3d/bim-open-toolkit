using System.Collections.Immutable;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>A source category label, matched after TextNormalization.Key, and the core record kind it maps to.
/// Kind must equal the record type name, for example "Wall".</summary>
public sealed record CategoryRule(string Category, string Kind);

/// <summary>One discipline's share of the mapping: the categories it claims, the extra parameter groups it trusts for
/// field lookups, how it builds a row for one selected occurrence, and an optional pass after every occurrence is mapped.</summary>
/// <param name="Map">Receives the kernel, the source occurrence, its kind and the builder; adds zero or more rows.</param>
/// <param name="Complete">Runs once after all domains mapped; use for back-links and definition rows that depend on other rows.</param>
public sealed record DomainMapping(string Name, ImmutableArray<CategoryRule> Rules, ImmutableArray<string> ApprovedGroups,
    Action<MappingKernel, EntityRow, string, ProjectionBuilder> Map, Action<MappingKernel, ProjectionBuilder>? Complete = null);
