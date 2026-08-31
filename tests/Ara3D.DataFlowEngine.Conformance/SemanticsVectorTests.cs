using System.Text.Json;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Conformance;

/// <summary>
/// Runs spec/dataflow-graph/semantics/conformance through the harness contract
/// of semantics par.8: steps evaluate/setValue/run, per-step execution counts
/// (memo hits and clean skips are zero), and Effect execution order.
/// </summary>
[TestFixture]
public class SemanticsVectorTests
{
    public static IEnumerable<TestCaseData> Vectors()
        => SpecVectors.Cases("semantics");

    [TestCaseSource(nameof(Vectors))]
    public void Vector(string file)
    {
        var root = SpecVectors.Root(file);
        var input = root.GetProperty("input");
        var expect = root.GetProperty("expect");
        var harness = new StepHarness(GraphDocumentIO.Parse(input.GetProperty("document").GetRawText()));

        var steps = input.GetProperty("steps").EnumerateArray().ToList();
        var expectedSteps = expect.GetProperty("steps").EnumerateArray().ToList();
        Assert.That(expectedSteps, Has.Count.EqualTo(steps.Count), "expect.steps length");

        for (var i = 0; i < steps.Count; i++)
        {
            var (executions, effectOrder) = harness.Step(steps[i]);
            AssertStep(i, expectedSteps[i], harness.NodeIds, executions, effectOrder);
        }

        if (expect.TryGetProperty("outputs", out var outputs))
            foreach (var o in outputs.EnumerateObject())
                AssertOutput(harness, o.Name, SpecVectors.ReadFlowValue(o.Value));
    }

    private static void AssertStep(int index, JsonElement expected, IReadOnlyList<string> nodeIds,
        IReadOnlyDictionary<string, int> executions, IReadOnlyList<string> effectOrder)
    {
        var expectedCounts = expected.GetProperty("executions").EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.GetInt32());
        foreach (var unknown in expectedCounts.Keys.Where(id => !nodeIds.Contains(id)))
            Assert.Fail($"step {index}: expected executions for unknown node '{unknown}'");
        foreach (var id in nodeIds)
            Assert.That(executions.GetValueOrDefault(id), Is.EqualTo(expectedCounts.GetValueOrDefault(id)),
                $"step {index}: executions of '{id}'");

        if (expected.TryGetProperty("effectOrder", out var order))
            Assert.That(effectOrder, Is.EqualTo(order.EnumerateArray().Select(e => e.GetString()).ToList()),
                $"step {index}: effect execution order");
    }

    private static void AssertOutput(StepHarness harness, string endpoint, FlowValue expected)
        => Assert.That(ValueHash.Compute(harness.Output(endpoint)), Is.EqualTo(ValueHash.Compute(expected)),
            $"output '{endpoint}'");

    /// <summary>
    /// Drives one vector: a standing session plus a minimal Run driver executing
    /// pending Effect nodes in topological order, ties by node id (semantics par.6).
    /// The engine has no Run implementation yet; when Ara3D.DataFlowEngine grows
    /// one, this driver should delegate to it.
    /// </summary>
    private sealed class StepHarness(GraphDocument doc)
    {
        private readonly FlowTestSession _session = new();
        private readonly Dictionary<string, int> _seenEngineCounts = new();
        private GraphDocument _doc = doc;

        public IReadOnlyList<string> NodeIds
            => _doc.Nodes.Select(n => n.Id).ToList();

        public FlowValue Output(string endpoint)
            => _session.Output(endpoint);

        public (IReadOnlyDictionary<string, int> Executions, IReadOnlyList<string> EffectOrder) Step(JsonElement step)
            => step.GetProperty("action").GetString() switch
            {
                "evaluate" => (Evaluate(), Array.Empty<string>()),
                "setValue" => (SetValue(step), Array.Empty<string>()),
                "run" => Run(),
                var a => throw new InvalidOperationException($"Unknown step action '{a}'"),
            };

        private IReadOnlyDictionary<string, int> Evaluate()
        {
            _session.Evaluate(_doc);
            return EngineCountDeltas();
        }

        private IReadOnlyDictionary<string, int> SetValue(JsonElement step)
        {
            _doc = _doc.SetParam(
                step.GetProperty("node").GetString()!,
                step.GetProperty("param").GetString()!,
                step.GetProperty("value").GetString()!);
            return new Dictionary<string, int>();
        }

        private (IReadOnlyDictionary<string, int>, IReadOnlyList<string>) Run()
        {
            var executions = new Dictionary<string, int>(Evaluate());
            var order = new List<string>();
            foreach (var node in _doc.Sort())
            {
                var result = _session.Result(node.Id);
                if (result.Status != NodeStatus.EffectPending)
                    continue;
                var flowNode = _session.Registry.Find(node.Kind, node.Version)!;
                flowNode.Eval(RunContext.Instance, result.EffectInputs,
                    new ParamValues(_doc.Values.GetValueOrDefault(node.Id) ?? new Dictionary<string, string>()));
                executions[node.Id] = executions.GetValueOrDefault(node.Id) + 1;
                order.Add(node.Id);
            }
            return (executions, order);
        }

        private IReadOnlyDictionary<string, int> EngineCountDeltas()
        {
            var deltas = new Dictionary<string, int>();
            foreach (var node in _doc.Nodes)
            {
                var count = _session.Result(node.Id).ExecutionCount;
                deltas[node.Id] = count - _seenEngineCounts.GetValueOrDefault(node.Id);
                _seenEngineCounts[node.Id] = count;
            }
            return deltas;
        }
    }

    private sealed class RunContext : IEvalContext
    {
        public static readonly RunContext Instance = new();

        public bool IsRun => true;

        public CancellationToken Cancellation => CancellationToken.None;

        public void Warn(string message)
        {
        }
    }
}
