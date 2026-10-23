# trim-band: a structured grid inside the trim, CDT and refinement only on the band (TKT-490)

Ticket: TKT-490
Status: working: measurement

## What is here

- `measure/`: a throwaway C# measurement, not library code. It compiles the corpus harness's sources against a
  private export of bim-open-data (`docs/plans/step-mesher-corpus-2026-10-19.md`, "How to rerun") and, for the curved
  faces of one file that took the CDT path, runs today's `MeshFace` and the band path back to back, timing each,
  then checks the band mesh's deviation (a 28-point lattice per rendered triangle), the harness's contract check,
  and watertightness in parameter space (every element edge used twice, boundary segments once, total area equal
  to the region's). Build and run:

  ```
  dotnet build sandbox/step-mesh-staging/trim-band/measure -c Release -p:BimOpenData=<export>/deps/bim-open-data --artifacts-path <out> -m:1
  trim-band-measure <file.step> <prefix> [--top N] [--reps R] [--chordal mm] [--kinds a,b] [--faces i,j] [--sequential]
  ```

- The band path (`measure/BandMesh.cs`): one chart length h, halved until a 7 by 7 spread of cells over the region's
  box passes a sampled chordal test under both diagonal splits (no closed-form or derivative sizing had landed);
  cells a quarter cell clear of every boundary segment and inside by parity are interior; a keyhole row from each
  hole to the box's left edge and the removal of corner-only contacts keep every interior component's ring simple
  and unnested; the rings become extra holes of the region, which the library's own `TriangulateRegionCdtIndexed`
  and `RefineToSurfaceV1` mesh; the interior cells become quads where `IsKeptQuad` keeps them, else
  `CellTriangles`; `Lift` lifts the whole.

## Done
- measurement runs: see `docs/plans/step-mesher-trim-band-2026-10-22.md` for the numbers and the verdict.

## Merge instructions
- none yet

## Contract requests
- none

## Requests to other tracks
- none yet

## Findings
- At the host's 1 mm bound, the 150 slowest curved CDT faces of RCB-F9T are each one chordal cell (3 to 27
  boundary points, 1 to 25 triangles, deviation 0.003 to 0.2): no interior cell exists, so the band path has
  nothing to keep there.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| orientation, export, harness build | 35 min | 1 build |
| measurement program and first runs | 60 min | 3 builds, 2 runs |
