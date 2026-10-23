---
id: TKT-509
title: STEP mesher: mesh.ElementFace.Take(1) reads index 0 of an empty mesh; Plato's Take requires n <= Count by design
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/07-validation/validation-checks-mesh.library.plato]
workflow: [W3]
confidence: medium
created: 2026-10-23
kind: defect
---

## Acceptance criteria

- [ ] every library call of Take(n) with a constant n > 0 either has a reason the array holds at least n elements or uses a clamped prefix; validation-checks-mesh.library.plato lines 403 and 409 handle a mesh with no elements
- [x] the owner decides whether Plato's stdlib gains a clamping TakeAtMost(xs, n) = Take(xs, n.Min(Count)); until then no caller relies on Take clamping

From v1-faces via the supervisor (2026-10-23): Take(1) on an empty array reads index 0, and Take(n) past the end reads out of range. That is Take's stated contract, not a stdlib defect: stdlib/foundation/primitives.library.plato's sub-range section says every sub-range is a window onto the source, none validates, and the preconditions are the caller's; Take reads 'The first n elements. Precondition: 0 <= n <= Count.' (Skip, TakeLast and SubArray state theirs the same way). Making Take clamp would change the generated C# of every caller and hide caller bugs like this one. The library has 11 calls of Take with a constant n > 0 and 236 of Take(0) (the empty-array idiom, always in range). The two at validation-checks-mesh.library.plato:403 and :409 pass mesh.ElementFace.Take(1) to a law over a restriction, which reads index 0 when the mesh has no elements.

## Decision (supervisor, 2026-10-23)

No TakeAtMost. Take keeps its stated precondition (0 <= n <= Count), and callers are fixed. The 11 constant-n call sites go to v1-faces to audit; F7 has already rebuilt the two at validation-checks-mesh.library.plato 403 and 409. The ticket stays open for the audit (box 1).


## Audit (v1-faces, 2026-10-23)

Constant n > 0 (15 calls, laws files included): F8 guards validation-checks-mesh.library.plato:403 and :409 (FirstElementFace); F8b gives the two o.Take(3) laws of pipeline-proofs-mesh-witness.laws.plato a premise of three outcomes, and states as a law that WholePoleSegment's samples.Take(samples.Count - 1) is in range (PoleSegmentSamplesAtLeast with least 3 returns at least 4 samples); the other 11 take a prefix of a literal of known size. The reasons per site are in sandbox/step-mesh-staging/v1-faces/TRACK.md (F8).

Computed n, left for after version 1 (supervisor, 2026-10-23), each to be read for whether n can exceed the count or go negative:

- `01-geometry/geometry.library.plato:582`: `=> extents.Take(i).SumOf;`
- `02-topology/topology.library.plato:1010`: `=> poly.Take(k).Reduce(0, (n, b) => n + m.Loops[b.Loop].PolyLoopPointsOf.Count);`
- `04-discretization/discretization-work.library.plato:27`: `ts = ts.Take(widest + 1).Concatenate([(ts[widest] + ts[widest + 1]) * 0.5]).Concatenate(ts.Skip(widest + 1));`
- `05-face-meshing/face-meshing-lift.library.plato:108`: `var keyed = keyedBuffer.Freeze().Take(keyedCount);`
- `05-face-meshing/face-meshing-lift.library.plato:144`: `var firsts = firstBuffer.Freeze().Take(next);`
- `05-face-meshing/face-meshing.library.plato:110`: `: ring.Take(at + 1).Concatenate(loop).Concatenate([ring[at]]).Concatenate(ring.Skip(at + 1));`
- `05-face-meshing/face-meshing.library.plato:165`: `current = current.Take(ear).Concatenate(current.Skip(ear + 1));`
- `05-face-meshing/face-meshing.library.plato:188`: `return at < 0 ? triangles : triangles.Take(at).Concatenate(split).Concatenate(triangles.Skip(at + 1));`
- `05-face-meshing/pole-segments.library.plato:160`: `return samples.Take(samples.Count - 1).ToUvLoop;`
- `05-face-meshing/triangulation-cdt-indexed.library.plato:220`: `: ring.Take(at + 1).Concatenate(loop).Concatenate([ring[at]]).Concatenate(ring.Skip(at + 1)),`
- `06-mesh/mesh-components-given.library.plato:65`: `return Counted(ComponentRootTables(lowest.Freeze().Take(size), below.Freeze()), Insertions(passes));`
- `06-mesh/mesh-incidence.library.plato:198`: `var elementComponent = component.Freeze().Take(elementCount);`
- `06-mesh/mesh-incidence.library.plato:199`: `var parents = parent.Freeze().Take(elementCount);`
- `06-mesh/mesh-incidence.library.plato:200`: `var depths = depth.Freeze().Take(elementCount);`
- `06-mesh/mesh-masks.library.plato:45`: `return mask.Freeze().Take(faceCount.Max(0));`
- `06-mesh/mesh-masks.library.plato:156`: `return seen.Freeze().Take(faceCount.Max(0));`
- `07-validation/validation-defects.library.plato:286`: `=> ds.Count.Range.FlatMap(i => [i].Take(FacesOf(ds[i]).Any(x => x.Value == f) ? 1 : 0));`
- `07-validation/validation-defects.library.plato:296`: `DefectClass.AllClasses.Map(k => CountOf(ds.FlatMap(d => [d].Take(ClassOf(d) == k ? 1 : 0)).Count)),`
- `09-tooling/tooling-diff-helpers.library.plato:25`: `=> [d].Take(same ? 0 : 1);`
- `09-tooling/tooling-dumps.library.plato:67`: `corners.Take(mesh.CornerNormals.Count == mesh.CornerCount ? corners.Count : 0).Map(c => mesh.CornerNormals[c].Vector),`
- `09-tooling/tooling-dumps.library.plato:94`: `points.Take(fm.Normals.Count == fm.UvPoints.Count ? points.Count : 0).Map(i => fm.Normals[i].Vector),`
- `09-tooling/tooling-law-runner-once.library.plato:41`: `=> NamedModel.ModelWitnesses.Take(NamedModel.PositiveWitnessCount);`
- `09-tooling/tooling-law-runner-once.library.plato:227`: `PipelineWitnessRunsFrom(cs.Take(NamedModel.PositiveWitnessCount), LawRun.PipelineMiddleRuns),`
- `11-repair/repair-diagnosis.library.plato:27`: `=> m.Faces.Count.MapRange(i => BrepFaceIndex(i)).FlatMap(f => [f].Take(keep(f) ? 1 : 0));`
- `11-repair/repair-diagnosis.library.plato:56`: `=> [f].Take(m.IsFaceInRange(f) ? 1 : 0);`
- `11-repair/repair-diagnosis.library.plato:201`: `? m.Faces[f].Bounds.Count.Range.FlatMap(b => [BoundSlot(b)].Take(keep(m.Faces[f].Bounds[b]) ? 1 : 0))`
- `11-repair/repair-diagnosis.library.plato:222`: `.FlatMap(s => [RepairAction.DeclareOpen(ShellIndex(s))].Take(m.UseCount(ShellIndex(s), e) > 0 ? 1 : 0))`
- `11-repair/repair-diagnosis.library.plato:273`: `=> ActionsOf(x).Take(ActionsOf(x).Count > 0 ? 1 : 0);`
- `11-repair/repair-indexed.library.plato:320`: `.FlatMap(s => [RepairAction.DeclareOpen(ShellIndex(s))].Take(m.UseCountIndexed(ix, ShellIndex(s), e) > 0 ? 1 : 0))`
