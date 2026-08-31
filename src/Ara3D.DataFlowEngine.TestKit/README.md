# Ara3D.DataFlowEngine.TestKit

Test infrastructure for everyone building on the dataflow engine: the spec's
`test.*` node vocabulary (semantics part §8), a fluent graph builder, and
evaluation assertions. Shipped as a real package so node-pack authors and
other agents test against the same fakes the conformance suite uses.

- `TestNodes` — `test.const`, `test.negate`, `test.add`, `test.probe`,
  `test.effect` exactly per spec §8, plus `test.throw` and `test.warn`
  for failure and warning paths. `TestNodes.All` and `TestNodes.Registry`
  give the whole vocabulary at once.
- `Graph` / `GraphBuilder` — `Graph.Node("c", "test.const", ("value", "42")).Node(...).Connect("c.out", "n.in").Build()`
  produces a `GraphDocument`.
- `FlowTestSession` — wraps `EvalSession` with a registry so outputs resolve
  by port name; assertion extensions (`AssertOutput`, `AssertStatus`,
  `AssertExecutionCount`, `AssertWarning`) throw `FlowAssertionException`,
  so they work under any test framework.
- `DelegateNode` — an `IFlowNode` from a `NodeSpec` and a lambda, for
  one-off fakes.
- `CanonicalValue` — parses the canonical string form of a scalar value
  (format part §4) into a `FlowValue`.
