---
id: TKT-292
title: Licence files for the toolkit and the Duplex sample
status: open
depends_on: []
owner:
fence: [LICENSE, samples/nrc/NOTICE.md]
workflow: [W1]
related: [TKT-144]
confidence: high
created: 2026-10-12
---

## Acceptance criteria

- [ ] The repository root has a LICENSE file (MIT, Ara 3D, matching the README's License section and the deps/ repositories' files)
- [ ] samples/nrc/NOTICE.md credits the Duplex Apartment files as TKT-144 records: BSI (2020) Duplex Apartment Test Files, buildingSMART International, CC BY 4.0, from github.com/buildingsmart-community/Community-Sample-Test-Files, and states which committed files derive from it (duplex-base.ifc byte-identical, duplex-enriched.ifc adds property sets)

TKT-144 settled the terms on 2026-10-03 (Duplex CC BY 4.0 with attribution; Schependomlaan CC BY 4.0, owner confirmed) but samples/nrc still has no NOTICE, and the toolkit root has no LICENSE file although the README has a License section. Raised again 2026-10-12 by the Studio 2.5 colleague.
