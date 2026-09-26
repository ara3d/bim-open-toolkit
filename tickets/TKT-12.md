---
id: TKT-12
title: Run from the editor: a Run button, the run record, and sinks that execute
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/**, bimopenflow/web/packages/state/**, bimopenflow/web/packages/api-client/**, src/flow/BimOpenFlow.Host.Api/**, src/flow/BimOpenFlow.Nodes.Effects/**, docs/DEMOS.md]
---

Serves W3 and W5 (and the enrichment write-back, which is the same mechanism). Effects stay EffectPending forever in the editor because the Run exists only through the HTTP API (docs/plans/nrc-handoff/track-e.md E2 and findings 8 to 10); charts export, reports, evidence packages, and property-set write-back all wait on this one piece.
