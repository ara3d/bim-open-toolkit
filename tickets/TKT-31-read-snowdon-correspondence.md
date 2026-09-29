---
id: TKT-31
title: The BuildingModel reads the Snowdon correspondence table into ObjectCorrespondence, BimObject status, and space-in-room links
status: open
depends_on: [TKT-30]
owner:
fence: [src/**/BuildingModel*/**]
---

## Acceptance criteria

- [ ] The mapper separates Rooms, Areas, and MEP Spaces by Other.Category (Areas map to Zone, never counted as rooms) and stops reading Room Number as the space's own number
- [ ] For each confirmed storey cluster one BimObject exists (Reconciled when every member is Confirmed, Disputed while a conflict remains), with a SourceObject per source storey, an ObjectCorrespondence per table row, and Evidence holding the method and values
- [ ] An MEP space with a confirmed room claim carries a SpatialContext link to the room with its evidence and keeps its own BimObject
- [ ] A test over the merged Snowdon BOS asserts the counts the correspondence table holds

Step 5 of docs/proposals/snowdon-federation.md. The records already exist in IdentityAndEvidence.cs; nothing fills them, and CoreMapping.cs conflates the three IfcSpace kinds. Serves W4 and the compliance and research users; waits on TKT-30.
