---
id: TKT-6
title: Does the Ask box default to Claude, and which request set measures it?
status: done
depends_on: []
owner:
fence: []
kind: question
---

The Ask box and every published measurement used OpenAI (gpt-5: 8 correct graphs, 2 honest answers, 0 wrong of 10, docs/bim-flow-mcp-demo.md); the Claude backend landed 2026-09-18 (commit d0aa10c) and 'has not been measured on the same request set yet'. The owner's aim is Claude integration, so PROJECT.md workflow 2 and its success line assume Claude as default with the same ten-question set as the yardstick.

Default: Claude default, the ten questions in docs/bim-flow-mcp-demo.md as the set, the transcript committed under artifacts or samples per release. Decides the first chunk of the Ask box work: measure before changing anything.

## Decision (2026-09-26, from the repository)

The default is already Claude: `docs/bim-flow-mcp-demo.md` says the host picks the Anthropic key before the OpenAI key when both are set and defaults to `claude-opus-5`. What is missing is the measurement, which TKT-8 supplies: the ten questions and their expected answers become a committed request file, `scripts/ask-bim-flow.mjs --file` runs it against Claude, and the transcript is committed and rerun before each demo. PROJECT.md workflow 2 and its success line say so.


## Amended, 2026-09-27

Claude stays the default, but through the Claude Code command line with Haiku at medium effort rather than the Anthropic API (owner's decision; TKT-45). The yardstick is unchanged: the ten questions in samples/ask/requests.txt.