---
id: TKT-18
title: Fix the double count in the IFC ask: Q8 reported twice the expected carbon
status: open
depends_on: []
owner:
fence: [src/mcp/BimOpenMcp.Ifc/**, .claude/skills/ifc-ask/**, samples/nrc/**]
---

Serves W6 and principle 4 (a reported number comes from a tool result and is right). artifacts/nrc-walkthrough/duplex/transcript-unattended.md: Q8 answered 98902.4 against the expected 49451.2 on 2026-09-18; docs/plans/nrc-handoff/track-e.md finding 1 names StoreyOfEntity joins as the cause.
