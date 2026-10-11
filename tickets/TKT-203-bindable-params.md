---
id: TKT-203
title: Bindable parameters: a parameter is a socket with an inline value, wired from another node or edited in place
status: done
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-138, TKT-5, TKT-207]
created: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [ ] `ParamSpec` gains an optional socket type (`Bindable: PortType?`); a bindable parameter accepts an incoming edge on a port of the same name, and the engine passes the wired value in place of the parameter's string when one is connected
- [ ] Graph text, `contracts.json`, the catalog, `docs/nodes.md`, MCP `getNodeCatalog` and `editGraph` carry the flag; an edge into a bindable parameter is an ordinary edge in the document, so undo, MCP and the Ask box need no new concept
- [ ] The editor draws a bindable parameter as a socket beside its inline control; connected, the control collapses to a read-only preview of the wired value; disconnected, the inline control returns
- [ ] `duck.query`, `duck.table` and `duck.tables` lose their separate `source` input: `path` becomes a bindable FilePath parameter with socket type Database (the TKT-202 shape, with one name instead of two)
- [ ] A `value` pack with `value.text`, `value.number` and `value.path` constant nodes, so "from a node" and "inline" are symmetric

Source: the owner's design discussion of 2026-10-11: a parameter is either a constant edited inline or computed from another node, as in Blender's geometry nodes. Cross-repository: ara3d-dataflow (spec and engine), bim-open-flow (host, contracts, editor), this repository (packs). Land the engine and contracts first, in their own commits, so the editor and packs can follow in parallel.

Note 2026-10-11 (from TKT-205): while changing the parameter contract, add a flag saying a Text parameter holds a comma-separated list, so the column picker stops guessing from the parameter name (`isMultiColumn` in `suggestText.ts`).

Note 2026-10-11: TKT-207 (declared output schemas) also changes `NodeSpec`, `contracts.json` and the catalog. Land the engine members in separate commits and read each other's commits first; see the fences in `docs/plans/declared-schemas.md`.
