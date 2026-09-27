# Claude Code command-line backend for the Ask box and the IFC ask

Status: building
Request: TKT-45. Today the studio's Ask box (`POST /api/ask` in `src/studio/BimOpenFlow.Studio/AskEndpoint.cs`) and the unattended IFC ask (`src/studio/BimOpenMcp.Ifc.Ask`) call the Anthropic Messages API. They should call the Claude Code command line instead, using `claude-haiku-4-5-20251001` at effort `medium` by default, with the in-process MCP tool server as the only tools. The owner decided on 2026-09-27 that the Anthropic API account is not to be used. The OpenAI and Anthropic API providers keep working unchanged. Two measurements run through this backend afterwards and are not part of this plan: TKT-8 (ten Ask requests in `samples/ask/requests.txt`) and TKT-41 (eight IFC questions in `samples/nrc/questions.txt`).

Open questions, decided by the supervisor 2026-09-27:
1. **The variable names for model and effort.** A Claude Code session already sets `CLAUDE_EFFORT` in its own environment, so a studio started by an agent would inherit it. Decided: `ASK_CLAUDE_MODEL` and `ASK_CLAUDE_EFFORT`, matching `ASK_PROVIDER` and `ASK_CLAUDE_CLI`.
2. **The default provider when an API key is still set.** The ticket made `claude-cli` the default only when no API key is set, but a leftover `ANTHROPIC_API_KEY_FILE` in the owner's profile would then send requests to the account the owner has retired. Decided, against the planner's default: `claude-cli` comes first whenever an executable is found; the API providers are used only when `ASK_PROVIDER` names one, or when no executable is found and a key is set. C8 implements this order.
3. **Spike S1 runs the unauthenticated CLI.** It reaches no model. Decided: run it.
4. **TKT-26 C5 edits `AskEndpoint.cs`.** Decided: C9 and C10 never run at the same time as TKT-26 C5 (paused as of this writing). `AskRequest`, `AskIds`, and `AskPrompts` stay in `AskEndpoint.cs`. If C9 lands first, C5 puts its request-shape change in `AskHandler.RunAsync`.

## Brainstorm
skipped

## Acceptance criteria

Serves PROJECT.md workflow 2, "Ask in plain language and get a graph you can inspect". Its Done line asks for Claude scoring at least 8 correct and 0 wrong on the committed Ask set, and the IFC ask answering the eight questions to match `expected_answers.json`. This plan builds the path those measurements run on. The measurements belong to TKT-8 and TKT-41.

- `ASK_PROVIDER=claude-cli`, or an executable found with no `ASK_PROVIDER` set (open question 2), makes `POST /api/ask` answer through the Claude Code command line:
  - the studio's own MCP tool server, under the name `bimopenflow`, is the only tool source;
  - the model is `claude-haiku-4-5-20251001` and the effort is `medium`, unless `ASK_CLAUDE_MODEL` or `ASK_CLAUDE_EFFORT` says otherwise;
  - the SSE stream still sends `start`, then `tool` and `text` events as calls happen, then `check` and `done` (or `error`), with the same fields as today, so the transcript strip in `duckdbDemo.ts` and `scripts/ask-bim-flow.mjs` work unchanged;
  - the graph the agent built exists in the studio's own store, and the host's check rounds see it without a reload.
- A follow-up (`analysisId` given) and each host check round continue the same Claude Code session with `--resume <session_id>`. After a host restart, a follow-up starts a new session with the "read the graph first" prompt, as today.
- `GET /api/ask/model` returns `provider`, `model`, `effort`, `executable` (for `claude-cli`), `configured`, and `problem`. When no `claude` executable is found, it returns `configured: false` and one plain sentence saying how to install and log in.
- `bimopenmcp-ifc-ask` answers questions through the same command-line path, with the IFC server under the name `bimopen-ifc`. With `ASK_PROVIDER=claude-cli`, no `ANTHROPIC_*` variable is read by the host or passed to the child process. Each question is its own session.
- The IFC transcript header records provider, model, and effort, for example `- Language model: claude-haiku-4-5-20251001 (claude-cli, effort medium)`. `scripts/ask-bim-flow.mjs` prints the same on its first line, and the Ask transcript records it there.
- `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, `OPENAI_MODEL`, and `OPENAI_REASONING_EFFORT` behave as before for the API providers.
- The spawned CLI:
  - has no built-in tools (`--tools ""`), so it cannot read or write the repository;
  - loads no settings files, hooks, plugins, skills, or MCP servers other than ours;
  - asks for no permission;
  - runs in a work folder under `%TEMP%`;
  - receives no `ANTHROPIC_*` variables and none of the `CLAUDECODE` or `CLAUDE_*` variables a parent Claude Code session sets.
- Each failure reaches the caller as one exception with one sentence. `AskHandler` reports it as the `error` event, and the IFC runner records it as "Not answered: ...". The failures are:
  - a missing executable, which is also caught at selection time;
  - a process that fails to start;
  - a `result` line with `is_error` (for example "Not logged in"), or the turn limit;
  - a non-zero exit with no result line;
  - an MCP server the CLI reports as not connected;
  - a timeout.
- `tests/studio` run the whole loop against a fake `claude.cmd` (a Node script) that calls the real tool server over HTTP. CI needs no account and no network.
- Out of scope:
  - running the TKT-8 and TKT-41 measurements;
  - changing the web app;
  - persisting sessions across host restarts;
  - probing the login state before the first request;
  - telling the model about repeated identical calls on the CLI path (see Extension points).

Evidence:
- Automated: `dotnet test tests/studio/BimOpenFlow.Studio.Tests` passes `AskHandlerTests`. One request runs through `fake-claude/claude.cmd`, emits `start`, `tool addNode`, `tool evaluate`, `check`, and `done` (`built: true`). The fake's call log shows `--model claude-haiku-4-5-20251001 --effort medium` on the first run, and `--resume fake-session-0` with `AskPrompts.Check(...)` on stdin for the check round.
- Real use, by the owner after `claude` and `/login`: run `$env:ASK_PROVIDER="claude-cli"`, then `npm run duckdb:host --prefix bimopenflow/web`, then `node scripts/ask-bim-flow.mjs "How many walls are in this export?"`. The first line should read `Studio at http://127.0.0.1:5218, model claude-haiku-4-5-20251001 (claude-cli, effort medium)`, and the summary should end with an `OK` line and one row (1277). Then run `bimopenmcp-ifc-ask --model data/duplex.ifc "How many building storeys are there?"`. Its header should read `- Language model: claude-haiku-4-5-20251001 (claude-cli, effort medium)`, followed by at least one `**Agent calls** \`ifc_open\``.

Kill criteria:
- If S1 or the owner's first logged-in run shows the CLI's `init` line listing built-in tools or MCP servers other than ours, despite `--tools ""` and `--strict-mcp-config`, stop before C7 and ask the owner. The CLI could then touch the repository.
- If the CLI cannot connect to Ara3D.MCP over HTTP (`mcp_servers[].status` is not `connected`), do not abandon the plan. Switch C7 to the stdio fallback described under Considered and rejected.

## Design

**One small interface both callers use (question 1).** `IAskBackend.Start(system)` returns an `IAskConversation`. Its `SendAsync(user, emit, ct)` returns an `AskOutcome` and reports `AskEvent`s. There are two implementations:
- `ChatBackend` wraps today's `AskAgent` over an `IChatModel`. The conversation holds the `JsonArray` of messages.
- `ClaudeCliBackend` hands the whole tool loop to `claude -p`. The conversation holds the CLI's `session_id`.

The studio and the IFC runner hold an `IAskBackend` and never branch on provider. `ChatSelection.CreateBackend(setup, http)` is the only place that picks an implementation. `AskSetup` (tool server, server key, hidden tools, turn limit) replaces the `McpServer` and `maxTurns` arguments the callers pass today.

**HTTP, not stdio (question 2).** The planner read `submodules/ara3d-sdk/wip/Ara3D.MCP` and checked that the NuGet 1.6.1 binary has the same members:
- `McpServer.Start()` with `McpTransport.Http` runs an `HttpListener` at `http://127.0.0.1:<port>/mcp`.
- POST returns `application/json` JSON-RPC responses, or 202 for notifications. GET returns 405. There is no session header.

That is a valid Streamable HTTP server without SSE, which is what Claude Code's `"type": "http"` client speaks. A probe on this machine confirmed that a non-admin `HttpListener` can bind `http://127.0.0.1:<port>/`.

Each caller registers its tools on an `McpServer` built on a free loopback port (`LoopbackPorts.Free()`, not the fixed 8766). `ClaudeCliBackend` starts that server and writes `{"mcpServers":{"<key>":{"type":"http","url":"<server.Url>"}}}` to its work folder. One process then owns the store:
- the studio's `FlowServices` and `AnalysisSessions` see every edit;
- `AskChecks.Verify` works as today;
- the finished graph opens without a reload;
- the IFC file is parsed once per run, not once per question.

S1 confirms the CLI's side before C7 relies on it.

**Follow-ups (question 3).** `AskHandler` keeps the last 24 conversations by analysis id, as `IAskConversation` objects instead of `JsonArray`s. `ClaudeCliConversation` starts with no session id. It records `session_id` from the `init` or `result` line and passes `--resume <id>` on every later `SendAsync`, for both follow-ups and check rounds. Every call passes the full argument list, including `--system-prompt-file`. Resuming reuses the recorded system prompt, so passing it again is harmless and keeps one argument builder. Sessions persist in Claude Code's store for the work folder, so the work folder must be the same for every call: `%TEMP%\bimopenflow-ask\claude-cli`. After a host restart the map is empty, and the existing `FollowUp(resumed: true)` path starts a new session.

**Isolation (question 4).** Every call passes:

```
-p --output-format stream-json --verbose --model <m> --effort <e>
--system-prompt-file <work>\system-<hash>.md --mcp-config <work>\mcp-<key>-<port>.json --strict-mcp-config
--setting-sources "" --tools "" --allowedTools mcp__<key> --disallowedTools mcp__<key>__<hidden>,...
--permission-mode dontAsk --disable-slash-commands --max-turns <n> [--resume <id>]
```

- The user text goes on stdin (UTF-8, no BOM). The system prompt goes in a file. The studio's system prompt carries the whole node catalog and would exceed cmd.exe's 8,191-character limit once the npm `claude.cmd` shim is involved, and newlines do not survive `%*`.
- `--bare` is ruled out: its help text says it never reads OAuth, so it could not use the owner's login.
- The working directory is the work folder.
- The child environment drops every `ANTHROPIC_*` variable, and every `CLAUDECODE` and `CLAUDE_*` variable except `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_OAUTH_TOKEN`, and `CLAUDE_CODE_GIT_BASH_PATH`. `CLAUDECODE` must go because a nested `claude` refuses to start inside a Claude Code session, which is how the measurements will be run. Which of the other dropped variables matter is unconfirmed.
- On cancellation (the browser leaves) or after a 10-minute timeout per `SendAsync`, the process tree is killed.

**Errors (question 5).** Everything becomes a `ClaudeCliException` thrown from `SendAsync`:
- a missing `ASK_CLAUDE_CLI` file, or no executable anywhere, becomes `ChatSelection.Problem`, so `configured: false` shows before any request;
- `Win32Exception` on start becomes "Could not start Claude Code at <path>: <message>.";
- an `init` line whose server status is not `connected` kills the process and becomes "Claude Code could not connect to the <key> tool server at <url> (status <s>).";
- a `result` with `subtype: error_max_turns` becomes `AskAgent.TurnLimitMessage(n)`, the same wording the API path uses;
- any other `result` with `is_error: true` becomes "Claude Code: <result text or subtype>", for example "Claude Code: Not logged in · Please run /login";
- no result line and a non-zero exit becomes "Claude Code exited with code <n>: <last 400 characters of stderr, or 'no output'>";
- a timeout becomes "Claude Code did not finish within 10 minutes."

`AskHandler` catches everything except `OperationCanceledException` and emits `{type:"error", message}`. `IfcAskRunner` records "Not answered: <message>". Events emitted before the failure stay in the transcript.

**Parsing.** `ClaudeStream` is a pure line reader:
- `system/init` gives the session id and server statuses.
- An `assistant` text block is held until the next `tool_use` arrives, then emitted as a `text` event. The last held text is the final answer and is dropped, because `result.result` carries it. This matches `AskAgent`, which emits text only between tool calls.
- `tool_use` records the id, the name with `mcp__<key>__` stripped, and the input.
- A `user/tool_result` (content is a string or an array of text blocks) becomes a `tool` event. `AskAgent.ReadResult` supplies `ok` and the summary, so `Summarize` works as it does in process, and `is_error` forces `ok: false`.
- `result` gives the text, `num_turns`, and tokens. Input tokens are input plus `cache_read` plus `cache_creation`, as `AnthropicChat` counts them.
- Lines that are not JSON, and unknown types, are ignored.

**Where it lives.** Everything new is in the `BimOpenFlow.Ask` library: the CLI files go in `src/studio/BimOpenFlow.Ask/ClaudeCli/` under the same namespace, and `ChatBackend.cs`, `IAskBackend.cs`, and `LoopbackPorts.cs` go at the top. Both executables already reference that library, so no new library and no layering change are needed. The studio gains `AskHandler.cs`, which moves the request logic out of the endpoint lambda so it can be tested without Kestrel.

The fake executable is `tests/studio/fake-claude/` (`claude.cmd` plus `fake-claude.mjs`), copied into both test outputs. It is not a project, so the solution file and the layering test do not change. It exercises the `.cmd` path that `npm install -g @anthropic-ai/claude-code` produces.

**Locating the executable.** The locator checks, in order:
1. `ASK_CLAUDE_CLI`, which must name an existing file; a missing one is an error, as `ApiKeys` treats a missing key file;
2. the first `claude.exe` or `claude.cmd` on `PATH`;
3. the highest-versioned `%APPDATA%\Claude\claude-code\<version>\claude.exe`.

**Risks, not blockers:**
- Whether Claude Code honours `--effort` on Haiku 4.5 is unverified. The transcripts record the effort that was requested.
- Claude Code truncates large MCP results (`MAX_MCP_OUTPUT_TOKENS`). A big `getResult` may reach the model shortened.
- The plan assumes the CLI runs MCP tools without a `readOnlyHint` one at a time. The HTTP listener serves requests concurrently; that is unconfirmed.
- The loopback listener has no authentication while the studio or the IFC ask runs. That matches the Ask endpoint, and its Origin check blocks browsers from other origins. The Limits paragraph of the docs will say so.

Retires:
- `AskEndpoint`'s inline `JsonArray` conversation map, per-request `AskAgent` construction, and check-round loop (moved into `AskHandler` over `IAskConversation`);
- `IfcAskRunner`'s `(McpServer, IChatModel, modelPath, maxTurns)` constructor;
- the fixed `McpServer.DefaultPort` in the two Ask servers;
- the key-only `ChatSelection.NoKey` sentence.

The API providers are not retired.

## Considered and rejected

- **Option:** a `ClaudeCliChat : IChatModel` that drives `claude -p` one model turn at a time and keeps `AskAgent` as the loop.
  **Reason:** the CLI runs tool calls itself; it has no mode that returns them unexecuted. Each turn would have to replay the whole conversation as a prompt with `--max-turns 1`, which loses the CLI's session and prompt cache and fights the tool.
  **Would change if:** Claude Code offers a print mode that returns `tool_use` blocks without running them.
- **Option:** stdio, with the CLI launching the built `artifacts/bim-flow-duckdb/mcp/bimopenmcp-flow.dll` (and `bimopenmcp-ifc.dll`) with the same `--store`, `--cache`, and `--models` arguments.
  **Reason:** it needs a second process with its own `FlowServices`. The studio's `AnalysisSessions` cache goes stale, so `AskChecks.Verify` and the editor miss the agent's edits: TKT-26 C3 (the host picks up external writes) has not landed. It also depends on built artifacts, duplicates the host arguments, and reparses the IFC file for every question.
  **Would change if:** S1 shows Claude Code cannot connect to Ara3D.MCP over HTTP, or TKT-26 C3 lands and the IFC cost is accepted.
- **Option:** serve MCP from the studio's own Kestrel app at `/api/ask/mcp` instead of a second listener.
  **Reason:** the IFC ask has no Kestrel, so there would be two ways to expose tools. `McpServer.Start()` on a free port serves both callers.
  **Would change if:** the repeated-call note should reach the model on the CLI path, which needs a proxy in front of `tools/call`.
- **Option:** a C# console project as the fake `claude`.
  **Reason:** it needs a solution entry, and whether the SDK copies a referenced executable's apphost into the test output is uncertain. The Node script plus `.cmd` shim is certain to copy, and it exercises the npm shim path the docs install.
  **Would change if:** CI loses Node.
- **Option:** `--bare` or `--safe-mode` for isolation.
  **Reason:** `--bare` accepts only `ANTHROPIC_API_KEY` or `apiKeyHelper`, never OAuth, according to the 2.1.281 help. `--safe-mode` disables MCP servers, possibly including `--mcp-config` ones.
  **Would change if:** the owner moves to an API key (decided against), or the help clarifies `--safe-mode`.
- **Option:** `IAskBackend` exposing `Provider`, `Model`, and `Effort`.
  **Reason:** `ChatSelection` already carries them, and tests that build a backend directly would have to invent them.
  **Would change if:** a backend is ever created without a selection in production.
- **Option (supervisor):** `claude-cli` as the default only when no API key is set, as the ticket first said.
  **Reason:** a leftover key in the owner's profile would route requests to the retired account without anyone choosing it. Open question 2 puts the CLI first when its executable exists.
  **Would change if:** the owner wants API keys honoured without `ASK_PROVIDER`.

## Signatures and contracts

These are read-only for every chunk. C1 compiles the contracts in its fence.

`src/studio/BimOpenFlow.Ask/IAskBackend.cs` (C1):

```csharp
using Ara3D.MCP;
namespace BimOpenFlow.Ask;

/// <summary>Starts conversations with an agent that answers by calling one MCP server's tools.
/// ChatBackend runs the tool loop in process over an IChatModel; ClaudeCliBackend hands it to
/// the Claude Code command line.</summary>
public interface IAskBackend
{
    IAskConversation Start(string system);
}

/// <summary>One conversation. Each send adds a user message and lets the agent work until it
/// answers, reporting tool calls and interim text through emit; later sends see everything
/// earlier ones did. Throws with one sentence a person can act on when no answer comes.</summary>
public interface IAskConversation
{
    Task<AskOutcome> SendAsync(string user, Func<AskEvent, Task> emit, CancellationToken ct);
}

/// <summary>The tool server a backend drives, the name the model knows it by (Claude Code
/// prefixes tools with mcp__{ServerKey}__), the tools not offered, and the model-turn limit
/// per message.</summary>
public sealed record AskSetup(McpServer Tools, string ServerKey, IReadOnlySet<string> Hidden, int MaxTurns);
```

`src/studio/BimOpenFlow.Ask/LoopbackPorts.cs` (C1):

```csharp
public static class LoopbackPorts
{
    /// <summary>A TCP port on 127.0.0.1 that was free a moment ago (bind to 0, read, release).</summary>
    public static int Free() => throw new NotImplementedException();
}
```

`src/studio/BimOpenFlow.Ask/ClaudeCli/ClaudeCliSettings.cs` (C1):

```csharp
public sealed record ClaudeCliSettings(string Executable, string Model, string Effort, string WorkDirectory)
{
    public const string ModelVariable = "ASK_CLAUDE_MODEL";
    public const string EffortVariable = "ASK_CLAUDE_EFFORT";
    public const string DefaultModel = "claude-haiku-4-5-20251001";
    public const string DefaultEffort = "medium";
    public static string DefaultWorkDirectory => Path.Combine(Path.GetTempPath(), "bimopenflow-ask", "claude-cli");
    public TimeSpan Timeout { get; init; } = TimeSpan.FromMinutes(10);
}
```

`AskAgent` additions (C2, a refactor; `Execute` calls both):

```csharp
/// <summary>Reads a tool's result text as the loop does: the envelope compacted when it parses,
/// ok from its 'ok' flag, and Summarize's one line; text that is not an envelope is a failure.</summary>
public static (bool Ok, string Result, string Summary) ReadResult(string name, string text);
public static string TurnLimitMessage(int maxTurns); // "Stopped after {n} model turns without a final answer."
```

Example: `ReadResult("getResult", "{\n \"ok\": true, \"data\": {\"totalRows\": 142, \"columns\": [{\"name\":\"Mark\"},{\"name\":\"Storey\"}]}}")` returns `(true, "{\"ok\":true,\"data\":{\"totalRows\":142,\"columns\":[{\"name\":\"Mark\"},{\"name\":\"Storey\"}]}}", "142 rows; columns Mark, Storey")`.

`src/studio/BimOpenFlow.Ask/ChatBackend.cs` (C3):

```csharp
public sealed class ChatBackend(AskSetup setup, IChatModel chat) : IAskBackend
{
    /// <summary>One AskAgent (Hidden = setup.Hidden, maxTurns = setup.MaxTurns) and one message
    /// list per conversation; SendAsync is AskAgent.RunAsync(messages, user, emit, ct).</summary>
    public IAskConversation Start(string system) => throw new NotImplementedException();
}
```

`src/studio/BimOpenFlow.Ask/ClaudeCli/ClaudeCliLocator.cs` (C4):

```csharp
public static class ClaudeCliLocator
{
    public const string Variable = "ASK_CLAUDE_CLI";
    public static readonly IReadOnlyList<string> Names = ["claude.exe", "claude.cmd"];
    /// <summary>ASK_CLAUDE_CLI (throws FileNotFoundException when it names a missing file); else
    /// the first Names match in each PATH directory in order; else the highest-Version
    /// %APPDATA%\Claude\claude-code\<version>\claude.exe; else null.</summary>
    public static string? Find(Func<string, string?> environment, Func<string, bool>? fileExists = null,
        Func<string, IEnumerable<string>>? subdirectories = null);
}
```

Example: with `PATH=C:\a;C:\b`, `APPDATA=C:\R`, and the files `C:\b\claude.cmd`, `C:\R\Claude\claude-code\2.1.280\claude.exe`, and `C:\R\Claude\claude-code\2.1.281\claude.exe`, `Find` returns `C:\b\claude.cmd`. Without `C:\b\claude.cmd` it returns `C:\R\Claude\claude-code\2.1.281\claude.exe`. The version comparison uses `System.Version`, so 2.10.0 ranks above 2.9.9.

`src/studio/BimOpenFlow.Ask/ClaudeCli/ClaudeCliArguments.cs` (C5):

```csharp
public static class ClaudeCliArguments
{
    public static IReadOnlyList<string> Build(ClaudeCliSettings settings, AskSetup setup,
        string systemPromptFile, string mcpConfigFile, string? resumeSessionId);
    public static string McpConfig(string serverKey, string url);
    public static readonly IReadOnlySet<string> KeptVariables; // CLAUDE_CONFIG_DIR, CLAUDE_CODE_OAUTH_TOKEN, CLAUDE_CODE_GIT_BASH_PATH
    /// <summary>Removes ANTHROPIC_* and CLAUDECODE / CLAUDE_* (except KeptVariables) by name;
    /// never reads a value.</summary>
    public static void PrepareEnvironment(IDictionary<string, string?> environment);
}
```

Example: `Build(new("claude.cmd", "claude-haiku-4-5-20251001", "medium", @"C:\T"), new(tools, "bimopenflow", {"listDatabases","getNodeCatalog"}, 60), @"C:\T\system-ab12cd34.md", @"C:\T\mcp-bimopenflow-50123.json", null)` returns:

```
["-p","--output-format","stream-json","--verbose","--model","claude-haiku-4-5-20251001","--effort","medium",
 "--system-prompt-file","C:\T\system-ab12cd34.md","--mcp-config","C:\T\mcp-bimopenflow-50123.json","--strict-mcp-config",
 "--setting-sources","","--tools","","--allowedTools","mcp__bimopenflow",
 "--disallowedTools","mcp__bimopenflow__getNodeCatalog,mcp__bimopenflow__listDatabases",
 "--permission-mode","dontAsk","--disable-slash-commands","--max-turns","60"]
```

Hidden names are sorted ordinally. With `resumeSessionId: "s1"`, the list ends with `"--resume","s1"`. `McpConfig("bimopenflow", "http://127.0.0.1:50123/mcp")` returns `{"mcpServers":{"bimopenflow":{"type":"http","url":"http://127.0.0.1:50123/mcp"}}}`.

`src/studio/BimOpenFlow.Ask/ClaudeCli/ClaudeStream.cs` (C6):

```csharp
public sealed record ClaudeResult(bool IsError, string Subtype, string Text, int Turns, long InputTokens,
    long OutputTokens, string? SessionId);
public sealed record McpServerStatus(string Name, string Status);

public sealed class ClaudeStream(string serverKey)
{
    public string? SessionId { get; }
    public IReadOnlyList<McpServerStatus>? Servers { get; } // null until the init line
    public ClaudeResult? Result { get; }
    /// <summary>The events this line completes (zero or more).</summary>
    public IReadOnlyList<AskEvent> Read(string line);
    public static string ToolName(string serverKey, string cliName); // "mcp__bimopenflow__evaluate" -> "evaluate"
}
```

Example input, one JSON object per line:
1. `{"type":"system","subtype":"init","session_id":"s1","mcp_servers":[{"name":"bimopenflow","status":"connected"}]}`
2. `{"type":"assistant","message":{"content":[{"type":"text","text":"Let me look."}]}}`
3. `{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1","name":"mcp__bimopenflow__evaluate","input":{"id":"ask-walls"}}]}}`
4. `{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"text","text":"{\"ok\":true,\"data\":{\"nodes\":[{\"nodeId\":\"answer\",\"status\":\"Ok\"}]}}"}],"is_error":false}]}}`
5. `{"type":"assistant","message":{"content":[{"type":"text","text":"1277 walls."}]}}`
6. `{"type":"result","subtype":"success","is_error":false,"result":"1277 walls.","session_id":"s1","num_turns":3,"usage":{"input_tokens":10,"cache_read_input_tokens":900,"cache_creation_input_tokens":90,"output_tokens":40}}`

Events: line 3 yields `AskEvent("text", Text: "Let me look.")`. Line 4 yields `AskEvent("tool", "evaluate", {"id":"ask-walls"}, true, "1 nodes Ok")`. Lines 1, 2, 5, and 6 yield none. `Result` is `(false, "success", "1277 walls.", 3, 1000, 40, "s1")`.

`src/studio/BimOpenFlow.Ask/ClaudeCli/` (C7):

```csharp
public sealed class ClaudeCliException(string message) : Exception(message);

public sealed class ClaudeCliBackend : IAskBackend
{
    public const string ProviderName = "claude-cli";
    /// <summary>Starts setup.Tools over HTTP if it is not listening (ArgumentException when its
    /// transport is not HTTP; ClaudeCliException when the listener cannot start), creates the
    /// work directory, and writes mcp-{key}-{port}.json there.</summary>
    public ClaudeCliBackend(AskSetup setup, ClaudeCliSettings settings);
    /// <summary>Writes system-{first 16 hex of SHA-256}.md to the work directory; the conversation
    /// has no session until its first send.</summary>
    public IAskConversation Start(string system);
}

internal static class ClaudeCliProcess
{
    /// <summary>One run: arguments, environment trimmed by PrepareEnvironment, input on stdin
    /// (UTF-8, no BOM, then closed), each stdout line to onLine in order, the last 2,000
    /// characters of stderr kept. Kills the process tree on cancellation, on timeout
    /// (ClaudeCliException), or when onLine throws (rethrown).</summary>
    public static Task<(int ExitCode, string StandardErrorTail)> RunAsync(string executable,
        IReadOnlyList<string> arguments, string workDirectory, string input, Func<string, Task> onLine,
        TimeSpan timeout, CancellationToken ct);
}
```

`ChatSelection` (C8). The positional constructor is unchanged:

```csharp
public sealed record ChatSelection(string Provider, string Model, string? Problem)
{
    public string? Effort { get; init; }      // claude-cli: ASK_CLAUDE_EFFORT or "medium"; anthropic: ANTHROPIC_EFFORT; openai: OPENAI_REASONING_EFFORT
    public string? Executable { get; init; }  // claude-cli only
    public const string NoProvider = "...";   // replaces NoKey: install the CLI and /login, or ASK_CLAUDE_CLI, or an API key
    public const string ClaudeCliMissing = "..."; // ASK_PROVIDER=claude-cli and no executable found
    public static ChatSelection Resolve(Func<string, string?>? environment = null);
    public IChatModel Create(HttpClient http, Func<string, string?>? environment = null); // API providers; throws for claude-cli
    public IAskBackend CreateBackend(AskSetup setup, HttpClient http, Func<string, string?>? environment = null);
}
```

Resolution order (open question 2): `ASK_PROVIDER` when set; else `claude-cli` when an executable is found; else the first API provider with a key; else `NoProvider`.

Examples:
- `{ASK_PROVIDER: "claude-cli", ASK_CLAUDE_CLI: <existing file>}` returns `("claude-cli", "claude-haiku-4-5-20251001", null)` with `Effort` `"medium"` and `Executable` set to that file. The environment function is never asked for a name starting with `ANTHROPIC_`.
- With nothing set, and so no `PATH`, it returns `("claude-cli", "", NoProvider)`.
- With an executable on `PATH` and `ANTHROPIC_API_KEY` set but no `ASK_PROVIDER`, the provider is `claude-cli`.

`src/studio/BimOpenFlow.Studio/AskHandler.cs` (C9, extended in C10):

```csharp
public sealed class AskHandler(FlowServices services, IAskBackend backend, Func<string> system, string model /*, string? effort (C10) */)
{
    public const int ConversationsKept = 24;
    public const int CheckRounds = 2;
    /// <summary>One request: empty-request error, pick or continue the conversation, start, tool
    /// and text events, the host's check rounds, done; any failure but cancellation becomes the
    /// error event. The caller holds the one-at-a-time gate.</summary>
    public Task RunAsync(AskRequest body, Func<object, Task> emit, CancellationToken ct);
}
```

After C10, the payloads are today's plus `effort` on `start` and `done`. `GET /api/ask/model` returns `{ model, provider, effort, executable, configured, problem }`.

`IfcAskRunner` and `IfcAskReport` (C11 and C12):

```csharp
public sealed class IfcAskRunner(IAskBackend backend, string modelPath)          // C11
{
    public const int DefaultMaxTurns = 40;
    public const string ServerKey = "bimopen-ifc";
    public static AskSetup Setup(McpServer tools, int maxTurns = DefaultMaxTurns);
    public static McpServer CreateServer(IfcSessionCache cache);                  // C12: on LoopbackPorts.Free()
}
public sealed record Header(DateTimeOffset Date, string Model, string IfcPath, string? Commit)
{
    public string? Provider { get; init; }  // C12: "- Language model: {Model} ({Provider}, effort {Effort ?? "default"})" when Provider is set
    public string? Effort { get; init; }
}
```

Fake claude (C7, in `tests/studio/fake-claude/`):
- `claude.cmd` is `@node "%~dp0fake-claude.mjs" %*`.
- It reads `<cwd>/fake-claude-script.json`: `{"runs":[{"steps":[...]}, ...]}`. Run *k* serves the *k*-th invocation, counted by the lines already in the call log.
- Before anything else, it appends one line to `<cwd>/fake-claude-calls.jsonl`: `{"args":[...],"stdin":"...","env":["<names starting ANTHROPIC or CLAUDE>"]}`.
- It prints an `init` line first. `session_id` is the `--resume` value, else `fake-session-<k>`. `mcp_servers` holds the single key from `--mcp-config` with status `connected` if a `tools/list` POST to its URL answers, else `failed`. `tools` holds the listed tools minus `--disallowedTools`, prefixed.
- Steps:
  - `{"text": s}` prints an assistant text line.
  - `{"call": tool, "args": {...}}` prints a `tool_use` line, POSTs `tools/call` to the URL, and prints a `tool_result` line with `result.content` and `is_error` set from `result.isError` (or from the JSON-RPC error message).
  - `{"result": s}` prints a success result with `num_turns` = calls + 1, `usage` of 100 input and 20 output tokens per turn, and the session id.
  - `{"error": s}` prints `{"type":"result","subtype":"success","is_error":true,"result":s}`. S1 corrects this shape if it differs.
  - `{"maxTurns": true}` prints `subtype: error_max_turns` with `is_error: true`.
  - `{"exit": n, "stderr": s}` writes to stderr and exits with no result.
  - `{"sleep": ms}` waits.
- Test projects copy the folder with `<None Include="..\fake-claude\**" LinkBase="fake-claude" CopyToOutputDirectory="PreserveNewest" />` and run `Path.Combine(AppContext.BaseDirectory, "fake-claude", "claude.cmd")`.

## Extension points

- Probe `claude auth status` once at startup, so `/api/ask/model` reports "not logged in" before the first request.
- Persist the analysis-id-to-session-id map in the store, so follow-ups survive a host restart.
- Tell the model about repeated identical calls on the CLI path. `AskAgent`'s `RepeatNote` needs a proxy in front of `tools/call`. Today the CLI path marks nothing.
- Clean up old session files under `~/.claude/projects/<work-folder slug>` and old `system-*.md` files. Pass `--no-session-persistence` for the IFC ask, which never resumes.
- Show effort in the Ask box tooltip (`bimopenflow/web/packages/app/src/duckdbDemo.ts`), and record provider, model, and effort in the IFC results JSON.
- Keep one CLI process per conversation with `--input-format stream-json`, to save start-up time per message.
- Add `readOnlyHint` annotations to the read-only MCP tools, so Claude Code may run them in parallel.

## Chunks

All paths are relative to `C:\Users\cdigg\git\bim-open-toolkit`. `Ask/` means `src/studio/BimOpenFlow.Ask/` and `STests/` means `tests/studio/BimOpenFlow.Studio.Tests/`.

**Spike S1** runs before C7 and is not a commit (open question 3). Time limit: 30 minutes. Work in a folder under `%TEMP%`, never in the repository.
1. Start `BimOpenMcp.Flow` with `--http <port>` over a temp store.
2. Write the MCP config and a one-line system prompt file.
3. Run `"$env:APPDATA\Claude\claude-code\2.1.281\claude.exe"` with C5's exact argument list, `hello` on stdin, and `CLAUDECODE` removed.
4. Record:
   - whether any flag is rejected, especially `--setting-sources ""`, `--tools ""`, `--system-prompt-file`, and `--permission-mode dontAsk`;
   - whether `init` appears before the login failure, and if so its `tools`, `mcp_servers` status, and `slash_commands`;
   - the exact result line for "Not logged in".

The answer goes into Considered and rejected. The result shape goes into the fake. If the server is not `connected`, C7 takes the stdio fallback.

| Id | One-sentence commit | Fence (writes only) | Depends on | Test command | Resources |
|---|---|---|---|---|---|
| C1 | Add the IAskBackend and IAskConversation contracts, AskSetup, ClaudeCliSettings, and a free loopback port helper | `Ask/IAskBackend.cs` (new), `Ask/LoopbackPorts.cs` (new), `Ask/ClaudeCli/ClaudeCliSettings.cs` (new), `STests/LoopbackPortsTests.cs` (new) | - | `dotnet test tests/studio/BimOpenFlow.Studio.Tests` | loopback free port; dotnet build lock |
| C2 | AskAgent reads tool results through a public ReadResult and names its turn limit through TurnLimitMessage (refactor) | `Ask/AskAgent.cs` | - | `dotnet test tests/studio/BimOpenFlow.Studio.Tests && dotnet test tests/studio/BimOpenMcp.Ifc.Ask.Tests` | dotnet build lock |
| C3 | Add ChatBackend, the in-process tool loop as an IAskBackend | `Ask/ChatBackend.cs` (new), `STests/ChatBackendTests.cs` (new), `STests/ScriptedChat.cs` (new; the nested ScriptedModel moved out unchanged), `STests/AskAgentTests.cs` | C1 | `dotnet test tests/studio/BimOpenFlow.Studio.Tests` | dotnet build lock |
| C4 | Find the claude executable from ASK_CLAUDE_CLI, PATH, or the desktop app's bundled copy | `Ask/ClaudeCli/ClaudeCliLocator.cs` (new), `STests/ClaudeCliLocatorTests.cs` (new) | - | `dotnet test tests/studio/BimOpenFlow.Studio.Tests` | temp dirs; dotnet build lock |
| C5 | Build the pinned claude arguments, MCP config, and trimmed child environment | `Ask/ClaudeCli/ClaudeCliArguments.cs` (new), `STests/ClaudeCliArgumentsTests.cs` (new) | C1 | `dotnet test tests/studio/BimOpenFlow.Studio.Tests` | dotnet build lock |
| C6 | Read Claude Code's stream-json output into Ask events and a result | `Ask/ClaudeCli/ClaudeStream.cs` (new), `STests/ClaudeStreamTests.cs` (new) | C2 | `dotnet test tests/studio/BimOpenFlow.Studio.Tests` | dotnet build lock |
| C7 | Add ClaudeCliBackend, which runs each message through claude -p against the tool server over HTTP, with a fake claude for tests | `Ask/ClaudeCli/ClaudeCliBackend.cs` (new), `Ask/ClaudeCli/ClaudeCliConversation.cs` (new), `Ask/ClaudeCli/ClaudeCliProcess.cs` (new), `Ask/ClaudeCli/ClaudeCliException.cs` (new), `tests/studio/fake-claude/claude.cmd` (new), `tests/studio/fake-claude/fake-claude.mjs` (new), `tests/studio/fake-claude/README.md` (new), `STests/BimOpenFlow.Studio.Tests.csproj`, `STests/ClaudeCliBackendTests.cs` (new), `tests/studio/README.md` | C1, C5, C6; S1 answered | `dotnet test tests/studio/BimOpenFlow.Studio.Tests` | node on PATH; loopback free port; temp work dir; dotnet build lock |
| C8 | ChatSelection offers claude-cli (first when an executable is found), reports effort, and creates backends | `Ask/ChatSelection.cs`, `Ask/README.md`, `STests/AnthropicChatTests.cs` | C3, C4, C7 | `dotnet test tests/studio/BimOpenFlow.Studio.Tests` | dotnet build lock |
| C9 | The Ask endpoint runs each request through an AskHandler over ChatBackend (refactor) | `src/studio/BimOpenFlow.Studio/AskEndpoint.cs`, `src/studio/BimOpenFlow.Studio/AskHandler.cs` (new) | C3 | `dotnet build src/studio/BimOpenFlow.Studio && dotnet test tests/studio/BimOpenFlow.Studio.Tests` | dotnet build lock; not concurrent with TKT-26 C5 |
| C10 | The studio answers through the selected backend, claude-cli included, and reports provider, model, and effort | `src/studio/BimOpenFlow.Studio/AskEndpoint.cs`, `src/studio/BimOpenFlow.Studio/AskHandler.cs`, `src/studio/BimOpenFlow.Studio/Program.cs`, `STests/AskHandlerTests.cs` (new) | C8, C9 | `dotnet build src/studio/BimOpenFlow.Studio && dotnet test tests/studio/BimOpenFlow.Studio.Tests` | node; loopback free port; dotnet build lock; not concurrent with TKT-26 C5 |
| C11 | IfcAskRunner asks through an IAskBackend (refactor) | `src/studio/BimOpenMcp.Ifc.Ask/IfcAskRunner.cs`, `src/studio/BimOpenMcp.Ifc.Ask/Program.cs`, `tests/studio/BimOpenMcp.Ifc.Ask.Tests/IfcAskRunnerTests.cs`, `tests/studio/BimOpenMcp.Ifc.Ask.Tests/DuplexAskTests.cs` | C3 | `dotnet test tests/studio/BimOpenMcp.Ifc.Ask.Tests` | dotnet build lock |
| C12 | The IFC ask selects its backend, claude-cli included, over the bimopen-ifc server and records provider and effort in the transcript header | `src/studio/BimOpenMcp.Ifc.Ask/Program.cs`, `src/studio/BimOpenMcp.Ifc.Ask/IfcAskRunner.cs`, `src/studio/BimOpenMcp.Ifc.Ask/IfcAskReport.cs`, `src/studio/BimOpenMcp.Ifc.Ask/README.md`, `tests/studio/BimOpenMcp.Ifc.Ask.Tests/BimOpenMcp.Ifc.Ask.Tests.csproj`, `tests/studio/BimOpenMcp.Ifc.Ask.Tests/IfcAskReportTests.cs`, `tests/studio/BimOpenMcp.Ifc.Ask.Tests/IfcAskCliTests.cs` (new) | C8, C11 | `dotnet test tests/studio/BimOpenMcp.Ifc.Ask.Tests` | node; loopback free port; dotnet build lock |
| C13 | Document the Claude Code setup and print provider, model, and effort in the Ask script | `docs/bim-flow-mcp-demo.md`, `docs/START.md`, `scripts/ask-bim-flow.mjs` | C10, C12 | `node --check scripts/ask-bim-flow.mjs && dotnet test tests/BimOpenToolkit.Layering.Tests` | none; not concurrent with TKT-26 C8 or TKT-41 (both edit `docs/bim-flow-mcp-demo.md`) |

Parallel waves (the fences within each wave are disjoint, but the C# chunks share the dotnet build lock, so builds run one at a time):
1. C1, C2, C4
2. C3, C5, C6
3. C7, C9, C11
4. C8
5. C10, C12
6. C13

**What each chunk must test:**

- **C1:** `LoopbackPorts.Free()` returns a port between 1024 and 65535. An `McpServer` built on it with `McpTransport.Http` starts, and a raw `HttpClient` POST of `tools/list` to `server.Url` returns 200 with a `tools` array. This proves the listener works from .NET 8 without admin rights. Two calls in a row return ports that can both be bound.
- **C2:** the existing studio and IFC tests pass unchanged, including `SummariesAreOneLinePerToolKind`, `AFailedToolCallIsReportedAndSentBack`, `StopsAfterTheTurnLimit`, and the IFC "Stopped after 2 model turns" assertion.
- **C3:**
  - A second `SendAsync` on one conversation sends the first exchange back: the request's message roles are system, user, assistant, user.
  - Two conversations from one backend share nothing.
  - `setup.Hidden` tools are not offered.
  - `setup.MaxTurns` stops the loop with `TurnLimitMessage`.
- **C4:**
  - `ASK_CLAUDE_CLI` wins over `PATH`, and a missing `ASK_CLAUDE_CLI` file throws `FileNotFoundException` naming the variable.
  - A `PATH` directory with `claude.cmd` is found, and `claude.exe` beats `claude.cmd` in the same directory.
  - The earlier `PATH` directory wins.
  - The AppData fallback picks 2.1.281 over 2.1.280 and 2.10.0 over 2.9.9.
  - With nothing found, the result is null.
- **C5:**
  - `Build` matches the worked example exactly, with and without `--resume`.
  - An empty `Hidden` set leaves out `--disallowedTools`.
  - `McpConfig` matches the example.
  - `PrepareEnvironment` removes `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `CLAUDECODE`, `CLAUDE_EFFORT`, and `CLAUDE_CODE_ENTRYPOINT`, and keeps `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_GIT_BASH_PATH`, `PATH`, and `APPDATA`.
- **C6:**
  - The six-line example gives exactly the stated events and `Result`.
  - Tool-result content as a plain string works.
  - `is_error: true` gives `ok: false` with the error text as the summary.
  - A tool without our prefix keeps its name.
  - A line that is not JSON, and a `stream_event` line, are ignored.
  - `error_max_turns` gives `IsError` true.
  - `Servers` reports `failed`.
- **C7:** real flow tool server on a free port, the fake `claude.cmd`, and a temp work folder.
  - A script of `addNode`, then `evaluate`, then `result` yields two `tool` events with `ok` true, and the analysis exists in the store.
  - The second `SendAsync` on the conversation passes `--resume fake-session-0`.
  - The call log shows the user text on stdin, the system prompt file holds the system text, and no `ANTHROPIC_*` or `CLAUDECODE` name appears in the child's environment.
  - Each failure throws `ClaudeCliException` with its sentence: `{"error":"Not logged in · Please run /login"}` gives "Claude Code: Not logged in · Please run /login"; `{"exit":3,"stderr":"boom"}` gives a message containing "code 3" and "boom"; `maxTurns` gives `TurnLimitMessage`; a stopped tool server gives "could not connect".
  - A `sleep` step with a cancelled token ends with `OperationCanceledException` and no fake process left running.
  - A missing executable gives "Could not start".
- **C8:**
  - `ASK_PROVIDER=claude-cli` with `ASK_CLAUDE_CLI` set resolves to `claude-cli`, `claude-haiku-4-5-20251001`, `medium`, and that executable, and the environment function is never asked for a name starting `ANTHROPIC_`.
  - `ASK_CLAUDE_MODEL` and `ASK_CLAUDE_EFFORT` override the defaults.
  - With no keys and a `PATH` holding `claude.cmd`, the provider is `claude-cli`. With both keys set and an executable found, it is still `claude-cli` (open question 2). With both keys set and no executable, it is `anthropic` as before.
  - `ASK_PROVIDER=claude-cli` with nothing found gives `ClaudeCliMissing`. With nothing configured at all, the result is `NoProvider`.
  - The unknown-provider message lists `claude-cli`.
  - `Effort` comes from `ANTHROPIC_EFFORT` and `OPENAI_REASONING_EFFORT` for the API providers.
  - `CreateBackend` returns `ClaudeCliBackend` for `claude-cli` and `ChatBackend` otherwise.
  - The existing selection tests still pass, adjusted where they assumed a key-first order. Those that call `Create` keep doing so for the API providers.
  - The README table lists the new files.
- **C9:** the studio builds, and the existing tests pass unchanged. There are no endpoint tests today; C10 adds them.
- **C10:** `AskHandler` with `ClaudeCliBackend`, the fake, and the real flow services.
  - The request "walls please" (id `ask-walls`) emits `start` with `model` and `effort` `medium`, then `tool addNode`, `tool evaluate`, then `check` (the graph has no `answer` node), then `done` with `built: true`, `verified: false`, and `effort`.
  - The fake's second invocation carries `--resume` and `AskPrompts.Check(...)` on stdin.
  - A follow-up with `analysisId: "ask-walls"` resumes the same session.
  - An `{"error": ...}` script emits exactly one `error` payload with the CLI's text.
  - An empty request emits "Type a request first."
  - `/api/ask/model` fields are covered by a small test of the payload builder, or by reading `MapAsk`'s anonymous object through a helper. The builder chooses.
  - The server key is `bimopenflow`, and the hidden tools arrive as `--disallowedTools`.
- **C11:** the existing IFC tests pass with only construction changed: `new IfcAskRunner(new ChatBackend(IfcAskRunner.Setup(_tools, maxTurns), chat), _ifc)`. Every assertion is unchanged.
- **C12:**
  - Over `MiniIfc.Wall`, with the fake and `ClaudeCliBackend(IfcAskRunner.Setup(...))`, an `ifc_open` call gives a `tool` event with `ok` true and a summary containing "IFC4". The answer text is the fake's result.
  - Two questions give two invocations and neither has `--resume`.
  - The `--disallowedTools` value holds the four hidden tools prefixed `mcp__bimopen-ifc__`.
  - "Not logged in" is recorded as "Not answered: Claude Code: Not logged in ..." and the next question still runs.
  - `Markdown` with `Provider "claude-cli"` and `Effort "medium"` prints `- Language model: claude-haiku-4-5-20251001 (claude-cli, effort medium)`. Without a provider, the line is unchanged.
  - The README gives the `claude-cli` setup and the server key.
- **C13:**
  - `ask-bim-flow.mjs` prints `Studio at <url>, model <m> (<provider>, effort <e or default>)`.
  - `docs/START.md` gains an optional step for the Ask box: `npm install -g @anthropic-ai/claude-code`, then `claude` once and `/login`.
  - The setup paragraph of `docs/bim-flow-mcp-demo.md` covers `ASK_PROVIDER=claude-cli`, `ASK_CLAUDE_CLI`, `ASK_CLAUDE_MODEL`, and `ASK_CLAUDE_EFFORT`, and states that the API providers remain.
  - "How it works" names both backends. "Limits" names the loopback MCP listener. "Measuring it" tells TKT-8 and TKT-41 to set `ASK_PROVIDER=claude-cli`.
  - The score table is unchanged: its `Effort` column exists, and the rows come later.

Baseline gates, run 2026-09-27 by the supervisor, Debug:
- `dotnet test tests/studio/BimOpenFlow.Studio.Tests`: 38 passed.
- `dotnet test tests/studio/BimOpenMcp.Ifc.Ask.Tests`: 23 passed.
- `dotnet test tests/BimOpenToolkit.Layering.Tests`: 8 passed.

Final gate after C13: all three commands plus `dotnet build src/studio/BimOpenFlow.Studio && dotnet build src/studio/BimOpenMcp.Ifc.Ask`.

## Build log
| Id | Commit | Result |
|---|---|---|
| C13 | bd0d51d | node --check ok, Layering 8 pass; fence respected (3 files). Score table unchanged. |
| C12 | b5543db | IFC ask 29 pass (6 new); fence respected (7 files). Header line with provider and effort; server on a free port, started only for claude-cli. |
| C10 | d0a1e21 | Studio builds, 90 tests pass (8 new AskHandlerTests over the fake claude and a real store); fence respected (3 files). Tool server now on LoopbackPorts.Free(); ModelInfoPayload helper. |
| C8 | 1a0c8f4 | Studio 82 pass (7 new); fence respected (3 files). Order: ASK_PROVIDER, then claude-cli when found, then a key, else NoProvider. Builder lesson: amend in a shared checkout only with --amend --only -- <paths>. |
| C7 | f102895 | Studio 75 pass (9 new); fence respected (10 files). A .cmd executable must go through cmd.exe /c (CreateProcess cannot start a .cmd); the empty --tools argument survives the hop. The conversation parses the init line's tools array itself because ClaudeStream does not expose it (debt: add Tools to ClaudeStream). |
| C9 | 82e5f34 | Studio builds, 66 tests pass; fence respected (2 files). A failed selection becomes a FailedBackend whose Start rethrows, so the error still arrives per request. |
| C11 | 9591869 | IFC ask 23 pass; fence respected (4 files). Only construction changed. |
| C6 | 7d9b402 | Studio 66 pass (7 new); fence respected (2 files). Pending tool_use calls keyed by id, joined with their tool_result into one event. |
| C5 | 8c629ab | Studio 66 pass; fence respected (2 files). McpConfig uses concatenation, not a raw string (CS9007). |
| C3 | 4a23121 | Studio 66 pass; fence respected (4 files). ScriptedModel moved to ScriptedChat.cs under its old name. |
| C4 | b65a0c5 | Studio 49 pass (9 new); fence respected (2 files). Never asks the environment for an ANTHROPIC_ name. |
| C1 | 14fa3ba | Studio 49 pass (3 new); fence respected (4 files). ClaudeCli files use namespace BimOpenFlow.Ask; the HTTP tools/list test uses an empty server. |
| C2 | 91e7691 | Studio 38 pass, IFC ask 23 pass; fence respected (1 file). ReadResult and TurnLimitMessage match the plan's example. |

## Integration gate

Run 2026-09-27 after C13 (bd0d51d): Studio tests 90 pass, IFC ask tests 29 pass, Layering 8 pass, `dotnet build src/studio/BimOpenFlow.Studio` and `dotnet build src/studio/BimOpenMcp.Ifc.Ask` succeed. One run of the IFC ask tests failed to compile on another session's untracked `src/mcp/BimOpenMcp.Ifc/IfcMetricCatalog.cs`; the rerun passed.

## Spike S1 findings

Run 2026-09-27 against Claude Code 2.1.281 (the desktop app's copy, not logged in) and `bimopenmcp-flow.exe --http` over a temp store.

- Every pinned flag is accepted; no usage error. `--system-prompt-file` and `--max-turns` are absent from `--help` but work.
- With the plan's mcp-config the `init` line reports `mcp_servers: [{"name":"bimopenflow","status":"connected","source":"dynamic"}]` and lists the server's 16 tools minus the 2 disallowed ones, with no built-in tools and `slash_commands: []`. HTTP stays; no stdio fallback.
- With the server stopped, `init` reports `status: "failed"` and `tools: []`. C7 treats an empty `tools` list as a failure too.
- Not logged in: `init`, then a synthetic `assistant` line carrying `"error":"authentication_failed"`, then `{"type":"result","subtype":"success","is_error":true,"result":"Not logged in · Please run /login","terminal_reason":"api_error",...}`, exit 1. So `subtype` is `success` on that path: the error mapping keys on `is_error` (and `terminal_reason`), never on `subtype`. The middle dot is UTF-8, so C7 reads stdout as UTF-8.
- `CLAUDECODE=1` in the environment did not stop `-p` from starting in 2.1.281; dropping it stays as a precaution.
- `--permission-prompts none` exists (anything that would prompt is denied) and can join the argument list if a prompt ever appears.
- Not checked: `--max-turns` and `--disallowedTools` at run time, `--resume` with a real session, the success-path `result` shape, whether Ara3D.MCP receives `initialize` before `tools/list` (it logs nothing), and `--tools ""` passed through ProcessStartInfo.ArgumentList rather than cmd.exe.

## Review findings

## Debt and extension points

## Report
