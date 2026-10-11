---
id: TKT-193
title: The Revit exporter makes up GlobalIds (category.Id, "{UniqueId}${index}") that BosScene, BCF and GLB now treat as real
status: open
depends_on: []
owner:
fence: [plugins/**]
workflow: [W2]
related: [TKT-175]
created: 2026-10-10
kind: defect
---

## Acceptance criteria

- [ ] Entities whose source has no GlobalId-like identity are written with an absent GlobalId (null, stored as -1), and an id the exporter derives is stored as a parameter that says how it was made

From the BOS middle-layer wave review (docs/plans/bos-middle-layer.md, Review findings), 2026-10-10. PROJECT.md principle 3: a fabricated identity is merged or matched as if real. Units and groups written as "" by BosDocumentBuilder (lines ~466, 473) are part of the same change.
