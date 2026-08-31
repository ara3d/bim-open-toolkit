# Ara3D.NodeGraph

The dataflow graph *document* object model and API: load/save in canonical
`.dfg.json` form, graph hashing, structural validation against a node
registry, and pure editing operations with undo/redo. Knows nothing about
evaluation — this is what editors, agents, and the MCP surface manipulate.

Provenance: new for the BimOpenFlow rewrite (see `docs/bimopenflow-structure.md`
and `spec/dataflow-graph/format/`).
