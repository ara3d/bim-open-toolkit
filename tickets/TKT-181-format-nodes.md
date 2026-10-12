---
id: TKT-181
title: Writer nodes for GLB, USD and BCF that wait for Run, and a reader node for .frag
status: open
depends_on: [TKT-12]
owner:
fence: [src/flow/BimOpenFlow.Nodes.*/**, tests/**, docs/nodes.md, docs/nodes.catalog.json, src/studio/BimOpenFlow.Studio/StudioComposition.cs, src/studio/BimOpenFlow.Studio/BimNodeNotes.cs, src/studio/BimOpenFlow.Studio/BimOpenFlow.Studio.csproj, src/studio/BimOpenFlow.Studio/BimSampleSeeding.cs, samples/checking-analyses/**, samples/nrc/bcf/**, samples/nrc/ids/**]
workflow: [W3]
related: [TKT-170, TKT-171, TKT-172, TKT-173]
created: 2026-10-10
---

## Acceptance criteria

- [ ] Each writer is pending until Run (principle 2), then writes the file and names it in the run record with its content hash (principle 4)
- [ ] A sample graph ends in a .glb, a .usda and a .bcf from the Duplex; the catalog and docs/nodes.md are regenerated

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). The formats are library calls and MCP tools but not nodes. The libraries take IBimData, IDataTable, Stream or TextWriter and return summaries; add a shared export result (path, bytes, hash) so the MCP tools and the nodes do not each copy the read-BOS and output-folder steps.

## Notes

- 2026-10-11: the BCF third is done (session bcfc489d): `src/flow/BimOpenFlow.Nodes.Bcf` holds `bcf.write` (Effect, pending until Run; summary row with path, topics, viewpoints, elements, bytes, sha256), `bcf.topics` (the preview), and `bcf.read` over bim-open-data's new `BcfReader` (`b6899a7`). Sample graphs `bcf-from-ids-failures`, `bcf-from-sql`, `bcf-read-colour` in `samples/checking-analyses`; `CheckingGraphTests` runs the writers through the engine Run. The run record does not yet name the file by hash: the summary row carries the sha256, and tying it into the run record waits on TKT-12. Left: GLB and USD writer nodes, the `.frag` reader node, and the shared export result.
- 2026-10-11, second wave: bcf.read (toolkit `78667eb8`, bim-open-data `061d498`, `d0f39e3`) keeps AuthoringToolId in its own column, skips a malformed or missing viewpoint with a warning instead of failing, and BcfReader returns BcfContents (topics plus warnings). GLB, USD and .frag nodes still wait on TKT-12.
