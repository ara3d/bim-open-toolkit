# v1-reliability: why defects slip past the specs and laws, and checks that close the gaps

Ticket: TKT-432, TKT-433, TKT-434, TKT-440 (built); TKT-436, TKT-437, TKT-438, TKT-439, TKT-441 (filed)
Status: merged: R4 in 155609e6 (with v1-faces P1, which makes its law pass) | ready: R1, R2, R3, R5, R6 (tools, none into the library)

Report: `docs/plans/step-mesher-reliability-2026-10-22.md` (the defect tables, the classes with counts, the verdict).

Fence: `sandbox/step-brep-mesh/tools/**`, `sandbox/step-brep-mesh/09-tooling/**`, this folder,
`deps/bim-open-data/tools/step-corpus-harness/**`, the report. Not `StepPlatoMesher.cs` (v1-proof), not
`regen-step-brep.ps1` (v1-close), not the Plato repository (v1-compiler). Another session committed
`tools/compile-layers-00-08.sh` (6d5b17fe, 951ad1e2) inside this fence at the same time; no file was shared.

## Chunks

| Id | Ticket | What | Expected | Actual |
|---|---|---|---|---|
| R1 | TKT-432 | the version 1 contract on every face of every file, in the corpus harness | 1.5 h | about 25 min |
| R2 | TKT-433 | a stub check over the generated C# | 30 min | about 10 min |
| R3 | TKT-434 | `plato_laws.py`: skipped laws fail, budget errors rerun alone, coverage table | 1 h | about 15 min |
| R5 | TKT-440 | a lint for guards that do not guard and staged comparisons | 1 h | about 15 min |
| R6 | TKT-434 | the shipped program type-checked before every law run; compile errors read (class J) | 1 h | about 40 min |
| R4 | TKT-439 | a failing corpus face extracted as a Plato witness | 2 h | about 1.5 h |

## Done

- R1, bim-open-data d8bb198: `ContractCheck.cs`. Bump solid at 0.3 breaks it (TKT-415); unit box, cylinder,
  NINA-B400, LENA-R8, MAYA-W160, MAYA-W260_REVC hold; moon_buggy breaks it on 33 faces (14 tori and 2 B-spline grids
  over chordal, F1's finding; 17 cones and spheres with flipped elements, V1G-3's slivers). No type added: a harness
  check in C#.
- R2, toolkit b6992ff4: `tools/check_generated.py`, `tools/generated-stubs.txt` (30 bodiless names at e646e28).
- R3, toolkit f10d2d33: `tools/plato_laws.py`.
- R5, toolkit 920e869a: `tools/law_lint.py`, 22 findings.
- R6, toolkit b7f105ee, 4bc98ded, 7df23804: `tools/shipped-program.txt`, the shipped-program check, the server's
  compile errors read, and the `vacuous` and `differs` verdicts (TKT-437, TKT-438).
- R4, bim-open-data b96cf89: `step-corpus-harness extract` (`ExtractMode.cs`, `SubModel.cs`, `PlatoLiteral.cs`).
  Staged here: `corpus-ann-mb2-face-349.library.plato` (`Witness_AnnMb2Face349`, POS/ANN-MB2.step face 349, ring 0,
  written by the tool) and `corpus-witnesses.laws.plato` (`Law_V1Reliability_AnnMb2Face349IsMeshed`). The law fails
  today with measure 1 (one FACE-ZERO-WIDTH diagnostic): the corpus failure, reproduced in the law runner. It passes
  when v1-faces meshes the face. No type added.

## Merge instructions

R4: move `corpus-ann-mb2-face-349.library.plato` to `08-pipeline/pipeline-corpus-witness-ann-mb2-349.library.plato`
and `corpus-witnesses.laws.plato` to `08-pipeline/pipeline-corpus-witnesses.laws.plato` (the law reads layer 8's
`HostMeshingOptions`), or keep them staged until v1-faces meshes the face, so the sweep does not carry a known fail.
Later corpus witnesses go into the same two files, one library block per witness.

Otherwise none into the library. For the supervisor:
- Move the bim-open-data pin in `deps.json` to d8bb198 or later when it next moves, so a fresh `node deps.mjs` gets
  the harness's contract check.
- After v1-faces F1 and v1-gate V1G-4 merge and the C# is regenerated, rerun
  `step-corpus-harness time data/step-samples/steptools-ap203/moon_buggy_asm.stp <prefix> --parallel`: its 33 failing
  faces should fall to the torus bands of TKT-429, which this check does not see (report, "What was built").

## Contract requests

None.

## Requests to other tracks

- v1-close: run `check_generated.py <generated> --log <log>` at the end of `regen-step-brep.ps1` and stop on its exit
  code (TKT-433's second box); for TKT-441, emit the obligation-only laws of layers 3 and 8 into a law assembly.
- v1-compiler: TKT-437 (premise counts, a `vacuous` verdict) and TKT-438 (`--differential` over every witness).
- supervisor and v1-proof: TKT-436, one definition of the host's meshing criteria in layer 8.
- every track at merge: `python -I sandbox/step-brep-mesh/tools/law_lint.py --staging <folder>`; the 6 staged
  comparisons it lists today are in v1-edges, v1-gate, v1-jody and v1-types.

## Findings

- 40 defects in the mesher since 2026-10-17: a law caught 9, 5 of them in time; the corpus and public samples found
  15. Classes and counts are in the report.
- The harness check misses a grid that lies on its surface but on the wrong side of the face's boundary (TKT-429);
  a per-face boundary-direction test is its next step.
- `plato_laws.py`'s docstring promised an empty-run retry that its code did not have; the retry is now in `run`.
- The warm server answers a repeated request from its cache, so a budget error does not recur on a second call; the
  rerun path was tested with a stubbed call.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Investigation: findings, tickets (subagent), tracks, corpus reports, runner, harness | about 30 min | 0 |
| R1: write, scratch build, witnesses, five files | about 25 min | 4 builds, 6 gallery and 5 file runs |
| R2 | about 10 min | 4 runs (one 2 min before the regex fix) |
| Tickets | about 6 min | 0 |
| R3 | about 15 min | 3 server runs, 1 offline test |
| R5 | about 15 min | 3 runs |
| Report and this file | about 20 min | 0 |

## Lessons

- A scratch `git archive` of bim-open-data HEAD, built with `-p:DepsRoot=<toolkit>/deps/`, keeps another track's
  uncommitted host edits (v1-proof's `StepPlatoMesher.cs`) out of a harness build; the first build took 31 s.
- A Python heredoc with an apostrophe fails in this Bash tool; write scripts with the Write tool.
- Test a regex over generated C# on one large file first: a per-line regex on `Extensions.g.cs` took two minutes, a
  substring test first took it to 0.5 s.
