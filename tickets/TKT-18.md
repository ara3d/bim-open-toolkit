---
id: TKT-18
title: Fix the double count in the IFC ask: Q8 reported twice the expected carbon
status: open
depends_on: []
owner:
fence: [src/mcp/BimOpenMcp.Ifc/**, .claude/skills/ifc-ask/**, samples/nrc/**]
---

## Acceptance criteria

- [ ] The unattended bimopenmcp-ifc-ask transcript for samples/nrc/questions.txt matches expected_answers.json on all eight questions
- [ ] A test reproduces the double count and fails before the fix

Serves W6 and principle 4 (a reported number comes from a tool result and is right). artifacts/nrc-walkthrough/duplex/transcript-unattended.md line 454: Q8 answered 98902.4 on 2026-09-18 through a ParameterText-to-StoreyOfEntity join on EntityIndex, against the expected 49451.2 recorded in docs/plans/nrc-handoff-wave.md line 169. The cause is undiagnosed. docs/plans/nrc-handoff/track-e.md finding 2 describes the StoreyOfEntity walk joined through GlobalId that counts no element twice, which is the join the agent should be steered to.


## Note, 2026-09-27

The code fix landed (9b6e85a, StoreyOfElement view). End-to-end confirmation by a model waits for TKT-41, which now runs through the Claude Code command line with Haiku (TKT-45), not a funded API account.

## Notes

- 2026-10-03: claim released; the session that held it (small-job-builder) had stopped. Checked against the code that day. Done: the fix (9b6e85a, the StoreyOfElement view; StoreyOfEntity counted a storey's rollup twice), confirmed by the scripted replay in `scripts/demo-ifc-mcp.mjs`. Left: a model-driven run of the eight questions through the Claude CLI (TKT-41), its transcript committed, and confirming a regression test for the double count exists.
- 2026-10-04: IFC-Bench questions 213 and 236 (TKT-145) doubled totals through the same ParameterText-to-StoreyOfElement join, but for a different cause: the DigitalHub models attach two same-named property sets with equal values to each element. Fixed in bim-open-data 26b8691 (each property read once per element); StoreyOfElement was already right. Nothing changes this ticket's open item.
