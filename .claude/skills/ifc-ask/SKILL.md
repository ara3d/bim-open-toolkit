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
- Five tools work on a `.bos` file instead of an IFC session, so they take `bosPath`, not `path`: `frag_to_bos` reads a That Open Fragments file (`.frag`) into BOS and DuckDB; `bos_sql` queries any `.bos` with the same views as `ifc_sql`; `bos_export_glb`, `bos_export_usd`, and `bos_export_bcf` write GLB (entity ids in node extras), OpenUSD `.usda`, and BCF 3.0 issues from a SQL query's `GlobalId` and `Title` columns. For an IFC model, take `bosPath` from `ifc_to_bos`. The `frag_to_bos` and `bos_export_*` tools write files: confirm the output path first.
- When a question needs the converted DuckDB in a BimOpenFlow graph rather than a one-off answer, `ifc_to_bos` with an output path produces the `.bos` file, and the `bim-flow` skill takes it from there.
