---
id: TKT-56
title: NRC graphs work over any BOS model: Snowdon and the four bim-open-schema examples, not only the Duplex
status: open
depends_on: [TKT-48, TKT-52]
owner:
fence: []
workflow: [kept]
---

## Acceptance criteria

- [ ] The NRC read-side graphs (nrc-element-psets, nrc-rollup, nrc-join-analytics, the colourings, per-storey totals) take the model as a parameter and open green over each of C:/Users/cdigg/git/bim-open-schema/examples/*.bos (Golden Nugget, Snowdon Towers Sample Architectural, Technicalschoolcurrentm, rac_basic_sample_project-2025) and over the private Snowdon model at the location BIMOPENFLOW.md names; no graph hard-codes duplex-base
- [ ] A deterministic synthetic analytics generator (a graph or a script in this repository, seeded by GlobalId like nrc-ifc-llm's generator) produces the element CSV for any BOS model, labelled synthetic, so every model has data to join
- [ ] Storey resolution is checked per model: where StoreyOfElement places no element (for example a Revit export whose storey is a Level parameter, not a containment relation), the graph reports the unplaced count as InfoNotAvailable instead of dropping rows, and the fallback is documented
- [ ] Write-back is claimed only where an IFC exists: over a BOS-only model the enrichment graph says it cannot write and why, and the evidence or export path (Parquet, xlsx) still works
- [ ] A test per example model asserts element count, matched count, and per-storey totals; the private Snowdon case is skipped with a named reason when the file is absent, never reported as passing

Owner's request, 2026-09-27: the graphs must ultimately work with Snowdon and other BOS data, not only the Duplex. Later ticket, after TKT-48 and TKT-52. The examples folder is the bim-open-schema repository (read-only for this toolkit; copy or reference, do not edit). The merged seven-file Snowdon model is TKT-30; this ticket works with the single architectural BOS in the examples folder and with whichever Snowdon model TKT-30 leaves canonical, whichever exists when it starts. Proposal: docs/proposals/nrc-deliverables.md.
