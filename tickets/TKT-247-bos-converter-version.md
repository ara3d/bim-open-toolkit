---
id: TKT-247
title: Regenerate the public .bos samples and record the converter version in the manifest
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Bos/**, deps/bim-open-data/samples/public/**, deps/bim-open-data/src/data/Ara3D.Ids/**]
workflow: [kept]
related: [TKT-237]
created: 2026-10-11
---

## Acceptance criteria

- [ ] samples/public/*.bos are regenerated with the converter at or after f103af0 (type-object property sets), with the counts their READMEs quote re-checked
- [ ] A .bos records the converter version in its manifest, and Ara3D.Ids warns when a file predates type-object property sets

From the review of the second IDS wave. 5a23e83 removed the warning that type-object property sets are not seen, but every committed .bos predates f103af0, so an IDS check over an old file misses inherited values silently.
