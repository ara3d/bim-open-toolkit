# Wave: view3d visualization nodes + rendering support

## Brief

**Intent:** Graph authors can drive the 3D view from data — hide, fade, explode/space,
grid-arrange, bounding-box, voxelize, and thin heavy models — and the pane/viewer
actually renders transparency, offsets, and box tables. Sample bim graphs ship.

**Size:** L (Geometry pack + web panes + viewer core + samples).

**Acceptance criteria**
- [ ] New `view3d.*` nodes, each spec'd, unit-tested, documented:
      hide, opacity, spacing, arrange, decimate, boundingBoxes, voxelize.
- [ ] Instance-table conventions extended and documented in the Geometry README:
      alpha-only `a` column, `offsetX/Y/Z` columns, boxes table (port `boxes`).
- [ ] Pane logic parses alpha / offsets / boxes into plans (headless unit tests).
- [ ] viewer-core renders per-instance alpha (0 hides, fractional fades) — closes the
      Track VCORE gap in group-object.ts.
- [ ] Pane applies offsets by rewriting instance transforms; boxes render as
      instanced unit cubes via scene.addGroup.
- [ ] `samples/analyses-bim/` graphs (color, ghost, explode, massing boxes, voxel
      density, decimate) seeded under the bim profile and verified by a test.
- [ ] docs/nodes.md regenerated; NodeNotes entries added.

**Completion criteria:** gates green - evidence captured - docs updated - pushed -
debt filed as TODOs.

**Non-goals**
- Pushing `{kind:"model"}` into the 3D pane from the web app (existing TODO in
  paneArea.ts/paneContext.ts; separate track).
- Triangle-level mesh decimation (decimate = instance thinning).
- `view3d.colormap`, chart nodes, legends (core-node-sets proposal Set 4).
- Voxel occupancy from triangles (AABB approximation only).

**Replaces / retires:** nothing — net-add, deliberate. TestSupport.cs migration to
TestKit filed as debt, not done here.

**Risks:** three.js per-instance alpha needs a shader chunk (onBeforeCompile) —
transparency sorting artifacts possible; voxel count blowup (capped + warn);
seeding change touches host startup.

**Kill criteria / fallback:** if per-instance alpha can't render via a shader chunk,
hide (alpha 0) falls back to zero-scaled instance transforms and fractional alpha is
documented unsupported; the nodes still ship.

## Contracts (landed by supervisor before the wave)

Instance-table convention extensions (README.md is normative):
- `a` alone (without r/g/b) is honored: per-instance alpha; 0 hides, (0,1) fades.
- Optional `offsetX offsetY offsetZ` (Number): the pane translates each instance by
  its offset on top of the loaded transform. Nodes accumulate onto existing offset
  columns and shift `minX..maxZ` by the same amount so bounds stay descriptive.
- Boxes table: output port + table name `boxes`; required `minX..maxZ`; optional
  `r g b a`, `label`, `count`, `voxelId`. Pane renders each row as an axis-aligned
  box (instanced unit cube); default color gray when no color columns.

Node specs land as compilable skeletons (Eval => throw) wired into GeometryNodes.All.

## Fence table

| Track | Fence (writes) | Spec files |
|---|---|---|
| A nodes-vis | src/BimOpenFlow.Nodes.Geometry/{HideNode,OpacityNode,DecimateNode}.cs; tests/BimOpenFlow.Nodes.Geometry.Tests/{HideNodeTests,OpacityNodeTests,DecimateNodeTests}.cs | the three test files |
| B nodes-offset | src/BimOpenFlow.Nodes.Geometry/{SpacingNode,ArrangeNode}.cs; tests/.../{SpacingNodeTests,ArrangeNodeTests}.cs | the two test files |
| C nodes-boxes | src/BimOpenFlow.Nodes.Geometry/{BoundingBoxesNode,VoxelizeNode,BoxTables}.cs; tests/.../{BoundingBoxesNodeTests,VoxelizeNodeTests}.cs | the two test files |
| D web-panes | bimopenflow/web/packages/panes/src/** (+ tests), bimopenflow/web/packages/app/src/{paneChoice,paneArea}.ts (+ app tests) | panes/app test files |
| E viewer-alpha | viewer/packages/core/src/{group-object,material,instanced-group}.ts + core tests | core test files |

Shared-file rule: no track edits TableOps.cs, GeometryNodes.cs, README.md, or another
track's files. Wanted helpers are private to the track's own files; supervisor
dedupes in the refactor step.

## Sequencing

1. Contracts commit (skeletons + README + csproj TestKit ref) — baseline gates green.
2. Wave: tracks A–E in parallel (parallel-wave skill).
3. Integration: build, all tests, web/viewer test suites, NodeDocs regen, NodeNotes.
4. Samples: samples/analyses-bim/ + profile-aware seeding + verification test.
5. Fresh-context review on the diff vs acceptance criteria; fix; commit; push.

## Findings

(appended as the wave runs)
