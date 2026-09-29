---
id: TKT-127
title: Let the studio Ask agent answer questions about the toolkit, the repository, and its capabilities
status: open
depends_on: []
owner:
fence: [.claude/skills/bim-flow/working-rules.md, src/mcp/BimOpenMcp.Flow/**, src/studio/BimOpenFlow.Studio/**, tests/mcp/**, tests/studio/**, bimopenflow/web/packages/bim-open-notebook/**, bimopenflow/web/packages/app/src/ask*, bimopenflow/web/packages/app/test/ask*, samples/ask/**]
---

## Acceptance criteria

- [ ] A test over the flow MCP server shows searchDocs and readDoc return text from README.md, PROJECT.md, docs/**, samples/*/README.md and tickets/, and refuse any other path (data/, src/, a path with '..', an absolute path)
- [ ] working-rules.md has a rule: a request about the toolkit rather than the model is answered in text, citing the files read, with no graph built
- [ ] AskPrompts.System includes a primer of at most 2 KB on what the toolkit is, its surfaces, and that the docs tools exist
- [ ] A text-only answer creates no empty analysis, and both the Notebook and the studio graph editor show it as a reply (tests in bim-open-notebook and app)
- [ ] samples/ask/requests.txt (or its committed successor) holds 3-5 toolkit questions with expected answers, and a Claude CLI run with Haiku at medium effort answers them; the transcript is committed

Both the Notebook (bim-open-notebook/src/ask/events.ts) and the graph editor (app/src/askClient.ts) post to /api/ask (src/studio/BimOpenFlow.Studio/AskEndpoint.cs). Today the agent knows only the databases, the node catalog, and the three bim-flow guides; ClaudeCliArguments passes --tools "" and --setting-sources "", so it cannot read the repository, and the working rules only describe building a graph. Questions such as 'what is BOS', 'how do I run the NRC walkthrough', or 'which demos are supported' get a guess or a graph.

Decided in chat 2026-09-29: add read-only docs tools to the flow MCP server rather than enabling Claude Code's built-in Read/Grep, because they work under every backend (claude-cli, anthropic, openai), keep exploration unable to write, keep the agent out of data/ and the private Snowdon files, and are testable headless. docs/nodes.md is 96 KB, too large to inline, so the primer points at the tools. working-rules.md is also the bim-flow Claude Code skill (AGENTS.md), so an edit changes both.

Overlap: TKT-45 (claimed, Claude CLI backend), TKT-26 (claimed, open-graph default), and TKT-84/TKT-100 touch the same Ask files; coordinate or keep edits small. Unverified: whether AskHandler creates an analysis per request before the model answers.
