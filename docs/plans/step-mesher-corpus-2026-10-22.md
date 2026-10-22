# STEP mesher corpus run, 2026-10-22

The 88 u-blox files of the 3D-Step-Models-Library through the C# STEP mesher's host path, the first corpus run since
the Plato compiler fix of TKT-410 and the 25 chunk merges of 2026-10-22, run the way the run of 2026-10-21 was made
(`docs/plans/step-mesher-corpus-2026-10-21.md`). **81 files meshed fully, 7 partly, 0 passed 120 s, 0 exceptions
(no face threw, no edge threw, no stub reached).** 192,404 of the 192,457 faces meshed (99.97%; 2026-10-21: 168,965
of 191,450, 88.3%; the total grew by NINA-B222-W1x2's 1,007 faces, the file that now finishes). The 53 unmeshed faces
are 26 whose edges came back with no segments (all in NINA-B222-W1x2), 15 reported not simple, and 12 that the
refinement loop remeshed to nothing. Only 39 of the 88 assembled meshes are closed and 84 consistently oriented: 39
fully meshed files still have boundary edges (32,983 in all, 6,544 in each of the two M2-JODY-W377 files), and
whether those are open shells in the files or mesher defects is not yet known (the v1-edges track is classifying
them). Four files that were closed on 2026-10-21 now have non-manifold and misoriented edges (ODIN-W160, ODIN-W161,
M2_JODY-W5 and W6 CARD, ELLA-W1); the v1-gate track is bisecting them. The harness's version 1 contract check
(TKT-432) finds 0 unexplained faces and breaks on 16 files: 2 faces over the chordal bound, 10 with flipped elements,
9 with degenerate ones. Warm meshing took 136.4 s over the 88 files against 384.3 s over 87 on 2026-10-21; the prepare
stage fell from 86.9 s to 6.2 s over the same 87 files, 14 times faster, where unchanged parsing ran 1.8 times faster.

## What was measured

- **bim-open-data** `b2cfaf3` for the host: `StepPlatoMesher` runs layer 8's `Step` in parts, the remeshed faces on
  every core (chunk P6, TKT-454 and TKT-436), and its options are layer 8's `HostMeshingOptions`. The harness at the
  same commit includes `66f0da1`, the contract check's fix for quads (TKT-455, the harness half of V1G-10), and
  `d8bb198`, the contract check itself (TKT-432). Built in Release into the session's scratchpad.
- **Compiled library**: `Ara3D.StepBrep` at bim-open-data `66577fc`, generated from Plato `c8c83c8b` and
  bim-open-toolkit library `43dd439b`, layers 00 to 08, cpu64. The regeneration's stub check (`check_generated.py`)
  is clean: 31 stubs, 0 degraded, 30 listed bodiless, 0 failures.
- **Toolkit**: pinned at `ec2b7938` (bim-open-data `66577fc`) when the run was prepared, then `ab717770` (bim-open-data
  `b2cfaf3`), the commit the run used.
- **Command**: `step-corpus-harness all <corpus> <out> 120 --path host --parallel --warmup`. The run took 779 s of
  wall time; the 88 processes sum to 778 s.
- **Corpus**: `C:\Users\cdigg\git\3d-format-shootout\data\submodules\3D-Step-Models-Library`, 88 files (CEL, POS, SHO).
- **Machine**: the owner's Windows machine, 22 logical processors, shared with other sessions, so times are noisy.
  Parsing, whose code did not change between the two runs, took 3.4 s against 6.0 s on 2026-10-21 over the same 87
  files: this run had about 1.8 times more of the machine.
- **Harness behaviour** as on 2026-10-21 (each file in its own process, meshed once untimed and once timed, edges and
  faces on every core), with two additions: every mode runs the host's refinement loop on blocking requests
  (`refine_ms`, bim-open-data `36db5fb`, P5), and every face is checked against the version 1 mesh contract
  (`<prefix>.contract.csv` lists the faces that break it; the check is untimed but inside the process time).

What moved the numbers, between library `8984df4b` (2026-10-21) and `43dd439b`:

- **TKT-410**, the Plato compiler fix in `c8c83c8b`: `BisectionCached.SagittaByHullBoundGiven` is real code, no longer
  a throwing stub. On 2026-10-21, 22,410 faces were unmeshed behind it.
- **The 25 chunk merges of 2026-10-22**, in merge order: V1G-1, V1G-2, F1, E3, E1, E2, V1G-4, V1G-3, V1G-5, V1G-6,
  V1G-7, F3 with F3b, F2, T1, V1G-8, V1G-10, V1G-11, V1G-12, V1G-13, J1, F4b, J2, P6, J4, J3
  (`docs/plans/step-mesher-v2.md`, the chunk table and the log's first entry, which names the 20 merged after the
  regeneration `e646e28`; the first five were merged earlier the same night). V1G-9 was a finding, not a merge
  (TKT-455); F4a was dropped.
- **Host and harness**: P4 (`b2d6983`, the host acts on blocking edge-refinement requests), P5 (`36db5fb`, every
  harness mode runs that loop), P6's host half (`b2cfaf3`).

## Totals

| Outcome | Files | Faces | Notes |
|---|---|---|---|
| Fully meshed | 81 | 173,875 | 39 closed and oriented; 39 have boundary edges only; ODIN-W160, ODIN-W161 and M2_JODY-W5 and W6 CARD have no boundary edge but are non-manifold and misoriented |
| Partly meshed | 7 | 18,529 of 18,582 | CEL/LENA-R8, POS/ANN-MB2, SHO/ANNA-B4, SHO/c211_case_with_odin_v1, SHO/ELLA-W1, SHO/NINA-B222-W1x2, SHO/ODIN-W260 |
| Over 120 s | 0 | | 2026-10-21: NINA-B222-W1x2; it now finishes in 0.6 s warm |
| Exception | 0 | | No face or edge threw; no `NotImplementedException` |

Against 2026-10-21: all 14 files fully meshed then are fully meshed now, and 67 of the 73 partly meshed then are fully
meshed now. Closed meshes: 39 now against 16 then; 27 files closed for the first time, 12 closed in both runs, 4
closed then and not now (see Failures, kind 3).

Elements over the 88 files: 431,854 vertices, 337,589 triangles and 210,335 quads (758,259 triangles once the
contract's `ToTriangleMesh3D` splits the quads; 2026-10-21: 897,004 over 87 files). Edges: 477,638, none threw. By
curve kind: line 385,171, circle 29,173, ellipse 100 and B-spline 40,378 (15,915 on 2026-10-21), all discretized;
surface curve 22,816 (20,684 in ELLA-W1, 2,132 in NINA-B222-W1x2), of which 22,800 discretized and 16 came back with
no segments. Bounds and units: not measured by this harness.

Warm time by stage over the 88 files: parse 3.4 s, decode 24.6 s, prepare 6.2 s, tables 1.2 s, edges 33.7 s, faces
57.0 s, refinement loop 8.0 s, assembly 2.3 s; 136.4 s in all, median 0.9 s per file (2026-10-21: 3.0 s). Over the
same 87 files as 2026-10-21: parse 6.0 to 3.4 s, decode 50.0 to 24.4 s, prepare 86.9 to 6.2 s, edges 132.5 to 33.5 s,
faces 100.5 to 56.9 s.

Prepare is the change J3 aimed at (Reduced and ChangedSensePositions built their empty arrays quadratically). Its
14-fold drop is well beyond the 1.8-fold load difference parsing shows. The three files with the slowest prepare on
2026-10-21 now take ELLA-W1 9.9 s to 0.16 s, RCB-F9T(AP214) 9.6 s to 0.18 s, JODY-W3 8.6 s to 0.12 s; the slowest
prepare now is SHO/ANNA-B4.step at 0.24 s (0.06 s on 2026-10-21). The edges stage on 2026-10-21 included 45,123 edges
that threw the stub quickly, so its fall is not a like-for-like speed-up.

Slowest files, warm: SHO/c211_case_with_odin_v1.step 11.9 s (refinement loop 6.3 s, edges 3.7 s; 15.0 s on
2026-10-21), POS/M2-ZED-F9T-20B-00.STEP 8.2 s (faces 4.8 s), POS/RCB-F9T(AP214).STEP 6.1 s (22.8 s), POS/M2-ZED-
F9T-25B-00.STEP 5.0 s, POS/ZED_PCB_TABS.STEP 4.7 s. Slowest by process time (two meshings, the contract check and
start-up): the two M2-ZED-F9T files at 42 s each, then RCB-F9T(AP214) at 30 s.

## Per surface kind

Faces of the 88 files by the surface the decoder gave them, from `python -I scripts/step-corpus-table.py <out>`. "Edge
not discretized" is a face one of whose edges came back with no segments. "Other unmeshed" is a face the refinement
loop remeshed (branch `refined`) that ended with no element. The script rounds the share to one decimal: plane is
99.99%, all is 99.97%.

| Surface | Faces | Meshed | Edge not discretized | Stubbed | Threw | Not simple | Other unmeshed | Share meshed |
|---|---|---|---|---|---|---|---|---|
| plane | 160,017 | 159,996 | 12 | 0 | 0 | 8 | 1 | 100.0% |
| B-spline | 15,580 | 15,567 | 0 | 0 | 0 | 4 | 9 | 99.9% |
| cylinder | 13,647 | 13,630 | 12 | 0 | 0 | 3 | 2 | 99.9% |
| sphere | 1,347 | 1,347 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| torus | 1,222 | 1,220 | 2 | 0 | 0 | 0 | 0 | 99.8% |
| cone | 367 | 367 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| surface of linear extrusion | 261 | 261 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| surface of revolution | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| **all** | **192,457** | **192,404** | **26** | **0** | **0** | **15** | **12** | **100.0%** |

Against 2026-10-21: B-spline faces 41.9% to 99.9%, surfaces of linear extrusion 11.1% to 100%, cones 67.6% to 100%,
spheres 97.4% to 100%. The 30 three-edge sphere, cone and cylinder faces that threw (TKT-411) all mesh (F3 and F3b).
Faces by branch: grid 166,761, constrained triangulation 25,551, refined 104 (92 of them meshed), not simple 15,
undiscretized 26.

## Failures by kind

### 1. Boundary edges on fully meshed files

| Files | Boundary edges | Ticket |
|---|---|---|
| 39 fully meshed files | 32,983 | being classified by the v1-edges track; no ticket yet |

The largest: SHO/M2-JODY-W377-00C_PCIE-UART.step and SHO/M2-JODY-W377-01C_SDIO-UART.step 6,544 each,
SHO/JODY-W1-W2.STEP 4,620, SHO/THEO-P173.STEP 3,897, SHO/JODY-W3.STEP 3,128, SHO/MAYA-W260_REVC.step 2,712,
SHO/MAYA-W261_W271_REVC.step and SHO/MAYA-W266_W276_REVC.step 1,284 each, POS/RCB-F9T(AP214).STEP 416,
CEL/TOBY-L4.STEP 378; the other 29 files have 13 to 195. Each of these files has every face meshed, no non-manifold
and no misoriented edge, so each boundary edge is cited by one meshed face only. Whether that is an open shell in the
file (a surface model) or a mesher defect (two faces whose shared edge is discretized differently) is what the
v1-edges track is classifying; this report does not guess. One earlier result, on the 2026-10-21 library: the v1-edges
track found every boundary edge left in the three MAYA REVC files lies on a B-rep edge that only one face cites
(`sandbox/step-mesh-staging/v1-edges/TRACK.md`).

Seven fully meshed files have more boundary edges than on 2026-10-21 although more of their faces mesh: the two M2-JODY-W377 files
(3,916 to 6,544), THEO-P173 (2,714 to 3,897), JODY-W1-W2 (3,894 to 4,620), MAYA-W260_REVC (2,385 to 2,712) and the
other two MAYA REVC files (1,118 to 1,284). Newly meshed faces add their own unmatched edges, so a rise does not by
itself show a defect. The two M2-JODY-W377 files are the ones J1 and J2 (TKT-431, TKT-453) changed: before the merge,
the track's staged check left no face of either undiscretized; TKT-453 is still open with both criteria ticked.

### 2. Faces not meshed

| Files | Faces | Ticket |
|---|---|---|
| SHO/NINA-B222-W1x2.STEP | 26 with an edge not discretized (12 plane, 12 cylinder, 2 torus); 3 remeshed to nothing (faces 596 plane, 601 and 677 cylinder) | **TKT-414** |
| 6 (LENA-R8, ANN-MB2, ANNA-B4, c211_case_with_odin_v1, ELLA-W1, ODIN-W260) | 15 not simple: 8 plane, 4 B-spline, 3 cylinder | **TKT-412** |
| SHO/c211_case_with_odin_v1.step | 9 B-spline faces remeshed to nothing (32, 45, 82, 92, 94, 259, 260, 262, 263) | none |

NINA-B222-W1x2 (TKT-414) no longer hangs: E2 gave its four slow surface-curve edges (rows 680, 683, 1502 and 1513 of
the edge table, each on a cylinder and a plane) their arcs' ranges, and they now discretize into 4 segments in 1.3 to
2.7 ms. Sixteen other surface-curve edges of the file (rows 600, 1234, 1239, 1262, 1264, 1365, 1368, 1427, 1498, 1500,
1507 to 1510, 1518, 1530; 14 on a cylinder and a plane, 2 on a plane and a torus) return in under 0.5 ms with no
segments, no exception and no message, and the 26 faces that cite them are unmeshed (`undiscretized`). The ticket's
second criterion (no file over 120 s) holds; its first asks for a located diagnostic on each edge that does not
discretize, which these 16 do not have.

Not simple (TKT-412, `FACE-NOT-SIMPLE`): CEL/LENA-R8.STEP face 258 (plane, 126 loops, 1,017 edges); POS/ANN-MB2.step
faces 349, 946, 1035 and 1654 (B-spline, one loop of 3 edges each); SHO/ANNA-B4.step face 491 (plane, 2 edges);
SHO/c211_case_with_odin_v1.step faces 81, 84 and 88 (cylinder, 10, 6 and 6 edges); SHO/ELLA-W1.STEP faces 304 and 305
(plane, 304 edges each); SHO/ODIN-W260.STEP faces 2613, 2615, 2616 and 2625 (plane, 5, 6, 6 and 2 edges). The 45 of
2026-10-21 included 27 twelve-edge planes in the three MAYA REVC files; none of those files has a not-simple face
now (V1G-6, merged on 2026-10-22, meshes pinched plane loops as keyholes). ANN-MB2's four B-spline faces are suspected regressions: v1-proof's scratch check of P6 on library
`4bc98ded` meshed all 2,088 faces of ANN-MB2, closed (`sandbox/step-mesh-staging/v1-proof/TRACK.md`), and
bim-open-data `b2cfaf3` records that the change to 2,084 comes with the regeneration `66577fc`, not with the host.

### 3. Non-manifold and misoriented edges: closed on 2026-10-21, not now

| File | Non-manifold | Misoriented | 2026-10-21 | Ticket |
|---|---|---|---|---|
| SHO/ODIN-W160.STEP | 8 | 16 | full, closed | being bisected, v1-gate chunk V1G-14 |
| SHO/ODIN-W161.STEP | 8 | 16 | full, closed | V1G-14 |
| SHO/M2_JODY-W5 and W6 CARD.STEP | 108 | 216 | 1,463 of 1,467 faces, closed | V1G-14 |
| SHO/ELLA-W1.STEP | 2 | 4 | 0 of 7,754 faces (an empty mesh counts as closed) | V1G-14 |

Every face of the first three is meshed and none has a boundary edge, so these are faces that disagree on a shared
edge. ELLA-W1 meshes 7,752 of its 7,754 faces and has 608 boundary edges besides. bim-open-data `b2cfaf3` records that
ODIN-W160's change comes with the regeneration `66577fc`, not with the host. The four MAYA files of TKT-413 that had
non-manifold edges on 2026-10-21 have none now (E1).

### 4. Contract check

| Files | Faces | Ticket |
|---|---|---|
| 16 | 2 over the chordal bound, 10 with flipped elements, 9 with degenerate elements, 0 unexplained | TKT-455 (the measure), TKT-456 (refinement checked only here) |

The harness checks the version 1 contract on every face from the face meshes and the surfaces alone (TKT-432);
`<prefix>.contract.csv` lists the faces that break it. 72 files hold, 16 break:

- Over the chordal bound: POS/RCB-F9T(AP214).STEP face 874 (plane, 646 elements, deviation 8.53 against a bound of
  1.00, the run's worst excess at 7.53) and SHO/c211_case_with_odin_v1.step face 339 (cylinder, 19 elements, 1.32
  against 1.01).
- Flipped elements: POS/ANN-MB2.step face 1466 (cone, 2 elements), POS/NEO.STEP face 680 (plane, 1), POS/PAM.STEP face
  1406 (plane, 4), SHO/M2_JODY-W5 and W6 CARD.STEP faces 322, 444 and 584 (B-spline, 8 each, corner gap 0.50),
  SHO/NINA-B222-W1x2.STEP face 678 (cylinder, 1, corner gap 0.55), and SHO/NORA-B100, NORA-B101 and NORA-B106 faces
  2745, 2651 and 2777 (plane, 2 each).
- Degenerate elements: CEL/SARA.STEP face 461, CEL/SARA-G3xx-02.STEP and CEL/SARA-N2.STEP face 2765, CEL/SARA-R4-N4.STEP
  face 2748 (plane, 1 each), CEL/SARA-R5xx.STEP face 2458 (plane, 5), POS/M2-ZED-F9T-20B-00.STEP face 4676 (plane, 2),
  and the three NORA faces above (1 each).

TKT-455 is the open ticket on the check's chordal measure (its harness half, `66f0da1`, is in this run). TKT-456 notes
that the live refinement passes have no agreement law, so this check is their only test end to end. TKT-457 (a law
whose name covers two claims) does not bear on these numbers.

### Kinds not found

No file over 120 s; no exception in any edge or face; no `NotImplementedException` and no stubbed body reached (the
regeneration has 0 degraded bodies); no three-edge sphere, cone or cylinder face throws (TKT-411's 30 all mesh); no
non-manifold edge in the four MAYA files of TKT-413.

## Per-file results

`docs/plans/step-mesher-corpus-2026-10-22.csv`, one row per file, with the 2026-10-21 columns except as noted: status
and outcome (full, partial), process time (two meshings and the contract check) and warm time by stage, with a new
`refine_ms` (the refinement loop, which the warm total includes); faces, faces meshed, faces the harness counts as
failed (`faces_threw`, the 26 undiscretized faces of NINA-B222-W1x2), edges and edges that threw; the assembled mesh's
vertices, triangles, quads and digest; closed and oriented with the boundary, non-manifold and misoriented edge
counts; the contract verdict (`contract`, holds or broken) and its counts (`over_chordal`, `flipped`, `degenerate`,
`unexplained`, each a count of faces, and `worst_excess`, the largest deviation minus its bound, negative when every
face is within it); the last stage line; `cause`, the unmeshed faces by kind; and the 2026-10-21 values
(`previous_outcome`, `previous_process_ms`, `previous_faces_meshed`, `previous_closed`, `previous_boundary_edges`) in
place of the October columns.

## How to rerun

With the toolkit's `deps/bim-open-data` at `b2cfaf3`:

1. `dotnet build deps/bim-open-data/tools/step-corpus-harness -c Release --artifacts-path <out>` (regenerate the
   library first with `deps/bim-open-data/tools/regen-step-brep.ps1` if the Plato library moved).
2. `<out>/bin/StepCorpusHarness/release/step-corpus-harness.exe all <corpus> <outdir> 120 --path host --parallel
   --warmup`: `all.csv`, and per file the edge, face and contract tables and the summary.
3. `python -I scripts/step-corpus-table.py <outdir>` prints the per-surface table and the run times. The totals,
   stage times, comparison with 2026-10-21 and the per-file CSV came from a script over the same folder that was not
   committed; every column it needs is in the harness's output.

A rerun for one file: `step-corpus-harness time <file> <prefix> --path host --parallel --warmup`.
