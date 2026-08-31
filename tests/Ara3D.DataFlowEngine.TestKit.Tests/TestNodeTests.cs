using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.TestKit.Tests;

[TestFixture]
public class TestNodeTests
{
    private static FlowTestSession Evaluated(GraphBuilder builder)
    {
        var session = new FlowTestSession();
        session.Evaluate(builder.Build());
        return session;
    }

    [Test]
    public void Vocabulary_covers_the_spec_kinds()
        => Assert.That(TestNodes.All.Select(n => n.Spec.Kind),
            Is.SupersetOf(new[] { "test.const", "test.negate", "test.add", "test.probe", "test.effect" }));

    [TestCase("Boolean", "true")]
    [TestCase("Integer", "-42")]
    [TestCase("Number", "0.1")]
    [TestCase("Text", "hello")]
    public void Const_emits_each_scalar_kind(string kind, string value)
    {
        var session = Evaluated(Graph.Node("c", "test.const", ("kind", kind), ("value", value)));
        session.AssertOutput("c", "out", CanonicalValue.Parse(kind, value));
    }

    [Test]
    public void Const_kind_defaults_to_Integer()
    {
        var session = Evaluated(Graph.Node("c", "test.const", ("value", "7")));
        session.AssertOutput("c", "out", 7L);
    }

    [Test]
    public void Const_with_Table_kind_errors()
    {
        var session = Evaluated(Graph.Node("c", "test.const", ("kind", "Table"), ("value", "x")));
        session.AssertError("c", "canonical string form");
    }

    [Test]
    public void Negate_and_add_compute_integer_arithmetic()
    {
        var session = Evaluated(
            Graph.Node("a", "test.const", ("value", "5"))
                .Node("b", "test.const", ("value", "7"))
                .Node("n", "test.negate")
                .Node("sum", "test.add")
                .Connect("a.out", "n.in")
                .Connect("n.out", "sum.a")
                .Connect("b.out", "sum.b"));
        session.AssertOutput("n", "out", -5L);
        session.AssertOutput("sum", "out", 2L);
    }

    [Test]
    public void Probe_is_identity_and_counts_executions()
    {
        var session = Evaluated(
            Graph.Node("c", "test.const", ("kind", "Text"), ("value", "x"))
                .Node("p", "test.probe")
                .Connect("c.out", "p.in"));
        session.AssertOutput("p", "out", "x");
        session.AssertExecutionCount("p", 1);
        session.Evaluate(session.Snapshot.Document);
        session.AssertExecutionCount("p", 1);
    }

    [Test]
    public void Effect_is_pending_outside_a_run()
    {
        var session = Evaluated(
            Graph.Node("c", "test.const", ("value", "3"))
                .Node("e", "test.effect")
                .Connect("c.out", "e.in"));
        session.AssertStatus("e", NodeStatus.EffectPending);
        session.AssertExecutionCount("e", 0);
        Assert.That(((IntegerValue)session.Result("e").EffectInputs[0]).Value, Is.EqualTo(3));
    }

    [Test]
    public void Throw_errors_and_poisons_downstream()
    {
        var session = Evaluated(
            Graph.Node("c", "test.const", ("value", "1"))
                .Node("t", "test.throw")
                .Node("p", "test.probe")
                .Connect("c.out", "t.in")
                .Connect("t.out", "p.in"));
        session.AssertError("t", "test.throw always fails");
        session.AssertStatus("p", NodeStatus.Unavailable);
    }

    [Test]
    public void Warn_warns_and_passes_through()
    {
        var session = Evaluated(
            Graph.Node("c", "test.const", ("value", "9"))
                .Node("w", "test.warn")
                .Connect("c.out", "w.in"));
        session.AssertOutput("w", "out", 9L);
        session.AssertWarning("w", "careful");
    }
}
