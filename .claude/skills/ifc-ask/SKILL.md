---
name: ifc-ask
description: Answer questions about an IFC building model (counts, properties, quantities, storeys, carbon or other analytics property sets, geometry bounds and volumes) through the bimopen-ifc MCP server. Use when the user names an .ifc file, asks what a model contains, or asks a question a BIM schedule would answer. Read BEFORE the first bimopen-ifc tool call.
---

# Questions about an IFC file through MCP

The `bimopen-ifc` server (registered in `.mcp.json`; build it with `node scripts/build-mcp.mjs`) opens IFC files on demand and keeps the three most recent open. Every tool takes `path` as a required argument: pass the same absolute path, forward slashes, on every call. The tool list with one line each is in [deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/README.md](../../../deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/README.md).

Read [ifc-guide.md](ifc-guide.md) in this folder before the first tool call: which tool answers which kind of question, the columns of the DuckDB views `ifc_sql` queries (including `MetricCatalog`, the metric dictionary), where analytics values live, and the rules that make an answer usable evidence. The same file is embedded in the `bimopenmcp-ifc-ask` question runner as its system prompt, so an edit here changes both.

## Conventions in this repository

- Sample models live under `samples/` (`samples/nrc/duplex-enriched.ifc` carries the NRC carbon property sets and names `samples/nrc/nrc-metrics.csv` as its metric dictionary). Ask the user for a path if none is given and none is obvious from the conversation.
- Anything returning a list takes `skip` and `take` and reports the unpaged `total`; say when an answer is a page of a larger result.
- `ifc_export_glb` and `ifc_sql_export` write files. Confirm the output path with the user before calling them.
- A `.bos` file can be the `path` of `ifc_table`, `ifc_sql`, `ifc_sql_export`, and `ifc_export_glb`; the other `ifc_*` tools read IFC only. The `bos_*` and `frag_to_bos` tools take `bosPath`, not `path`: `frag_to_bos` reads a That Open Fragments file (`.frag`) into BOS and DuckDB; `bos_table` and `bos_sql` are `ifc_table` and `ifc_sql` under that argument name; `bos_export_glb`, `bos_export_usd`, and `bos_export_bcf` write GLB (entity ids in node extras), OpenUSD `.usda`, and BCF 3.0 issues from a SQL query's `GlobalId` and `Title` columns. For an IFC model, take `bosPath` from `ifc_to_bos`. The `frag_to_bos` and `bos_export_*` tools write files: confirm the output path first.
- When a question needs the converted DuckDB in a BimOpenFlow graph rather than a one-off answer, `ifc_to_bos` with an output path produces the `.bos` file, and the `bim-flow` skill takes it from there.

## Checking a model against an IDS

An IDS (Information Delivery Specification, buildingSMART) is an XML file of requirements: each specification selects elements (say every IfcDoor) and states what they must carry (say OverallWidth at least 0.85). To check a model against one:

1. `ifc_ids_specifications { idsPath }` shows what the IDS asks, with no model. A row with `Supported: false` has a facet this checker cannot evaluate, so that part will come back InfoNotAvailable.
2. `ifc_ids_check { path, idsPath }`, where `path` is the IFC or a `.bos`, returns `summary` (Pass, Fail and InfoNotAvailable per specification), `warnings`, and a page of `verdicts` (GlobalId, CheckId, Verdict, Reason, and the rest). Add `verdict: "Fail"` to page through the failures only.

Report the counts from `summary`, never from memory. InfoNotAvailable is never a pass: say those elements were not checked. Always read `warnings` and pass them on. A facet the loader skipped (a misspelling), an unsupported facet, or a number whose unit could not be converted appears only there, and means a requirement was not checked as written. A Fail row with an empty GlobalId means a required specification matched no element. To look closer at a failing element, query `ifc_sql` by its GlobalId.
