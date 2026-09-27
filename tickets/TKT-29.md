---
id: TKT-29
title: One Claude conversation about the open graph, in the studio and from Claude Code
status: open
depends_on: [TKT-17, TKT-25, TKT-26]
owner:
fence: [bimopenflow/web/packages/app/**, src/**/Host/**, src/mcp/BimOpenMcp.Flow/**, docs/DEMOS.md]
---

## Acceptance criteria

- [ ] The Ask box becomes a conversation panel beside the canvas: it persists across graph switches, shows each tool call the agent made as a step, and keeps the transcript per analysis
- [ ] A turn started in the studio can be continued from Claude Code over MCP with the same analysis and the same history, and the other way round
- [ ] The agent's edits arrive as TKT-17 specifies, and the panel links each step to the node it touched
- [ ] docs/DEMOS.md gains a capture of one conversation that builds, charts, and colours a Snowdon result

Owner's finding of 2026-09-26: this needs a better and tighter integration with Claude overall. The measured pieces are TKT-8 (Claude on the request set), TKT-25 (a panel that holds still), TKT-26 (the agent knows the open graph), and TKT-17 (edits arrive reviewable); this ticket is the surface that joins them. Serves W2 and principle 7.
