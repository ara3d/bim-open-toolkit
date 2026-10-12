# Declared schemas: benchmark transcript, 2026-10-12

This folder is new: the toolkit had no committed place for benchmark results yet (workflow 5 in PROJECT.md will need one). It holds the transcript that closes the last criterion of TKT-209 (the graph schema pass): Claude answers a question from `getNodeCatalog` and the schema pass, with no exploratory `evaluate`.

## Setup

- Question: "How many rooms are on each storey of the Schependomlaan model? Sort by count, largest first."
- Known answer: 32, 29, 20 and 19 rooms on the four storeys that have rooms (`docs/bim-flow-duckdb.md`, "Rooms per storey"), checked again on 2026-10-12 with the DuckDB CLI over `deps/bim-open-data/samples/public/schependomlaan.duckdb` (IFCSPACE entities joined to `StoreyOfElement` at Depth = 1).
- Server: `BimOpenMcp.Flow` built from `deps/bim-open-flow` at `2bb824b` (the schema pass), the only MCP server configured (`run1-mcp-config.json`, fresh store folder). Claude Code 2.1.295, model `claude-fable-5-1`, no built-in tools.
- Guide: the contents of `.claude/skills/bim-flow/` (`SKILL.md`, `schema-guide.md`, `node-guide.md`, `working-rules.md`, after the C3 edit that removes the hand-written column lists) passed with `--append-system-prompt`. Outside this repository the skill is not loaded automatically, so it had to be passed.
- Command: `claude -p "<question>" --mcp-config run1-mcp-config.json --strict-mcp-config --tools "" --allowedTools mcp__bimopenflow-duckdb --append-system-prompt "<guide>" --output-format stream-json --verbose`

## Run 1

- Answer: 32, 29, 20, 19 for `00 begane grond`, `01 eerste verdieping`, `02 tweede verdieping`, `03 derde verdieping`. Correct.
- Tool calls in order: `listDatabases`, `listAnalyses`, `getNodeCatalog`, `describeDatabase` (database), `describeDatabase` (`EntityText`), `describeDatabase` (`StoreyOfElement`), `editGraph` (the whole graph), `evaluate`, `getResult`.
- Exploratory `evaluate`: no. The one `evaluate` came after the graph was built and was followed by `getResult` on `answer`, to read the answer.
- Not shown by this run: `getAnalysis` was never called. Claude took the BOS views' columns from `describeDatabase`, which is where the guide sends it for raw tables. The inferred-column path was checked by hand instead (below).
- Wall time 166.9 s (API time 76.2 s), 10 turns, cost 0.65 USD.
- Tokens: 194 input, 25,180 cache-creation input, 130,355 cache-read input, 2,323 output.

## Hand check of the pass (no model)

A graph of `duck.query` over `EntityText` into a `table.aggregate` grouped by the misspelt `Categry`, read with `getAnalysis` before any `evaluate`: the query output reports `EntityIndex:Integer, Name:Text, Category:Text`, the aggregate reports the error "No column named 'Categry'; did you mean 'Category'?".

## Files

- `run1-stream.jsonl`: the raw stream-json transcript.
- `run1-summary.txt`: the tool calls and result, made by `summarize-stream.mjs`.
- `run1-mcp-config.json`: the MCP configuration used (paths are from the run machine).
