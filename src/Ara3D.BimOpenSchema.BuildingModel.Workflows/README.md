# Core BIM workflows

This project maps prepared BIM Open Schema data into the core BuildingModel and runs source-backed architectural reports.

| Boundary | Entry point |
|---|---|
| Source preparation | `SourceCache.Prepare`, `Inspect`, `Verify`, `Load` |
| Architectural interpretation | `BuildingMapper.Map`, `ProjectionValidation.Validate` |
| Core reports | `ArchitecturalWorkflows.Schedule`, `Compare`, `Takeoff`, `PortfolioWorkflows.Compare` |
| Persistence | `ProjectionStore.Write`, `Read`, `Options` |

The mapper is a set of domains sharing one kernel (`Mapping/MappingKernel.cs`); each domain in `Mapping/Domains/` claims source categories and builds typed rows. Together they populate storeys, spaces, doors, roofs, walls, floors, ceilings, windows, openings, facade panels, stairs, flights, landings, ramps, railings, furniture, structural members, foundations, connections, reinforcement, projects, zones, terrain, paved areas, landscape assets, ducts, duct fittings, air terminals, pipes, pipe fittings, sanitary fixtures, service systems and memberships, circuits, lighting fixtures, electrical devices, cables, containment, materials, product definitions and assembly definitions. `Mapping/WAVE-R5.md` lists which categories each domain claims and which stay unmapped. The mapper records field coverage, diagnostics and source/policy evidence. Unsupported meanings stay unresolved: source documents are not inferred to be buildings, nominal door dimensions do not become clear openings, generic areas and volumes do not become net quantities, and wall area does not become a finish quantity.

Commercial, maintenance, compliance and analysis calculations are intentionally absent from this project. They should consume core identities and source evidence from separate extension packages when real inputs and workflows justify them.
