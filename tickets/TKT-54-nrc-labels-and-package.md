---
id: TKT-54
title: Scene labels (view3d.label) and the Windows handover bundle for NRC
status: open
depends_on: [TKT-48, TKT-53]
owner:
fence: []
workflow: [kept]
---

## Acceptance criteria

- [ ] view3d.label writes a label column on the instance table and the viewer draws capped screen-space text; a walkthrough figure shows each storey's total over its slab
- [ ] npm run nrc:package builds, from a tagged toolkit commit (nrc-poc-1.0 or later), artifacts/nrc-package/: the host and both MCP servers published self-contained (no .NET SDK or npm needed), the built web page, duplex-base.ifc, the enriched IFC, Parquet, dictionary, IDS, graphs, figures, transcripts, score table, timings, evidence zip, a README for an NRC reviewer, and start.cmd; the zip is attached to a GitHub release on ara3d/bim-open-toolkit for that tag
- [ ] nrc-ifc-llm gains the toolkit as a git submodule at toolkit/, pinned to the same tag (not a subtree: the toolkit's own five submodules would not come with it); its poc/README.md gives the release URL, the bundle's SHA-256, and the rebuild steps (git clone --recursive, then one command); the paper cites the tag
- [ ] A Windows machine with only a browser and no development tools unzips the bundle, runs start.cmd, and sees the enriched Duplex coloured by operational carbon; a fresh recursive clone of nrc-ifc-llm rebuilds the same bundle

P7 of Proposal: docs/proposals/nrc-deliverables.md. Windows only, per the owner.


## Delivery shape, owner's decision 2026-09-27

Source as a pinned submodule, runnable bundle as a release asset. NRC can reach GitHub, so no source zip is needed. The Snowdon half is private and stays out of the bundle; the public large-model numbers come from large_test_model.ifc (TKT-55). The nrc-ifc-llm repository keeps what it owns: the paper, statement of work, options brief, test kit, synthetic-data generator, and recorded results; `poc/EnrichIfc` can be retired once the enrichment graph (TKT-48, TKT-53) produces the same file.
