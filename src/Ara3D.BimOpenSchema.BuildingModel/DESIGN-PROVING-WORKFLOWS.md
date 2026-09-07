# Core BIM workflow evidence

The core model is evaluated through source-backed authoring workflows, not through commercial, operational or compliance conclusions.

| Workflow | Core records | Result boundary |
|---|---|---|
| Room and door schedule | `Storey`, `Space`, `Door`, `ElementInfo` | Shows source-backed values and unresolved fields; it does not certify accessibility or fire compliance. |
| Roof and finish quantity review | `Roof`, `FinishSurface`, `QuantityObservation`, `MaterialUse` | Keeps surface basis and counting scope visible; it does not price or procure material. |
| Revision comparison | `ModelSnapshot`, `SourceRevision`, `BimObject`, `ObjectCorrespondence` | Reports typed changes only where source lineage and identity evidence support comparison. |
| Structural, MEP and electrical schedules | core occurrence records, products, materials and ports | Groups authoring facts without turning a schedule into fabrication, operational or engineering approval. |
| Spatial candidate preparation | `CoordinateFrame`, `Placement`, `GeometryRepresentation` | Provides frames and externally addressed geometry; derived clash, egress and acoustic results remain outside the core. |

The tests exercise field distinctions and joins with synthetic records. The workflow runner maps the first three workflows from prepared BOS input. Coverage reports distinguish known, missing, invalid and conflicting source observations.
