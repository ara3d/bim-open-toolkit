---
id: TKT-271
title: The generic readers' path parameters become sockets, so duck.read, csv.read, parquet.read, json.read, xlsx.* and sqlite.* can share one value.path
status: done
depends_on: []
owner: builder-TKT-271
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [deps/bim-open-flow/src/flow/BimOpenFlow.Nodes.DuckDb/**, deps/bim-open-flow/src/flow/BimOpenFlow.Nodes.Tables/**, deps/bim-open-flow/tests/flow/**, docs/nodes.md, docs/nodes.catalog.json]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [ ] path on duck.read, csv.read, parquet.read, json.read, xlsx.read, xlsx.sheets, sqlite.query, sqlite.table and sqlite.tables declares Bindable: PortType.Text, as bfast.read and rel.csv do since T138c
- [ ] A test wires one reader from a value.path over a bogus stored string and gets the file's table; docs regenerated; committed in deps/bim-open-flow, hash reported

From the 2026-10-11 review: none of the six analyses graphs can share a source or take a graph input because these readers have no path socket. One line per reader. RunInputs pinning of a wired FilePath by its stale string (noted in docs/plans/graph-sources.md) should be checked for these readers too.
