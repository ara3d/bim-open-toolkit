using System;
using System.Collections.Generic;
using System.Linq;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine;

/// <summary>Thrown when a document fails GraphValidation; the engine never evaluates invalid documents.</summary>
public sealed class InvalidGraphException(IReadOnlyList<GraphError> errors)
    : Exception($"Invalid graph document: {string.Join("; ", errors.Select(e => e.Message))}")
{
    public IReadOnlyList<GraphError> Errors { get; } = errors;
}
