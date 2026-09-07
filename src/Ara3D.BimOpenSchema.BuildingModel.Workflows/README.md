# Core BIM workflows

This project maps prepared BIM Open Schema data into the core BuildingModel and runs source-backed architectural reports.

| Boundary | Entry point |
|---|---|
| Source preparation | `SourceCache.Prepare`, `Inspect`, `Verify`, `Load` |
| Architectural interpretation | `BuildingMapper.Map`, `ProjectionValidation.Validate` |
| Core reports | `ArchitecturalWorkflows.Schedule`, `Compare`, `Takeoff`, `PortfolioWorkflows.Compare` |
| Persistence | `ProjectionStore.Write`, `Read`, `Options` |

The mapper currently populates `Storey`, `Space`, `Door` and `Roof`. It records field coverage, diagnostics and source/policy evidence. Unsupported meanings stay unresolved: source documents are not inferred to be buildings, nominal door dimensions do not become clear openings, and wall area does not become a finish quantity.

Commercial, maintenance, compliance and analysis calculations are intentionally absent from this project. They should consume core identities and source evidence from separate extension packages when real inputs and workflows justify them.
