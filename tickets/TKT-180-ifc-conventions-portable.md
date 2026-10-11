---
id: TKT-180
title: A portable IFC conventions project shared by the IFC and Fragments readers
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Bos/**, deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Fragments/**]
workflow: [W1]
related: [TKT-172]
created: 2026-10-10
closed: 2026-10-11
kind: idea
---

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). HiddenIfcNames, the relation-name mapping and the Ifc: parameter prefix live in Ara3D.Ifc.Bos, which is net8.0-windows with native web-ifc, so the portable Fragments reader cannot reference them and marks nothing hidden. A small net8.0 project would serve both.

Done 2026-10-11 (bim-open-data): `36e483b` (Ara3D.Ifc.Conventions), `205bdd6` (IfcNames.NameOf, the one naming rule for both readers and GetEntityLabel).
