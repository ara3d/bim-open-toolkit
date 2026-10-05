---
id: TKT-167
title: Checking context: a model QA page where a graph turns tables into verdicts, a coloured model, and an evidence report over a public building
status: open
depends_on: []
owner:
fence: [samples/checking-analyses/**, bimopenflow/web/packages/studio-web/**, docs/DEMOS.md, site/**]
workflow: [W3]
created: 2026-10-05
---

## Acceptance criteria

- [ ] Three checks over a public building (door leaf width, spaces without a storey, elements missing a required parameter) each run as a graph ending in a verdict table, a 3D colouring by verdict, and a chart, with a test asserting the counts
- [ ] A page or the studio start page groups these as 'Checking', names its audience (a BIM manager auditing a delivered model), and shows the pending report node as the evidence package Run will write
- [ ] Each check's rule is a parameter on a node, not SQL text, so a person can change the threshold on the canvas

Serves W3 and the kept rule-check scope. The third of the five demo contexts in docs/proposals/demo-contexts.md. The Compliance, Evidence, and Reports packs and the nrc-dc-w1-verdicts graph already do this over the Duplex; this ticket generalises it to the public buildings and gives it a front door. The report stays EffectPending until Run exists in the editor (TKT-12); show it pending rather than hide it. Related: TKT-50 (IDS check), TKT-53 (enrichment Run).
