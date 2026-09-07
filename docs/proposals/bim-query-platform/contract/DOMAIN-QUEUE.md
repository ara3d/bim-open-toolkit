# Domain model review queue

Generated from the candidate CSV and review policy. Edit those inputs, then run `python build_domain_backlog.py`.

45 proposals across 12 domains: 23 high, 20 medium, 2 low incremental-value hypotheses.

Value concerns additions to the current contract, not the importance of a profession. Scope cost and evidence remain separate. No usage-frequency study or source-feasibility validation is claimed.

## Bounded active design wave

| Proposal | Form / approach | Value / cost | Evidence | Decision to work through | Why now |
|---|---|---|---|---|---|
| Space | record / proposed_new | high / medium | workflow_scenario | Can we give a room-based work list when some spaces are only scheduled, their enclosure is unknown, and services or finishes have no resolved room? | Provides a recognizable shared context for architectural schedules, finishes, services and handover without classes for each room use. |
| Service penetration | record / proposed_new | high / medium | brainstorm | Can the contractor identify which service penetrations need approval or firestop evidence before closing a wall, without inferring ratings or approvals from object names? | Adds a cross-trade coordination case beyond familiar component schedules: a host opening, several passing services and independent approval/firestop evidence. Doors already have a bounded audit projection to refine later. |
| Structural member | record / proposed_new | high / medium | brainstorm | Can a fabricator group members by section and material and use measured lengths without substituting bounding-box dimensions or counting analytical duplicates? | Adds structural trade requirements early and tests where beams, columns and braces can share stable fields without importing an analytical structural hierarchy. |
| Finish surface | record / extend | medium / medium | workflow_scenario | Can painters, flooring and ceiling trades share a finish-face model that preserves partitions, unknown areas and unassigned spaces without counting the host twice? | A worked shared-wall example already exposes the correct measurement grain. Start from finish_schedule and test whether it can serve the domain directly before creating another record. |
| Sanitary fixture | record / proposed_new | high / medium | brainstorm | Can a plumber produce a per-space fixture and connection schedule without treating missing waste/supply ports as absent services or mixing water-use bases? | Tests a useful practical family containing toilets and basins, with real connection and water-use differences, instead of one class for every fixture label. |
| Duct segment | record / proposed_new | high / medium | brainstorm | Can a mechanical trade query duct size, construction, lining and airflow separately from geometry and distinguish an unobserved connection from a disconnected route? | Tests a concrete mechanical model and prevents shared routing geometry from turning into a universal pipe/duct/tray record. Compare with the pipe candidate before approving the shared facet. |
| Electrical distribution panel | record / proposed_new | high / medium | brainstorm | Can an electrician inspect panel and circuit assignments while unknown phases, capacity and upstream connections remain explicit? | Electrical schedules need distinct supply and circuit concepts that the generic component model cannot make discoverable. This deliberately tests a discipline beyond architectural takeoff. |
| Installation or delivery observation | record / proposed_new | high / medium | brainstorm | Can a project manager reconcile specified items with partial deliveries and repeated observations without treating a modeled object as proof of installation? | Adds delivery and field-audit needs to the first wave. It tests the distinction between what a model specifies and what independent evidence says was delivered or installed. |

Design-now means define and challenge a small semantic slice. It does not approve implementation or source availability.

## All proposals by domain

### Identity and source history

A real/logical thing is distinct from the source rows and representations describing it.

| Proposal | Form | Value | Evidence | Next action | User question |
|---|---|---|---|---|---|
| Source revision changes | view | medium | brainstorm | validate_next | Which scope changed between issued models? |

### Project and place

Recognizable locations; overlapping zones and multi-storey objects remain possible.

| Proposal | Form | Value | Evidence | Next action | User question |
|---|---|---|---|---|---|
| Space | record | high | workflow_scenario | design_now | Which spaces exist and what activities and services belong to them? |
| Storey | record | high | brainstorm | validate_next | What belongs to this building level and what does its elevation mean? |
| Functional zone membership | facet | medium | brainstorm | validate_next | Which spaces form this department or service zone? |

### Coordinates and representations

Position/orientation, parent frames, 2D/3D shape and selectable detail.

| Proposal | Form | Value | Evidence | Next action | User question |
|---|---|---|---|---|---|
| Service access envelope | facet | medium | brainstorm | validate_next | Can someone operate or remove this component in the required direction? |
| Spatial conflict candidates | capability | high | brainstorm | validate_next | Which objects might intersect this work area or clearance? |

### Building fabric

Common components with useful typed fields and spatial/contextual links.

| Proposal | Form | Value | Evidence | Next action | User question |
|---|---|---|---|---|---|
| Door | record | medium | workflow_scenario | extend_existing | Does this door configuration meet the intended opening function? |
| Window | record | high | brainstorm | validate_next | Which glazed openings share size and performance requirements? |
| Stair | record | medium | brainstorm | validate_next | Which levels does this stair connect and what route dimensions are known? |
| Wall | record | high | workflow_scenario | validate_next | Which walls separate this area and what construction is intended? |
| Floor construction | record | high | brainstorm | validate_next | Which floor construction and finishes are in scope? |
| Roof | record | medium | workflow_scenario | extend_existing | How much roof surface needs each assembly and what remains unknown? |
| Service penetration | record | high | brainstorm | design_now | Which openings need approval and a compatible firestop detail? |

### Structure and civil

Structural and site objects; linear and surface features as well as solids.

| Proposal | Form | Value | Evidence | Next action | User question |
|---|---|---|---|---|---|
| Structural member | record | high | brainstorm | design_now | Which members share section and material and measurable lengths? |
| Reinforcement fabrication takeoff | view | medium | brainstorm | validate_next | Which bar shapes and counts are ready for fabrication by pour? |
| Foundation | record | medium | brainstorm | validate_next | Which foundations need concrete and excavation scope at what elevation? |
| Earthwork zone | record | medium | brainstorm | validate_next | Where do existing and proposed ground imply cut or fill? |

### Interiors and landscape

Surfaces and assemblies that trades measure and specify.

| Proposal | Form | Value | Evidence | Next action | User question |
|---|---|---|---|---|---|
| Finish surface | record | medium | workflow_scenario | design_now | Which face needs which finish and how much net area? |
| Ceiling | record | high | brainstorm | validate_next | Which ceiling construction and elevation applies and where is access required? |
| Room fitout schedule | view | medium | brainstorm | reuse_existing | What finishes fixtures and equipment are specified per room and what is missing? |
| Planting area | record | medium | brainstorm | validate_next | Which areas need which planting and soil preparation quantities? |
| Landscape asset | record | medium | brainstorm | validate_next | Which individual trees or furnishings need installation or care records? |

### Systems and equipment

Connectivity, membership, flow/medium and service relationships are distinct.

| Proposal | Form | Value | Evidence | Next action | User question |
|---|---|---|---|---|---|
| Equipment and plant overview | view | medium | workflow_scenario | reuse_existing | Which plant items exist by system and what handover or connection data is missing? |
| Air terminal | record | high | brainstorm | validate_next | Which terminal serves each space at what design airflow? |
| Sanitary fixture | record | high | brainstorm | design_now | Which fixtures are specified per space and what connections are required? |
| Drain inlet | record | high | brainstorm | validate_next | Which areas discharge through each drain and what outlet data is known? |
| Fire-protection terminal | record | medium | brainstorm | validate_next | Which heads or service outlets belong to each protection system and lack inspection data? |
| Service route geometry and endpoints | facet | high | workflow_scenario | validate_next | Where does this service segment run and which endpoints have supported links? |
| Valve | record | high | brainstorm | validate_next | Which valve controls this branch and can staff identify and reach it? |
| Duct segment | record | high | brainstorm | design_now | Which duct sizes constructions and design airflows are assigned to each HVAC route? |
| Pipe segment | record | high | brainstorm | validate_next | Which pipe sizes materials and service requirements apply to each run? |
| Electrical distribution panel | record | high | brainstorm | design_now | Which panel supplies each circuit and what capacity and access information is known? |
| Lighting fixture | record | high | brainstorm | validate_next | Which luminaires belong to each room and circuit and serve emergency lighting? |
| Service support assembly | record | medium | brainstorm | validate_next | Which supports carry routes and need attachment approval? |

### Materials and measurement

Material contributions and quantities with explicit basis and provenance.

| Proposal | Form | Value | Evidence | Next action | User question |
|---|---|---|---|---|---|
| Construction assembly specification | record | high | workflow_scenario | validate_next | Which layers and specifications define this construction and what remains unspecified? |
| Selected quantity takeoff | view | medium | workflow_scenario | reuse_existing | What quantity can I sum and which items remain unmeasured? |

### Commercial and delivery

A work item can concern multiple objects and may have no independent geometry.

| Proposal | Form | Value | Evidence | Next action | User question |
|---|---|---|---|---|---|
| Trade work package | record | medium | workflow_scenario | extend_existing | Which objects and activities are in this package and what prevents release? |
| Procurement requirement | view | high | brainstorm | validate_next | Which specified items must be ordered and what prevents ordering? |
| Installation or delivery observation | record | high | brainstorm | design_now | What was delivered or installed against requirements and what supports that observation? |

### Operations and performance

Stable assets plus links to operational records and scenario results.

| Proposal | Form | Value | Evidence | Next action | User question |
|---|---|---|---|---|---|
| Asset service requirements | facet | high | workflow_scenario | validate_next | What documentation access and service obligations belong to this item? |
| Maintenance planning view | view | medium | brainstorm | validate_next | Which services are due and what access or shutdown constraints apply? |

### Environment and assessment

Versioned factors/rules and explainable results with incomplete/unknown outcomes.

| Proposal | Form | Value | Evidence | Next action | User question |
|---|---|---|---|---|---|
| Material impact breakdown | view | medium | workflow_scenario | reuse_existing | What contributes to carbon results and how much scope lacks factors? |
| Requirement assessment results | view | low | workflow_scenario | reuse_existing | Which requirements passed failed or could not be assessed and why? |
| Detailed acoustic response | capability | low | brainstorm | park | How might finishes and transmission paths affect room acoustics across frequency bands? |

### Flexible evidence

Preserve source detail and explain how curated values were chosen.

| Proposal | Form | Value | Evidence | Next action | User question |
|---|---|---|---|---|---|
| Model evidence issues | view | high | workflow_scenario | validate_next | Which missing or conflicting fields block this workflow? |

## How to challenge the queue

Review the question and decision first. Challenge the impact/repetition assumption, the minimum field set, and whether this needs a record, facet, view or query capability. An infrequent high-consequence case deserves explicit discussion even when the default band is medium.

The full hierarchical JSON includes role/workflow links, tags, grain, proposed fields, relationships, rationale and merge/defer alternatives. See [domain-models.json](domain-models.json) and [DOMAIN-DESIGN.md](DOMAIN-DESIGN.md).
