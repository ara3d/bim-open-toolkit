---
id: TKT-175
title: Absent GlobalId, Name and numbers in the BOS core: index -1 means absent, from the specification through the builder and accessors
status: done
depends_on: []
owner:
fence: [deps/bim-open-schema/**, deps/bim-open-data/src/data/Ara3D.BimOpenSchema.ObjectModel/**, deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO/**]
workflow: [W2]
created: 2026-10-10
closed: 2026-10-11
kind: defect
---

## Acceptance criteria

- [x] The specification says a StringIndex or NumberIndex of -1 means absent
- [x] BimDataBuilder can add an entity with no GlobalId or Name, and readers stop writing empty strings for them
- [x] BimDataExtension.Get returns null for an absent number or string instead of 0 or an exception, with nullable annotations on in IO and ObjectModel

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). 4,376 of the Duplex's 4,721 entities have GlobalId "" because BimDataBuilder always interns a string; Get(NumberIndex) returns 0 when missing. Each new writer worked around this to keep PROJECT.md principle 3 (honest absence).

Done 2026-10-11: bim-open-schema `c4bd3f3`, `c369c32`; bim-open-data `54fa408`, `b6efd51`, `46e987a`, `e28a28b`, `63f8bfc`, `e7dbef1`, `68c471d`, `bc9eb65`, `38dbdd2`, `307840a`, `4f57e83`, `aaebb39`, `9fde349` (samples); bim-open-viewer `16b8a3c`; bim-open-flow `81c058a`; toolkit null-handling commits and `83ee110`. Fresh Duplex: 4,376 GlobalIds and 4,170 names absent, none "" or "#id"; units NULL. Leftovers: TKT-193, TKT-198, TKT-200, TKT-201.
