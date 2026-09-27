---
id: TKT-18
title: Fix the double count in the IFC ask: Q8 reported twice the expected carbon
status: claimed
depends_on: []
owner: small-job-builder
fence: [src/mcp/BimOpenMcp.Ifc/**, .claude/skills/ifc-ask/**, samples/nrc/**]
---

## Acceptance criteria

- [ ] The unattended bimopenmcp-ifc-ask transcript for samples/nrc/questions.txt matches expected_answers.json on all eight questions
- [ ] A test reproduces the double count and fails before the fix

Serves W6 and principle 4 (a reported number comes from a tool result and is right). artifacts/nrc-walkthrough/duplex/transcript-unattended.md line 454: Q8 answered 98902.4 on 2026-09-18 through a ParameterText-to-StoreyOfEntity join on EntityIndex, against the expected 49451.2 recorded in docs/plans/nrc-handoff-wave.md line 169. The cause is undiagnosed. docs/plans/nrc-handoff/track-e.md finding 2 describes the StoreyOfEntity walk joined through GlobalId that counts no element twice, which is the join the agent should be steered to.
