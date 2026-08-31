# Ara3D.DataFlowEngine.Abstractions

The node SDK for the BimOpenFlow dataflow engine: the value types that flow along
edges (`FlowValue`), port and parameter descriptors (`PortSpec`, `ParamSpec`),
node descriptors and capabilities (`NodeSpec`, Pure vs Effect), the node
evaluation contract (`IFlowNode`, `IEvalContext`), and the node registry.

This is the contract every node pack and the engine compile against. It is
deliberately tiny and stable — churn here is churn everywhere. See
`docs/bimopenflow-structure.md` and `spec/dataflow-graph/` (normative).

Contains no I/O, no BIM, and no evaluation logic.
