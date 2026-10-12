---
id: TKT-241
title: Do the view3d tables keep their camelCase columns (instanceIndex, minX) or take the registry's PascalCase names?
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-182, TKT-206, TKT-207]
created: 2026-10-11
kind: question
---

The view3d.* nodes emit camelCase columns such as instanceIndex and minX, while the column kind registry (TKT-206, bim-open-data ColumnKinds) and the bim.* packs use PascalCase (EntityIndex, MinX). Declaring their schemas from the registry (declared-schemas wave B, B3) was skipped because the names clash. Options: (1) rename the view3d columns to PascalCase, with the 3D pane and recorded runs read case-insensitively as the verdict rename did (TKT-182); (2) register camelCase kinds for view tables as a separate area; (3) declare view3d schemas with plain columns and no kinds. Recommendation: (1), since TKT-182 already chose PascalCase and the readers now match ignoring case. Decides how the view3d.* nodes get declared schemas.
