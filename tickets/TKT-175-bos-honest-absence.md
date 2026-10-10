---
id: TKT-175
title: Absent GlobalId, Name and numbers in the BOS core: index -1 means absent, from the specification through the builder and accessors
status: open
depends_on: []
owner:
fence: [deps/bim-open-schema/**, deps/bim-open-data/src/data/Ara3D.BimOpenSchema.ObjectModel/**, deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO/**]
workflow: [W2]
created: 2026-10-10
kind: defect
---

## Acceptance criteria

- [ ] The specification says a StringIndex or NumberIndex of -1 means absent
- [ ] BimDataBuilder can add an entity with no GlobalId or Name, and readers stop writing empty strings for them
- [ ] BimDataExtension.Get returns null for an absent number or string instead of 0 or an exception, with nullable annotations on in IO and ObjectModel

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). 4,376 of the Duplex's 4,721 entities have GlobalId "" because BimDataBuilder always interns a string; Get(NumberIndex) returns 0 when missing. Each new writer worked around this to keep PROJECT.md principle 3 (honest absence).
