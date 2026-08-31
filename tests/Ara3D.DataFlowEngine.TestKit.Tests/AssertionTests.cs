using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.TestKit.Tests;

[TestFixture]
public class AssertionTests
{
    private static FlowTestSession Session()
    {
        var session = new FlowTestSession();
        session.Evaluate(
            Graph.Node("c", "test.const", ("value", "42"))
                .Node("n", "test.negate")
                .Connect("c.out", "n.in")
                .Build());
        return session;
    }

    [Test]
    public void AssertOutput_passes_on_the_true_value_and_fails_on_others()
    {
        var session = Session();
        Assert.DoesNotThrow(() => session.AssertOutput("n", "out", -42L));
        Assert.Throws<FlowAssertionException>(() => session.AssertOutput("n", "out", 42L));
        Assert.Throws<FlowAssertionException>(() => session.AssertOutput("n", "out", "42"));
    }

    [Test]
    public void AssertStatus_and_execution_count_check_the_result()
    {
        var session = Session();
        Assert.DoesNotThrow(() => session.AssertStatus("c", NodeStatus.Ok));
        Assert.DoesNotThrow(() => session.AssertExecutionCount("c", 1));
        Assert.Throws<FlowAssertionException>(() => session.AssertStatus("c", NodeStatus.Error));
        Assert.Throws<FlowAssertionException>(() => session.AssertExecutionCount("c", 2));
    }

    [Test]
    public void Unknown_node_port_or_missing_output_throw()
    {
        var session = Session();
        Assert.Throws<FlowAssertionException>(() => session.Output("ghost", "out"));
        Assert.Throws<FlowAssertionException>(() => session.Output("n", "ghost"));
        Assert.Throws<FlowAssertionException>(() => session.AssertWarning("n", "careful"));
    }

    [Test]
    public void Output_resolves_by_endpoint_string()
    {
        var session = Session();
        Assert.That(((IntegerValue)session.Output("n.out")).Value, Is.EqualTo(-42));
    }
}
