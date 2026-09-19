# BimOpenMcp.Ifc.Ask

`bimopenmcp-ifc-ask`: a console runner that lets a language model answer questions about one IFC
file through the IFC MCP server, with no one watching, and records every tool call it made.

This is the acceptance evidence for "natural-language questions answered against the model". The
transcript shows what the model called, in what order, with what arguments, and what came back; the
JSON is the same run in a shape a script can check.

```powershell
$env:ANTHROPIC_API_KEY_FILE = "C:\dev\keys\claude.txt"   # or OPENAI_API_KEY_FILE
dotnet run --project src/studio/BimOpenMcp.Ifc.Ask -- `
  --model data/duplex.ifc `
  --questions docs/nrc/questions.txt `
  --out artifacts/nrc/transcript.md `
  --results artifacts/nrc/results.json
```

| Option | Meaning |
|---|---|
| `--model <path.ifc>` | Required. The one model every question is asked about. |
| `--questions <file>` | One question per line; blank lines and lines starting with `#` are skipped. |
| *(positional)* | One or more questions given directly, instead of or as well as `--questions`. |
| `--out <transcript.md>` | The Markdown transcript. With neither `--out` nor `--results`, it goes to stdout. |
| `--results <results.json>` | The run as JSON: question, answer, turns, token counts, and every tool call. |
| `--turns <n>` | Turn limit per question. Default 40. |

The provider is chosen as for the studio's Ask box (`ChatSelection` in `BimOpenFlow.Ask`): the key
comes from `ANTHROPIC_API_KEY` / `ANTHROPIC_API_KEY_FILE` (model `ANTHROPIC_MODEL`, default
`claude-opus-5`) or `OPENAI_API_KEY` / `OPENAI_API_KEY_FILE` (model `OPENAI_MODEL`, default `gpt-5`),
Anthropic first when both exist, `ASK_PROVIDER` to force one. Progress goes to stderr, so the
transcript on stdout stays clean.

| File | Role |
|---|---|
| `IfcAskRunner.cs` | The run: one fresh conversation per question against one in-process tool server |
| `IfcAskPrompts.cs` | The system prompt: the file path, which tool to reach for, the DuckDB view columns, and the evidence rules |
| `IfcAskReport.cs` | The Markdown transcript and the results JSON, as pure functions of the answers |
| `IfcAskOptions.cs` | The command line |
| `IfcAskAnswer.cs` | One question's answer with the events behind it |
| `Program.cs` | Resolve the key, build the server, run, write the files |

## Design notes

**A fresh conversation per question.** Questions share the tool server (so the IFC file is parsed
once and the DuckDB conversion is built once) but never a conversation. An answer that leaned on
what an earlier question turned up would not be evidence that the question can be answered.

**The server is never started.** `IfcAskRunner.CreateServer` registers the tools on an `McpServer`
configured for HTTP and leaves it that way; the agent posts JSON-RPC to `HandlePost` directly, so
nothing listens on a port and nothing else can reach it.

**Four tools are hidden.** `ifc_export_glb` and `ifc_sql_export` write files nobody reads here;
`ifc_close` and `ifc_models` only matter to a client juggling several models. Each one a model tries
costs a turn and teaches it nothing.

**A failed question does not stop the run.** A model that hits the turn limit, or an API error, is
recorded as an unanswered question with the calls it did make, and the next question starts.
