---
id: TKT-45
title: The Ask box and the IFC ask call Claude through the Claude Code command line, Haiku at medium effort, not the Anthropic API
status: open
depends_on: []
owner:
fence: [src/studio/BimOpenFlow.Ask/**, src/studio/BimOpenFlow.Studio/**, src/studio/BimOpenMcp.Ifc.Ask/**, tests/studio/**, docs/bim-flow-mcp-demo.md, docs/START.md, scripts/ask-bim-flow.mjs]
---

## Acceptance criteria

- [ ] ASK_PROVIDER=claude-cli (the default when no API key is set) makes POST /api/ask answer through the Claude Code command line (claude -p or the Agent SDK), with the bimopenflow MCP server as its tools, model claude-haiku-4-5-20251001, effort medium; the transcript strip still streams tool calls and the finished graph still opens
- [ ] bimopenmcp-ifc-ask answers samples/nrc/questions.txt through the same command-line path with the bimopen-ifc server; no ANTHROPIC_API_KEY is read or needed
- [ ] The model and effort are recorded in the transcript header and the score table in docs/bim-flow-mcp-demo.md; ANTHROPIC_MODEL / ANTHROPIC_EFFORT keep working for the API provider
- [ ] tests/studio run the loop against a fake claude executable on PATH, so CI needs no account

Serves W2. Owner's decision, 2026-09-27: the Anthropic API account is not to be used; Claude is called from the command line (the Claude Code CLI already signed in on the owner's machine), and that work uses Haiku models at medium effort. Replaces the funded-account rerun that TKT-41 asked for. Design is the builder's: either a ClaudeCliChat that implements IChatModel by driving 'claude -p --output-format stream-json' one turn at a time, or handing the whole tool loop to the CLI with --mcp-config pointing at the built bimopenmcp-flow.dll and --allowedTools for its tools. The second is less code and matches how Claude Code already uses the server from .mcp.json; the first keeps AskAgent's transcript shape. The 'claude' executable is not on PATH in a fresh shell on this machine (2026-09-27); the ticket includes finding it (the desktop app bundles one) or documenting the install step in docs/START.md.

## Notes

- 2026-10-03: claim released; the session that held it (assembly-line-supervisor) had stopped. Checked against the code that day. Done: all 13 chunks of `docs/plans/claude-cli-backend.md`, the fake-`claude` tests in `tests/studio`, and ff6bbbb (finding the desktop app's CLI). One live Haiku run answered five toolkit questions (7c86c52). Left: one live run that builds a graph through the Ask box with `ASK_PROVIDER=claude-cli`; close the ticket after it. The eight IFC questions through the CLI are TKT-41's run.
