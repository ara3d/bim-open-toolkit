---
id: TKT-6
title: Does the Ask box default to Claude, and which request set measures it?
status: open
depends_on: []
owner:
fence: []
kind: question
---

The Ask box and every published measurement used OpenAI (gpt-5: 8 correct graphs, 2 honest answers, 0 wrong of 10, docs/bim-flow-mcp-demo.md); the Claude backend landed 2026-09-18 (commit d0aa10c) and 'has not been measured on the same request set yet'. The owner's aim is Claude integration, so PROJECT.md workflow 2 and its success line assume Claude as default with the same ten-question set as the yardstick.

Default: Claude default, the ten questions in docs/bim-flow-mcp-demo.md as the set, the transcript committed under artifacts or samples per release. Decides the first chunk of the Ask box work: measure before changing anything.
