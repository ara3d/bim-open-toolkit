# Building-model design experiments

Executable workflows over typed BuildingModel records, with real BOS-to-BFAST preparation and independent controlled fixtures. Open [BimBuildingModel.sln](../../BimBuildingModel.sln) to browse the implementation.

| Boundary | Public entry points |
|---|---|
| Source preparation | `BuildingModel.Source.SourceCache.Prepare`, `Inspect`, `Verify`, `Load` |
| Architectural interpretation | `BuildingMapper.Map`, `ProjectionValidation.Validate` |
| Workflows 1–3 | `ArchitecturalWorkflows.Schedule`, `Compare`, `Takeoff` |
| Workflows 4–9 | `Operations.OperationsWorkflows.Estimate`, `Reconcile`, `Trace`, `Coordinate`, `Maintain`, `Carbon` |
| Workflow 10 | `PortfolioWorkflows.Compare` |
| Persistence | `BuildingModel.Workflows.IO.ProjectionStore.Write`, `Read`, `Options` |

The mapper returns immutable domain records plus field coverage, diagnostics and resolvable source/policy evidence. It selects architectural occurrences using declared category and property aliases. Numeric storage is an explicit policy. Unsupported source meanings remain unresolved; no physical buildings are inferred from source documents, no clear door widths from nominal widths, and no finish faces from wall area.

The operations request records make supplemental inputs explicit. Source files do not supply rates, receipt history, operational topology or environmental factors merely by containing architectural objects. The CLI emits input requirements for these workflows and accepts separately supplied JSON calculation requests. Synthetic examples are labeled and kept separate from real-source results.

See [runner instructions](../../tools/building-model-workflows/README.md), [measured validation and findings](../../tools/building-model-workflows/VALIDATION.md), and the original [workflow proposal](../Ara3D.BimOpenSchema.BuildingModel/DESIGN-PROVING-WORKFLOWS.md).
