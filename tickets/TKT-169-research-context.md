---
id: TKT-169
title: Research context: the NRC page presents the paper's eight answers, the hashed runs, and the byte-exact write-back as one reproducibility demo
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/nrc-web/**, docs/nrc-walkthrough.md, docs/DEMOS.md, site/**]
workflow: [kept]
created: 2026-10-05
---

## Acceptance criteria

- [ ] /nrc.html opens with one paragraph saying who it is for (a researcher reproducing a published result) and lists the eight questions with the graph, the answer, and the paper's figure for each
- [ ] The page links the run records that pin each graph and input by content hash, and the write-back diff that shows the IFC changed only where the graph wrote
- [ ] Everything on the page comes from the Duplex, which is CC BY 4.0, with the attribution from TKT-144

Serves the kept NRC scope and principle 4 (runs are the evidence). The fifth demo context in docs/proposals/demo-contexts.md; most of its material exists (samples/nrc-analyses, docs/nrc-walkthrough.md, the nrc-web page), so this is a presentation chunk, not new capability. Related: TKT-19, TKT-32.
