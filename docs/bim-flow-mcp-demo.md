# Building a DuckDB BIM Flow graph from natural language

The DuckDB workflow studio has an **Ask** box in its top bar. Type what you want, and an agent builds the graph through the `bimopenflow` MCP tools: it reads the database schema, adds and wires the nodes, evaluates, checks the result, and hands back a short summary. The transcript streams in under the top bar as the agent works, and the finished graph opens in the editor. Tick **follow-up** to refine the same graph with the next request ("now sort by name"). The same tools serve any MCP client, so a Claude Code chat can build graphs into the same store.

The server holds no logic of its own. Each tool is one of the operations behind the HTTP API and the editor (`addNode`, `connect`, `setParam`, `evaluate`, ...), so a graph an agent builds is exactly the kind a person builds by hand.

## Setup

From the repository root, with .NET 8 installed and the DuckDB demo prepared (`duckdb:prepare`, see [the studio doc](bim-flow-duckdb.md)). The Ask box needs an OpenAI API key. Put it on its own line in a file, then point the host at that file so the key never appears in a shell history or a process listing:

```powershell
$env:OPENAI_API_KEY_FILE = "C:\dev\keys\gpt.txt"
npm run duckdb:build --prefix bimopenflow/web
npm run duckdb:host --prefix bimopenflow/web
```

`OPENAI_API_KEY` in the environment works too. The model defaults to `gpt-5`; set `OPENAI_MODEL` to change it (`gpt-5.4-nano` is about five times faster and far cheaper, and with the guides below it builds most graphs; see the measurements). `OPENAI_REASONING_EFFORT` (minimal, low, medium, high) is passed through when set. `duckdb:build` builds `bimopenflow-studio`, which is the whole `bimopenflow-host` API plus `POST /api/ask`, into `artifacts/bim-flow-duckdb/studio`. Start the web page with `duckdb:web` as before and open the studio. If the key is not configured, the transcript strip says so as soon as the page loads.

## Asking

Type a request in the Ask box, or pick one of the examples it suggests, and press Ask. Requests that work with the node vocabulary:

- How many rooms are on each storey? Sort by count, largest first.
- A room schedule: room number, name, storey and floor area, sorted by storey then room number.
- Which rooms have the most doors? Show room number, name, storey and door count, top 15.
- Which doors are fire rated, and what is their rating? Include the storey.
- List every roof with its name, storey and area, and flag which ones have no area.
- Which source documents contributed elements, and how many elements came from each?

Each request becomes a graph with an id of the form `ask-` plus the main words of the request, so it stays in the flow picker next to the sample graphs. Every node is editable afterwards; edits save to the same store the agent wrote.

The transcript shows, in order: the id and model, one line per tool call with its arguments and a one-line result (node states for `evaluate`, row counts for `getResult`), any text the agent writes between calls, and the closing summary with the turn and token counts. A failed tool call is shown in red and goes back to the agent, which fixes its mistake on the next turn: a wrong column name, a list column fed into a join, a function DuckDB does not have.

When the request asks for something the export does not contain, or is ambiguous in a way that changes the graph, the agent answers or asks instead of building. The supplied Snowdon export has no walls or windows, so "which storey has the most walls" gets that answer in one tool call, with an offer to count something the export does have. Tick **follow-up** and reply, and the agent continues the same conversation.

The agent works one request at a time. Turns run to sixty; a request that has not produced an answer by then stops with an error, and the partial graph stays in the store.

## Why it works: what the agent is told

Success on arbitrary requests came from four things, found by running varied requests and reading the transcripts:

1. **A schema summary the agent can afford to read.** The export has 83 tables and 6,058 columns, but only 11 tables have rows, and four of every five columns are `_assurance`, `_reason`, `_explanation` or `_evidence` companions. `describeDatabase` now folds the companions into one list per table and gives empty tables only their name and count. The agent reads the summary once, then asks for the full column types of just the tables it will query.
2. **A schema guide in the system prompt** (`AskPrompts.SchemaGuide`): what the element tables share, how storeys link, which columns hold the readable names and marks, that NULL measures carry a reason and must never become zero, how the lineage tables chain, and that an empty table means the export has none of that kind. Before the guide, the agent picked a different database file than the studio uses and guessed wall column names for sixty turns.
3. **A node guide** (`AskPrompts.NodeGuide`): the expression language of `table.derive` and `table.filter` (which has no null test), the aggregate syntax, the join modes, and that `sql.query` runs SQL over intermediate tables for anything the table nodes cannot express. Before it, a request spent fifty turns trying `isnull(width)` and `width is null`.
4. **One call to build the graph.** `editGraph` applies a list of edits and saves once. A graph that took forty single-step calls now takes one call plus a fix-up or two, which also means the agent resends the conversation ten times instead of forty. Requests dropped from 2 to 4 million input tokens to 100 to 300 thousand.

The prompt tells the agent to prefer several small nodes over one large query, to keep ids readable, to name the final node `answer`, to evaluate and read the result before answering, and to finish with a plain-language summary that names any missing values.

A second round of tricky requests on the small `gpt-5.4-nano` model added five more, each from a transcript:

5. **Value profiles.** `describeDatabase` with `table` now reports each column's NULL count, distinct count, up to five sample values, and the numeric range. The agent sees that `net_floor_area` is NULL for all 290 rooms before it filters on it, and which reason codes and storey names exist, without a query round trip. The rules tell it to read the NULL count before filtering, sorting or ranking on a measure.
6. **A check by the host.** After the agent says it is done, the host evaluates the graph itself: every node Ok, an `answer` node present, rows in its table. A finding goes back as one more turn, up to twice. The no-rows finding lists the row count of every node upstream of the answer ("doors 142 rows -> doors_wide 0 rows -> answer 0 rows"), and an Unready finding names the input port nothing is connected to. Two nano failures had been 0-row answers the agent never noticed; another was a node left unconnected after a `removeNode`.
7. **Repeat detection.** When the model makes the same call with the same result twice in a row, the tool message says so and asks for a different action. Nano had called `evaluate` five times in a row on an unchanged graph.
8. **Fewer, clearer tools.** The Ask agent is not offered `getNodeCatalog` or `listDatabases` (the prompt carries both), nor the run, model and whole-document tools. Nano spent a turn on each. `editGraph` tolerates real line breaks inside JSON string values, which small models write in multi-line SQL, and a failed batch says "nothing was saved", because nano assumed partial application and then removed nodes that never existed.
9. **Honesty over rows.** The check message and the rules both allow "explain why the answer is empty" as a valid outcome. For "doors wider than one metre" the right answer on this export is that no door has a width, and the agent now says so instead of looping.

## Measuring it

`scripts/ask-bim-flow.mjs` asks the studio from the command line, without the page, and is how the requests above were tested:

```powershell
node scripts/ask-bim-flow.mjs "Which doors are fire rated, and what is their rating?"
node scripts/ask-bim-flow.mjs --file requests.txt
node scripts/ask-bim-flow.mjs --continue ask-doors-fire-rated-rating "Only doors rated 60 minutes or more"
```

It streams the tool calls, prints the first rows of the answer table, and ends with one line per request: `OK` (a graph with rows), `ANSWERED` (a reply without a graph, such as a question back or "no walls in this export"), or `FAIL`, with the turns, tool calls, and tokens. `BOF_STUDIO_URL` selects the host; `BOF_ASK_ROWS` the rows to print.

On `gpt-5`, ten requests over rooms, roofs, storeys, doors, lineage and table sizes, plus walls and windows that the export lacks: eight built correct graphs, two answered honestly, none failed. Where a hand-built sample graph exists for the same question, the counts match (290 rooms, 26 roofs, 33 storeys with rooms).

On `gpt-5.4-nano`, a harder set of eight (rooms without doors, singleton door types, fire-rating shares, a one-row building summary, rooms connected through doors, storey-to-storey comparison, the evidence behind door widths, and the deliberately vague "show the biggest rooms") went from five correct graphs and two 0-row failures before strategies 5 to 9 to seven correct graphs and one honest "cannot be satisfied" after them. The final run of twelve requests (those eight plus doors wider than a metre, rooms per department, the busiest storey, and evidence per source document) produced ten correct graphs, one answer without a graph, and one graph that is correctly empty with an explanation, at 13 to 36 seconds and 150 to 480 thousand input tokens a request. Nano still needs the host's check more often than gpt-5 does and makes more failed tool calls on the way, so the larger model remains the safer choice for multi-hop lineage questions. The command-line script's verdict is mechanical: read the transcript before trusting an OK on a question with no hand-built reference.

## How it works

`POST /api/ask` takes `{ "request": "...", "analysisId": "..."? }` and answers with a server-sent event stream. The host runs the MCP tool server in process and gives the model its tool list as functions. The system prompt holds the list of databases (and which one the existing graphs use), the node catalog, the two guides, and the working rules; the per-request message carries only the analysis id and the request, so the long prompt stays the same across requests. With `analysisId`, the request is appended to that graph's conversation, which the host keeps in memory for the last two dozen graphs; after a restart the agent is told to read the graph with `getAnalysis` first.

The loop is in `src/BimOpenFlow.Studio/AskAgent.cs`, the OpenAI call in `OpenAiChat.cs`, and the endpoint, prompts and guides in `AskEndpoint.cs`. The tests in `tests/BimOpenFlow.Studio.Tests` run the loop against the real tool server with a scripted model.

## The MCP server on its own

The repository's `.mcp.json` registers the same server as `bimopenflow-duckdb` for Claude Code: the built `bimopenflow-mcp.dll` over stdio with the tables profile, the demo store, and `artifacts/building-model-workflows` as the model root where `listDatabases` looks for `.duckdb` files. Build it with `duckdb:mcp-build`, open Claude Code in the repository root, approve the project server, and ask in chat. Reload the studio to see what it built. Any MCP client can use the same entry; the arguments are those of `bimopenflow-host`, except that `--port` does nothing under stdio (pass `--http [port]` to listen on HTTP instead).

| Tool | What it does |
|---|---|
| `listDatabases` | The `.duckdb` files under the model roots, with paths ready for a `duck.source` node. |
| `describeDatabase` | Without `table`: every table with its row count and base column names, companions folded. With `table`: that table's columns with DuckDB types, NULL and distinct counts, sample values, and numeric range. |
| `getNodeCatalog` | Every node kind with its ports, parameters, enum values, and capability. |
| `listAnalyses`, `getAnalysis`, `saveAnalysis` | The graph library: list, read as canonical JSON, or replace a whole document. |
| `editGraph` | A list of addNode / setParam / connect / removeNode edits, validated together and saved once. |
| `addNode`, `setParam`, `connect`, `removeNode` | Single edits for small fixes. Each validates the graph against the catalog before saving. |
| `evaluate` | Per-node status: `Ok`, `Unready`, `EffectPending`, `Unavailable`, or `Error`. |
| `getResult` | One node output as a paged table slice. |
| `createRun`, `listRuns` | Freeze the current evaluation as an immutable run record; list the archive. |

## Replay without a language model

The scripted replay drives the built MCP server over stdio with the JSON-RPC messages a client sends, makes the tool calls for a door-schedule request, and checks the result:

```powershell
npm run duckdb:mcp-demo --prefix bimopenflow/web
```

It prints the request, each tool call, the first five rows, and `OK` when the graph is in the store. It removes any earlier `agent-door-schedule` from the demo store first, so every run builds from scratch. It fails if a tool is missing, a node is not `Ok`, the columns differ, or (against the supplied Snowdon export) the row count is not 142. Override `BOF_MCP_DLL`, `BOF_DUCKDB_STORE`, `BOF_DUCKDB_MODELS`, `BOF_DUCKDB` (the database file name to pick), or `BOF_MCP_ANALYSIS` (the graph id) for another setup.

## Limits

There is no tool for naming a graph, so the picker shows the generated id. `duck.query` accepts one read-only `SELECT` or `WITH` statement; anything else is rejected at evaluation, not at `setParam`. The agent sees column names and types but not values, so a request that depends on the vocabulary of a column (which reason codes exist, which storeys are referenced) costs it an extra query and a `getResult` before the final graph is right. Conversations live in the host's memory and are lost on restart. The Ask endpoint is a local demo surface: no authentication, one request at a time, and the key is read from the host's environment.
