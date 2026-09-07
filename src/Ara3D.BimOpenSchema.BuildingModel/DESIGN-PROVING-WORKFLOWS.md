# Proposed workflows for proving the building-model design

Status: proposal, 2026-09-07. These are acceptance experiments, not implemented capabilities or commitments that every required input is available in BOS.

The purpose is to find where the model loses meaning, makes ordinary queries awkward, or cannot retain trustworthy results. Each experiment should take source information through mapping, validation, a useful query and persisted reopening. Merely constructing the records is insufficient.

The broader [workflow catalog](../../docs/proposals/bim-query-platform/WORKFLOWS.md) describes possible uses. This proposal selects ten experiments that put different pressures on the current design. Complete the first three before expanding the domain catalog.

## Common acceptance contract

Every workflow delivers:

- A readable result table with explicit snapshot/scenario selection, units and quantity basis.
- Coverage and exceptions alongside the answer. Counts state their denominator and distinguish unavailable, invalid, conflicting and inapplicable data. A partial answer is allowed; silent exclusion is not.
- A path from each result to its source observations, mapping policy and any external inputs. Derived results retain input references and algorithm/configuration versions.
- An independently checked small fixture with explicit expected rows and totals, plus a representative real-file demonstration. Expected results must not be calculated by the implementation under test.
- A stored dataset that reproduces the answer after reopening, preserving identities, missing reasons, evidence and relationship completeness. Use one initial persistence format.
- Tests showing that invalid inputs produce useful diagnostics and do not silently become valid observations. Compare equivalent query paths if more than one API or SQL surface is exposed.

Use Revit-produced BOS files as the initial source corpus. Use an IFC-produced file as a separate exporter-gap case when available. Supplemental specifications, rates and operational observations remain identified external inputs. Controlled fixtures can establish semantic behavior when source data is absent, but the corresponding real-source mapping remains unproven.

## 1. Building, room and door schedule

**Question:** What rooms and doors exist on each level, and which door specifications need review?

**Inputs:** One architectural BOS delivery; an explicit field mapping; optionally a small, versioned project requirement set.

**Result:** A room schedule and a door schedule showing identity, building, storey, room associations, selected dimensions and ratings, with an exception list. A requirement result names the exact supplied rule; it is not general code approval.

**Model exercised:** `ModelSnapshot`, `BimObject`, source/evidence records, `Building`, `Storey`, `Space`, `Door`, `PropertyObservation`, `Assessment`.

**Decisive cases:** Duplicate room numbers on different levels; a scheduled room without geometry; a door between two rooms; a door with no established room; an inherited type value; conflicting occurrence/type observations; nominal leaf width supplied but clear width missing.

**Pass when:** Every source occurrence in the declared scope is represented or explicitly accounted for in diagnostics. Shared doors count once in the building inventory. Room memberships may produce multiple schedule associations without changing that count. Unavailable clear width never inherits a different width merely to satisfy a requirement. Missing rating produces an unresolved assessment.

## 2. Revision comparison with identity reconciliation

**Question:** What changed between deliveries, and which matches are uncertain?

**Inputs:** Two revisions of the first workflow's source, plus documented identity/correspondence rules. A controlled revision fixture supplements real revisions where necessary.

**Result:** Added, removed, changed and unresolved objects, with before/after facts and evidence. Distinguish building changes from changes in source coverage or interpretation policy.

**Model exercised:** `SourceRevision`, `ObjectCorrespondence`, `BimObject`, `SnapshotKey<T>`, `ObjectChange`.

**Decisive cases:** Reordered source rows; reused local IDs in different documents; renamed rooms; changed dimensions; unchanged objects exported again; an omitted object in an incomplete delivery; conflicting correspondence proposals; a changed mapping policy.

**Pass when:** Row reordering creates no semantic changes. Confirmed identity survives renaming. Uncertain correspondence is visible rather than forced into an addition/deletion. An omission implies removal only within an explicitly comparable, complete scope. Reimport is deterministic, and retaining a new revision does not alter the old snapshot's answer.

## 3. Roof and room-finish quantity takeoff

**Question:** How much roof membrane and room-facing finish is supported by the available measurements?

**Inputs:** Roof/wall/space data, surface measurements, assembly/finish assignments and a declared deduction policy. Finish specifications may need a supplemental source.

**Result:** Quantity lines grouped by assembly, material, room and work scope; supported subtotals and unresolved scopes remain separate.

**Model exercised:** `Roof`, `Wall`, `FinishSurface`, `SpaceBoundary`, `AssemblyDefinition`, `QuantityScope`, `QuantityObservation`, `QuantityTakeoff`.

**Decisive cases:** A pitched roof with different surface and projected areas; opposite faces of one wall with different finishes; opening deductions; conflicting measurements; a finish with no room assignment; multiple geometry representations; an assembly total alongside its component layers.

**Pass when:** Independently calculated fixture quantities match within declared tolerances. Each selected contribution is counted once at its stated basis. The two wall faces remain separate installation scopes. Geometry representations and assembly totals do not multiply material contributions. Missing measurements remain identifiable scopes rather than zero quantities.

## 4. Estimate with alternative pricing scenarios

**Question:** What can be priced for this package, and how does a changed rate or waste allowance affect it?

**Inputs:** Workflow 3 quantities; explicit package membership; a small versioned rate catalog; currency, rounding and waste policies.

**Result:** Estimate lines, a supported subtotal, unpriced/incomplete scope and a comparison of two scenarios.

**Model exercised:** `AnalysisScenario`, `WorkPackage`, `RateCatalog`, `RateItem`, `EstimateLine`, `EstimateSummary`.

**Decisive cases:** Known zero quantity; missing quantity; missing rate; incompatible rate units; mixed currencies; overlapping package membership; changed rate version; missing versus explicitly zero waste.

**Pass when:** The fixture reconciles under the declared arithmetic and rounding policy. Incompatible units/currencies cannot enter a combined total without explicit conversion. Unpriced scope blocks a claimed complete total. Scenario changes reuse the same measured quantities without rebuilding geometry or overwriting the earlier estimate.

## 5. Door procurement, delivery and installation reconciliation

**Question:** What was required, accepted on delivery and subsequently installed?

**Inputs:** Workflow 1's door/product scope, procurement requirements, multiple delivery receipts and dated installation observations.

**Result:** Reconciliation by product/package/location, including accepted quantities, shortages, rejected items and independently observed installation progress.

**Model exercised:** `ProductDefinition`, `ProcurementRequirement`, `DeliveryBatch`, `DeliveryLine`, `InstallationObservation`.

**Decisive cases:** Partial deliveries; rejected items; repeated ingestion of the same receipt; bulk products not assigned to occurrences; a proposed substitution; later observations that correct earlier progress.

**Pass when:** Repeated ingestion does not duplicate receipt quantities. Accepted delivery is never inferred to be installation. A proposed substitute does not satisfy a requirement without a recorded acceptance basis. Bulk supply can remain unallocated. Event history remains inspectable; expose a schema gap if corrections or substitution decisions cannot be represented faithfully.

## 6. Valve isolation and affected spaces

**Question:** Which fixtures and spaces are supported as downstream of this valve, and where is the answer uncertain?

**Inputs:** A small service network with identified ports, connections, direction/flow assumptions and the connections accepted by the traversal policy. Include a real MEP export when topology is available.

**Result:** Trace members with predecessor/path evidence, affected fixtures/spaces, unresolved boundaries and truncation status.

**Model exercised:** `ServiceSystem`, `ServicePort`, `ServiceConnection`, `Valve`, `SanitaryFixture`, `ServiceTraceResult`, `ServiceTraceMember`.

**Decisive cases:** Branches, cycles, closed valves, uncertain direction, inferred connections, nearby unconnected pipes, missing exported links and a query limit reached mid-traversal.

**Pass when:** The complete fixture has the independently expected reachable set; traversal terminates on cycles. Removing a connection from an incomplete export reduces confidence rather than proving physical isolation. Inferred edges are included only by explicit policy. Missing valve-state or direction semantics become documented design gaps rather than hidden query assumptions.

## 7. Shared penetrations and equipment access coordination

**Question:** Which services use a shared opening, and which objects may obstruct a required access region?

**Inputs:** Architectural and MEP sources with frame registration, geometry/prototypes, penetration associations and externally supplied access requirements.

**Result:** Shared-opening schedules and spatial candidate findings, including participants, transforms, tolerance and evidence basis.

**Model exercised:** `CoordinateFrame`, `GeometryRepresentation`, `ServicePenetration`, `PenetratingService`, `ServiceSupport`, `ServiceAccessEnvelope`, `SpatialConflict`.

**Decisive cases:** Translated/rotated instances; two services sharing one opening/support; overlapping bounds without solid overlap; unknown registration; conflicting duplicate representations.

**Pass when:** Registered fixtures produce the expected candidates in one declared frame. Unknown registration blocks a conclusive spatial answer. Shared assemblies count once. Bounds-only checks never report verified solid intersection or adequate clearance. Exact geometry checks, if added, must have their own verified fixture and explicitly stronger evidence basis.

## 8. Asset handover and maintenance work list

**Question:** What equipment requires attention, where is it, and which handover records are missing?

**Inputs:** Equipment occurrences, asset mappings, manuals/serial numbers, supplied service requirements and task/inspection observations evaluated as of a fixed date.

**Result:** Asset register, handover gaps and maintenance work list with location, evidence and an optional selected geometry representation.

**Model exercised:** `Asset`, `AssetServiceRequirement`, `MaintenanceTask`, `InspectionObservation`, equipment records and `ElementInfo`.

**Decisive cases:** One pump represented in several disciplines; missing serial number; replaced equipment; missing completion evidence; several service requirements; inaccessible geometry payload.

**Pass when:** An asset facet does not add another physical pump to inventory. Missing maintenance history remains unknown. Any due-date calculation names its supplied scheduling policy. Replacing equipment preserves the prior asset's history. Listing tasks and locations works without loading all geometry.

## 9. Material carbon comparison

**Question:** How do two material options compare under the same calculation boundary, and how much scope is unresolved?

**Inputs:** Workflow 3's disjoint material contributions and explicitly mapped, versioned environmental factors with compatible units and lifecycle modules.

**Result:** Impact contributions and scenario summaries with factor provenance and quantified coverage where the missing scope itself is measurable.

**Model exercised:** `MaterialUse`, `EnvironmentalFactor`, `ImpactLine`, `ImpactSummary`, `AnalysisScenario`.

**Decisive cases:** Assembly and layer totals both present; kg versus m3 factors; missing density; alternative factors; incompatible lifecycle modules; unmapped products; a newly published factor version.

**Pass when:** Fixture arithmetic reconciles, assembly/part contributions do not double count, and missing conversions cannot be guessed. Only explicitly selected compatible factors contribute. A new factor version creates a reproducible new scenario without changing the old result. Missing quantities do not support an invented percentage of mass coverage.

## 10. Portfolio comparison and prepared-data reopening

**Question:** Which buildings have the greatest measured cost, carbon or unresolved scope on a comparable basis?

**Inputs:** Selected snapshots and results from multiple buildings, compatible metric definitions, area conventions and scenario/period selections. Use representative large prepared data, with synthetic replication identified separately.

**Result:** Ranked metrics, excluded/incomparable entries, coverage, drill-through to contributions and a repeatable performance report.

**Model exercised:** Building/snapshot identity, result scopes, selective loading, persistence and aggregation boundaries.

**Decisive cases:** Several revisions of one building; one source covering several buildings; different area bases; missing denominators; overlapping source representations; incompatible scenarios; a fresh process reopening prepared data.

**Pass when:** Each physical scope contributes once under explicit snapshot selection. Incompatible metrics are separated; missing denominators do not yield zero intensity. Supported aggregation can be traced back to its rows. On a named representative corpus and workstation, target prepared opening plus the first useful query within ten seconds and peak process memory at or below 16 GiB. Report source preparation separately, along with process/cache conditions, repeated timings and peak memory. Synthetic scale alone does not prove real-corpus performance.

## Proposed execution order and decision gates

1. **Foundation: workflows 1–3.** First prove the source adapter, identity rules, measurement semantics and persistence using a small architectural corpus. Stop and revise the design if ordinary schedules require invented facts or opaque property-name searches outside the adapter.
2. **External information and operations: workflows 4–5.** Prove scenarios, external reference data, event identity and reconciliation. Begin workflow 9 here if suitable material inputs exist.
3. **Topology and geometry: workflows 6–7.** Obtain suitable MEP inputs first. Explicitly report source coverage separately from algorithm correctness on controlled fixtures.
4. **Lifecycle and scale: workflows 8–10.** Prove history, comparability and selective loading. Instrument timings from workflow 1 onward; the final workflow applies the full scale gate.

For every workflow, finish with a short design decision record: fields that worked, missing concepts, awkward joins, validation rules needed, observed allocation costs and proposed schema changes. A discovered gap is a useful experiment outcome, but the affected capability remains unproven until the revised model passes.

Egress, acoustic simulation, structural analysis and detailed equipment performance are follow-on experiments. Their current result records can be reviewed for provenance and input coverage, but accepting a result shape does not validate an engineering solver. Earthworks, landscape and other unexercised domain records also remain outside the proof provided by this initial set.
