---
id: TKT-53
title: Enrichment as a Run that leaves evidence: document reference, zones, Parquet, IDS verdicts, evidence package
status: open
depends_on: [TKT-48, TKT-49, TKT-50, TKT-12]
owner:
fence: []
workflow: [kept]
---

## Acceptance criteria

- [ ] sink.writePsets gains optional documents and zones inputs, so one writer produces one file and one entity diff
- [ ] One Run from the editor over nrc-enrich-run writes the enriched IFC, the Parquet long table named by an IfcDocumentReference with its SHA-256, and the evidence zip; the diff equals the additions, removal restores the source, a second Run is byte-identical

P6 of Proposal: docs/proposals/nrc-deliverables.md.
