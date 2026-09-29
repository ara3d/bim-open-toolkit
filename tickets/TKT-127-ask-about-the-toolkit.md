---
id: TKT-127
title: Let the studio Ask agent answer questions about the toolkit, the repository, and its capabilities
status: done
depends_on: []
owner: ask-toolkit-questions
fence: [.claude/skills/bim-flow/working-rules.md, src/mcp/BimOpenMcp.Flow/**, src/studio/BimOpenFlow.Studio/**, tests/mcp/**, tests/studio/**, bimopenflow/web/packages/bim-open-notebook/**, bimopenflow/web/packages/app/src/ask*, bimopenflow/web/packages/app/test/ask*, samples/ask/**]
---

## Acceptance criteria

- [x] A test over the flow MCP server shows searchDocs and readDoc return text from README.md, PROJECT.md, docs/**, samples/*/README.md and tickets/, and refuse any other path (data/, src/, a path with '..', an absolute path)
- [x] working-rules.md has a rule: a request about the toolkit rather than the model is answered in text, citing the files read, with no graph built
- [x] AskPrompts.System includes a primer of at most 2 KB on what the toolkit is, its surfaces, and that the docs tools exist
- [x] A text-only answer creates no empty analysis, and both the Notebook and the studio graph editor show it as a reply (tests in bim-open-notebook and app)
- [x] samples/ask/requests.txt (or its committed successor) holds 3-5 toolkit questions with expected answers, and a Claude CLI run with Haiku at medium effort answers them; the transcript is committed

Both the Notebook (bim-open-notebook/src/ask/events.ts) and the graph editor (app/src/askClient.ts) post to /api/ask (src/studio/BimOpenFlow.Studio/AskEndpoint.cs). Today the agent knows only the databases, the node catalog, and the three bim-flow guides; ClaudeCliArguments passes --tools "" and --setting-sources "", so it cannot read the repository, and the working rules only describe building a graph. Questions such as 'what is BOS', 'how do I run the NRC walkthrough', or 'which demos are supported' get a guess or a graph.

Decided in chat 2026-09-29: add read-only docs tools to the flow MCP server rather than enabling Claude Code's built-in Read/Grep, because they work under every backend (claude-cli, anthropic, openai), keep exploration unable to write, keep the agent out of data/ and the private Snowdon files, and are testable headless. docs/nodes.md is 96 KB, too large to inline, so the primer points at the tools. working-rules.md is also the bim-flow Claude Code skill (AGENTS.md), so an edit changes both.

Overlap: TKT-45 (claimed, Claude CLI backend), TKT-26 (claimed, open-graph default), and TKT-84/TKT-100 touch the same Ask files; coordinate or keep edits small. Unverified: whether AskHandler creates an analysis per request before the model answers.

## Result

What changed:

- `src/mcp/BimOpenMcp.Flow/RepoDocs.cs` and `FlowRepoDocTools.cs`: two read-only tools on the flow MCP server, `searchDocs(query, under?, take?)` and `readDoc(path, offset?, maxChars?)`. They read README.md, PROJECT.md, docs/**, samples/*/README.md and tickets/** (.md, .txt, .json, never under bin/ or obj/) and refuse any other path, a '.' or '..' segment, a drive or rooted path. The root is `SampleSeeding.FindRepoRoot(AppContext.BaseDirectory)` (the checkout the binary was built from, so a host running from bin/ works), else the working directory's; outside a checkout the tools answer with an error instead of failing to register. Both the studio's Ask agent and Claude Code (bimopenflow-duckdb) get them.
- `.claude/skills/bim-flow/working-rules.md`: a first paragraph says a request about the toolkit is answered in text from searchDocs and readDoc, naming the files read, with no graph built.
- `AskPrompts.Primer` (about 1.5 KB, `PrimerLimit` 2048) in `AskEndpoint.cs`: what BOS, BimOpenFlow and the surfaces are, where the documents are, and that the docs tools exist.
- `AskHandler`: checked the open question first. It never created an analysis before the model answered; an id is only saved when the agent calls an edit tool. The real defect was elsewhere: the editor always sends the open graph's id, so a text-only answer reported `built: true` and ran the host's check rounds on a graph the agent never touched ("fix the graph" turns when it had no 'answer' node). The handler now compares the graph hash before and after the turn; an unchanged graph gets no checks and `built: false`.
- Web: the Notebook and the editor's Ask panel already showed `built: false` as a plain reply; tests now pin it for a toolkit question, and the editor's placeholder mentions the toolkit.
- `samples/ask/toolkit-requests.txt` (five questions, kept apart from requests.txt so PROJECT.md's ten-question Snowdon set stays ten) and `samples/ask/toolkit-transcript-2026-09-29.txt`.

Commits: 644aee4 (docs tools), d665a5b (rule, primer, handler), dc5cc53 (web tests), 7c86c52 (questions and transcript).

Verified:

- `BimOpenMcp.Flow.Tests` 50 of 50, including `RepoDocToolTests` (allowed paths read, 14 refused paths including data/, src/, '..', rooted, UNC and drive paths, paging, search under tickets/).
- `BimOpenFlow.Studio.Tests` 103 of 103, including `AToolkitQuestionAnsweredInTextLeavesNoAnalysisAndRunsNoCheck` (fake claude calls searchDocs and readDoc over the real tool server), `ATextOnlyFollowUpOnAnOpenGraphLeavesItUncheckedAndUnchanged`, `RulesSayAToolkitQuestionIsAnsweredInTextFromTheDocuments`, `ThePrimerFitsItsLimitAndNamesTheDocsTools`.
- vitest: bim-open-notebook `notebookView.test.ts` "shows a text-only answer about the toolkit as a reply with no embeds"; app `askPanel.test.ts` "shows a text-only answer as a reply and does not reload the open flow". Full suites pass; under load from parallel runs a few unrelated jsdom tests time out and pass when rerun alone.
- Live run, Claude Code 2.1.284, claude-haiku-4-5-20251001, effort medium, isolated studio on port 5397: 5 of 5 correct, 0 wrong, no graph built, store empty afterwards; 4 of 5 name the files read.

Left open:

- The DuckDB-nodes answer came from the node catalog already in the prompt, with no docs call and no file named; the rule's "name the files you read" does not cover knowledge from the prompt.
- `.claude/skills/bim-flow/SKILL.md`'s tool table does not list searchDocs and readDoc, and docs/OVERVIEW.md still says "thirteen MCP tools"; both are outside this ticket's fence.
- `scripts/ask-bim-flow.mjs` labels a text answer ANSWERED and a built graph OK, which is right for model questions and backwards for toolkit ones; the transcript is judged by hand.
- searchDocs ranks by distinct words matched, so common words match hundreds of files (247 for "BIM Open Schema BOS"); the agent coped by reading README.md and docs/OVERVIEW.md directly.
