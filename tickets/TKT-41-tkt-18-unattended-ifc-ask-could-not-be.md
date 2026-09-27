---
id: TKT-41
title: TKT-18 unattended IFC ask could not be measured (Anthropic credit exhausted)
status: open
depends_on: []
owner:
fence: [artifacts/nrc-walkthrough/duplex/**]
---

## Acceptance criteria

- [ ] Rerun bimopenmcp-ifc-ask over samples/nrc/questions.txt with a funded Anthropic key and confirm all eight answers, especially Q8's per-storey embodied carbon (Level 1 expected 49451.2, not the pre-fix 98902.4 double count), against scripts/demo-ifc-mcp.mjs's expected values.

Measured 2026-09-26 at commit 946748b, after TKT-18's StoreyOfElement fix (9b6e85a) and a rebuild of src/studio/BimOpenMcp.Ifc.Ask. All eight questions returned 'Anthropic 400: Your credit balance is too low' with 0 tool calls each (see artifacts/nrc-walkthrough/duplex/transcript-unattended-2026-09-26.md). This is the same account exhaustion recorded in TKT-36 through TKT-40 for the DuckDB Ask measurement, run earlier in the same session; the account had no credit left by the time this run started. TKT-18's fix itself is not verified end to end by a language model yet — only scripts/demo-ifc-mcp.mjs's scripted replay (no language model) exercises the same StoreyOfElement join.
