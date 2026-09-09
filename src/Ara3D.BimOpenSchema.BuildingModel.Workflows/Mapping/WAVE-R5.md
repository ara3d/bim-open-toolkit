# Wave R5: map every source category into the core building model

Checkout: `C:\Users\cdigg\git\bim-open-toolkit` (shared, branch `main`, no branches).
Supervisor: the main session. Tracks A–H are Sonnet agents; review (R) and improvement (I) are Opus agents.

## Acceptance

- Every source category with a matching core record is mapped by exactly one domain, for Revit (Snowdon, Golden Nugget) and IFC (all-medium) category labels.
- The Snowdon DuckDB export populates the new tables (walls, windows, floors, ceilings, stairs, structural members, pipes, ducts, lighting, circuits, materials, product and assembly definitions, and the rest listed per track) with the counts the source inventory shows.
- Storey, space, door and roof behaviour is unchanged: 84 / 290 / 142 / 26 on Snowdon; all pre-R5 tests pass.
- Nothing is inferred from names or display units. Unknown storage units stay unavailable with a reason. A category whose meaning is ambiguous stays unmapped and is listed as a finding in the track checkpoint, not mapped by guess.
- Every mapped row survives JSON persistence and the DuckDB writer, and `ProjectionValidation` reports no `validation.*` findings for the Snowdon projection.

## Baseline and gates

Baseline before R5 (commit 59e415d + contract): `dotnet build BimBuildingModel.sln` 0 errors, one pre-existing warning in `Ara3D.BimOpenSchema/DataTableFromEntities.cs`; tests 19 + 33 pass.
Required gates for the wave: the same build, all tests in `tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests` and `tests/Ara3D.BimOpenSchema.BuildingModel.Tests`, plus the Snowdon-backed tests when the export is present.

Per-track check (isolated build output, safe to run while other tracks build):

```
dotnet test tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests --artifacts-path artifacts/wave/<track> --filter "FullyQualifiedName~<Track>MappingTests|FullyQualifiedName~ContractTests"
```

Another track's half-written file can break this build. Wait about 60 seconds and retry, up to five times. Never edit a file outside your fence to make the build pass; record it as a blocker instead.

## Contract R5

| Piece | Path |
|---|---|
| Projection with one typed table per core record | `Contracts.cs` (`BuildingProjection`) |
| Domain registration | `Mapping/DomainMapping.cs` (`DomainMapping`, `CategoryRule`) |
| Shared kernel: identity, evidence, coverage, field lookups | `Mapping/MappingKernel.cs` |
| Row accumulation and the table list | `Mapping/ProjectionBuilder.cs` |
| Orchestration and duplicate-claim check | `Mapping/BuildingMapper.cs` (`Domains`, `Rules`) |
| Reflection over tables and references | `Mapping/ProjectionTables.cs`, `Mapping/RowReferences.cs` |
| Validation for every table | `Mapping/ProjectionValidation.cs` |
| Storeys, spaces, doors, roofs (unchanged behaviour) | `Mapping/Domains/CoreMapping.cs` |
| Test fixture builder and the Snowdon source | `tests/.../Mapping/MappingFixture.cs`, `tests/.../SnowdonSource.cs` |
| Contract tests | `tests/.../ContractTests.cs` |

Rules a domain must follow:

- `CategoryRule.Kind` is the core record type name. `BuildingMapper.Rules` throws for a category claimed twice or a kind without a table; `ContractTests` runs it.
- Build every row through the kernel: `k.Key<T>(e)`, `k.Element(e)` (once per occurrence), `k.Text`, `k.Number`, `k.Integer`, `k.Flag`, `k.Duration`, `k.Reference<T>`, `k.Links<T>`, `k.Product`, `k.Assembly`, `k.Resolve` for custom conversions, `k.Count` for a field you decide without a lookup, `k.Diagnose` for anything you deliberately leave unresolved.
- Plain enum fields (not `Fact<>`) take `Unknown` unless the category itself fixes the value; never derive an enum from a name.
- `ApprovedGroups` lists the parameter groups your lookups may read in addition to the kernel defaults (Identity Data, Dimensions, Constraints, Data, Geometry, Text, Other). Look at `artifacts/wave/*-categories.json` for the real group names.
- Numbers: pass the canonical unit key (`m`, `m2`, `m3`, `rad`, `min`). Under the Revit internal policy the kernel converts feet-based lengths, areas, volumes and radians. Anything else (flow, power, pressure, temperature, thermal transmittance) stays unavailable; record it as a finding rather than adding a conversion guess.
- Non-element records (`ElectricalCircuit`, `ServiceSystem`, `Material`) use `k.Key<T>(e)` or `new ReferenceKey<T>(k.Identity(e.Id).Value)` and `k.IdentityEvidence(e.Id)`.
- `Complete` runs after every domain's `Map`, in registration order; Definitions runs last.

## Source inventories

`artifacts/wave/snowdon-categories.json`, `artifacts/wave/golden-nugget-categories.json`, `artifacts/wave/all-medium-categories.json` list, per source category, the descriptors (name, group, kind, units, whether inherited from the type, sample values) that occurrences carry. Use them to choose aliases and groups. Snowdon and Golden Nugget store numbers in Revit internal units (feet); all-medium is IFC with empty units.

## Tracks

Supervisor owns everything not listed below, including the contract files, `CoreMapping.cs`, `BuildingMapper.Domains`, the wave plan, the CLI, README files, and the combined findings. Commit turn: agents do not commit; the supervisor reviews and commits each track with explicit paths after its gate passes (there is no message channel for turn grants in this host).

| Track | Domain file (writes only) | Test file (writes only) | Checkpoint | Records and categories |
|---|---|---|---|---|
| A Envelope | `Mapping/Domains/EnvelopeMapping.cs` | `tests/.../Mapping/EnvelopeMappingTests.cs` | `artifacts/wave/checkpoints/A.md` | Wall: Walls, IFCWALL, IFCWALLSTANDARDCASE, IFCCURTAINWALL, Wände. Floor: Floors, IFCSLAB, Geschossdecken. Ceiling: Ceilings, Decken. Window: Windows, IFCWINDOW, Fenster. Opening: Shaft Openings, Rectangular Straight Wall Opening, Structural opening cut, IFCOPENINGELEMENT. FacadePanel: Curtain Panels, IFCPLATE. Leave unmapped and record: Curtain Wall Mullions, IFCMEMBER, IFCCOVERING, Wall Sweeps, Slab Edges, Fascias, Gutters, Roof Soffits. |
| B Circulation | `Mapping/Domains/CirculationMapping.cs` | `tests/.../Mapping/CirculationMappingTests.cs` | `artifacts/wave/checkpoints/B.md` | Stair: Stairs, Multistory Stairs, IFCSTAIR, Treppen. StairFlight: Runs, IFCSTAIRFLIGHT. Landing: Landings. Ramp: Ramps, IFCRAMP. Railing: Railings, Handrails, Top Rails, IFCRAILING. VerticalTransport: IFCTRANSPORTELEMENT. Furniture: Furniture, Casework, Furniture Systems, IFCFURNITURE, IFCFURNISHINGELEMENT, IFCSYSTEMFURNITUREELEMENT, Möbel. Leave unmapped and record: Balusters, Supports, Vertical Circulation, IFCRAMPFLIGHT, Specialty Equipment, Food Service Equipment, Entourage. |
| C Structure | `Mapping/Domains/StructureMapping.cs` | `tests/.../Mapping/StructureMappingTests.cs` | `artifacts/wave/checkpoints/C.md` | StructuralMember: Structural Framing (role Beam), Structural Columns (role Column), Structural Trusses, IFCBEAM (Beam), IFCCOLUMN (Column). Foundation: Structural Foundations, IFCFOOTING, IFCPILE. StructuralConnection: Structural Connections. ReinforcementGroup: Structural Rebar, Structural Area Reinforcement, Structural Fabric Reinforcement, IFCREINFORCINGBAR, IFCREINFORCINGMESH. Leave unmapped and record: Columns (architectural), Structural Beam Systems, Analytical Surfaces, Analytical Spaces, Boundary Conditions, Structural Fabric Areas. |
| D Places | `Mapping/Domains/PlacesMapping.cs` | `tests/.../Mapping/PlacesMappingTests.cs` | `artifacts/wave/checkpoints/D.md` | Project: Project Information, IFCPROJECT. Site: IFCSITE. Building: IFCBUILDING. Zone: HVAC Zones, Areas, IFCZONE. TerrainSurface: Toposolid, Topography, Toposurface. PavedArea: Hardscape, Roads. LandscapeAsset: Planting. Leave unmapped and record: Site (Revit category, inspect its contents first), Parking, Grids, Mass, Mass Floor, Shared Site, Survey Point, Project Base Point, Primary Contours. Documents are never buildings. |
| E HVAC | `Mapping/Domains/HvacMapping.cs` | `tests/.../Mapping/HvacMappingTests.cs` | `artifacts/wave/checkpoints/E.md` | DuctSegment: Ducts, Flex Ducts, IFCDUCTSEGMENT. DuctFitting: Duct Fittings, IFCDUCTFITTING. AirTerminal: Air Terminals, IFCAIRTERMINAL. Damper: IFCDAMPER. Fan: IFCFAN. AirHandlingUnit: IFCUNITARYEQUIPMENT. ServiceSystem: Duct Systems, IFCDISTRIBUTIONSYSTEM (discipline Unknown unless the System Classification text matches an enum name exactly). Leave unmapped and record: Duct Accessories, Mechanical Equipment, IFCFLOWTERMINAL, IFCDISTRIBUTIONFLOWELEMENT, IFCFLOWSEGMENT, Duct Insulations, Duct Linings. |
| F Plumbing | `Mapping/Domains/PlumbingMapping.cs` | `tests/.../Mapping/PlumbingMappingTests.cs` | `artifacts/wave/checkpoints/F.md` | PipeSegment: Pipes, Flex Pipes, IFCPIPESEGMENT. PipeFitting: Pipe Fittings, IFCPIPEFITTING. Valve: IFCVALVE. SanitaryFixture: Plumbing Fixtures, IFCSANITARYTERMINAL. FireProtectionTerminal: Sprinklers, IFCFIRESUPPRESSIONTERMINAL. Pump: IFCPUMP. Drain: IFCWASTETERMINAL. ServiceSystem: Piping Systems. Leave unmapped and record: Pipe Accessories, Plumbing Equipment, Pipe Insulations, Pipe Segments (routing preferences, not elements). |
| G Electrical | `Mapping/Domains/ElectricalMapping.cs` | `tests/.../Mapping/ElectricalMappingTests.cs` | `artifacts/wave/checkpoints/G.md` | ElectricalCircuit: Electrical Circuits, IFCELECTRICALCIRCUIT (Designation from Circuit Number). LightingFixture: Lighting Fixtures, IFCLIGHTFIXTURE. ElectricalDevice: Electrical Fixtures, Lighting Devices, Data Devices (DataOutlet), Communication Devices, Fire Alarm Devices, Security Devices, Nurse Call Devices, Telephone Devices, IFCOUTLET (SocketOutlet), IFCSWITCHINGDEVICE (Switch), IFCSENSOR (Sensor), IFCALARM (Alarm). CableSegment: Wires, IFCCABLESEGMENT. CableContainment: Conduits (Conduit), Cable Trays (CableTray), IFCCABLECARRIERSEGMENT. ElectricalPanel: IFCELECTRICDISTRIBUTIONBOARD. Leave unmapped and record: Electrical Equipment, Conduit Fittings, Cable Tray Fittings, IFCCABLECARRIERFITTING, Switch System, Electrical Spare/Space Circuits, IFCELECTRICAPPLIANCE. Note (verified by track G): Snowdon's Panel parameter on circuits, fixtures and devices is plain text in group Electrical - Loads, not an entity reference, so a future panel mapping must join on the panel's text name. |
| H Definitions | `Mapping/Domains/DefinitionsMapping.cs` | `tests/.../Mapping/DefinitionsMappingTests.cs` | `artifacts/wave/checkpoints/H.md` | Material: Materials, IFCMATERIAL (MaterialClass only from an exact class name; otherwise Unclassified). ProductDefinition and AssemblyDefinition: enrich the baseline rows for every type the kernel recorded (manufacturer, model, type mark, assembly kind from the type's category, fire rating, thermal values when canonical). The baseline `Complete` already exists; keep every used type covered. |
| R Review (Opus) | `artifacts/wave/REVIEW.md` | none | same file | Reviews A–H against this plan and the Platonic principles; logs defects and improvement opportunities. Read-only otherwise. |
| I Improve (Opus) | any file under `src/Ara3D.BimOpenSchema.BuildingModel.Workflows/Mapping/` and `tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests/`; `artifacts/wave/IMPROVE.md` | as listed | same | Applies the review's opportunities after A–H are integrated; the supervisor gates and commits. |

Dependencies: A–H depend only on contract R5 (this document and the committed contract). H's enrichment of product and assembly rows is exercised by any track calling `k.Product`/`k.Assembly` (Core already does for doors and roofs). R starts when A–H are integrated. I starts when R has written its findings.

Tests each track must add:

1. Synthetic tests built with `MappingFixture`: counts per kind, at least one numeric field under `NumericStoragePolicy.RevitInternal` and one under the default policy (must be unavailable), one reference field, one invalid or conflicting case, and `ProjectionValidation.Validate(p)` empty.
2. One large test `[Category("Size.Large"), Category("Source.Snowdon")]` using `SnowdonSource` that asserts the Snowdon row counts for the track's kinds (from `artifacts/wave/snowdon-categories.json`; for example Walls 1277, Windows 174) and that no `validation.*` diagnostic mentions the track's tables.

## Checkpoint format

Track / owner / contract revision; state (working, implemented, verified); files; commands run and actual results; categories deliberately left unmapped and why; fields that stay unavailable and why; requests for the supervisor; findings for the reviewer.

## Integration record (2026-09-09)

Outcome: verified success. Commits 9c32bf4 (contract), 7a10cba through 80a2b83 (tracks A–H), ff739cc (CLI), bb1260b and 07b00a7 (DuckDB writer performance), b690b4e (review applied). All pushed to origin/main.

Stable input state: all eight track agents, the reviewer and the improver had stopped before each gate; the working tree held only the files listed in the corresponding commit plus unrelated edits from the user's other session, which were never staged.

Gates (dotnet build BimBuildingModel.sln, then dotnet test, isolated under artifacts/wave/supervisor):
- After tracks A–H: 0 errors; 19 + 92 tests pass; Workflows suite 9 m 24 s.
- After the review was applied: 0 errors; 19 + 96 tests pass; Workflows suite 43 s. The Snowdon DuckDB export takes 28 s (was 6 m 46 s at the first integration).
- Snowdon counts unchanged for the pre-R5 kinds (84 storeys, 290 spaces, 142 doors, 26 roofs) and as recorded per track for the new kinds; the regenerated export has 48 populated tables, 1277 walls, 174 windows, 7872 system memberships, 753 materials.
- Not run: the browser check for the DuckDB demo (scripts/check-bim-flow-duckdb.mjs); its fixed row counts and the docs/bim-flow-duckdb.md figures describe the old four-kind export and need updating when the demo database is swapped.

Findings kept for the user (from artifacts/wave/REVIEW.md and the track checkpoints):
- Core record additions need a decision: Project has no name field; SanitaryFixture has no SystemId; AssemblyDefinition.LayerDirection is a bare string.
- Largest populations still unmapped by design: Curtain Wall Mullions, Supports, Balusters, Conduit Fittings, Wall Sweeps, Specialty Equipment, Electrical Equipment, architectural Columns, Pipe Accessories. Each needs a core record before it can be mapped.
- Units the kernel deliberately does not convert stay unavailable: flow, pressure, power, voltage, current, mass, thermal values.
- IFC category rules are exercised by synthetic fixtures only; no Golden Nugget or all-medium assertion exists yet.
- The evidence table (about 147,000 rows) still goes through INSERT text because DuckDB.NET 1.3.2 cannot append struct lists.
- The demo database artifacts/building-model-workflows/snowdon-cli.duckdb was left in place because the demo host was running; the new export was snowdon-cli.r5.duckdb beside it.

## Demo swap (2026-09-09)

The R5 export now is artifacts/building-model-workflows/snowdon-cli.duckdb; the four-kind export is kept beside it as snowdon-cli.pre-r5.duckdb until nobody needs it. Every demo path (store graphs, scripts, README) was unchanged by the swap. scripts/check-bim-flow-duckdb.mjs passes against it: the schedule, room, roof and evidence counts (142 / 290 / 34 / 26 / 156) are the same because the sample graphs only query the four original kinds; the source-provenance graph grew from 8 to 14 groups because every document now records a type row, and the check asserts that. The check had also been failing on a page-height assertion since the Ask box landed: the transcript banner stacked above a full-viewport editor; docs/bim-flow-duckdb.md and the demo stylesheet were updated with the swap.
