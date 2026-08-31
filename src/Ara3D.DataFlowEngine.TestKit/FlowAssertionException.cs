using System;

namespace Ara3D.DataFlowEngine.TestKit;

/// <summary>Thrown by TestKit assertions; framework-neutral so any test runner reports it.</summary>
public sealed class FlowAssertionException(string message) : Exception(message);
