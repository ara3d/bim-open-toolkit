# Test data

Fixtures (the IFC Test Kit: `duplex.ifc`, ground-truth and analytics CSVs, the
large perf model) are **not committed** to this repository — `.gitignore`
excludes everything in `data/` except this README and the fetch script.

To populate locally:

```powershell
./data/get-test-data.ps1
```

The script runs bim-open-data's copy of the fetch logic
(`deps/bim-open-data/data/get-test-data.ps1`, so run `node deps.mjs` first) with
this folder as the destination. The toolkit's own tests that read `data/` are
the View3d workflow tests and the IFC Ask tests; the data libraries' tests now
live in bim-open-data, which keeps its own `data/`.

It copies from a sibling clone of `nrc-ifc-llm` (`../nrc-ifc-llm/IFC-Test-Kit`),
which remains the canonical NRC deliverable copy, and the sample models from
`../studio/ara3d-sdk/data`. Both defaults are relative to the repository root,
so from a git worktree (for example `.claude/worktrees/<name>`) pass them
explicitly:

```powershell
./data/get-test-data.ps1 -TestKit C:/Users/<you>/git/nrc-ifc-llm/IFC-Test-Kit -SdkData C:/Users/<you>/git/studio/ara3d-sdk/data
```

## STEP samples

`scripts/fetch-step-samples.ps1` downloads the public STEP test files that
`sandbox/step-brep-mesh/03-step/README.md` lists under "Test files" into
`data/step-samples/` (about 170 MB, 58 STEP files plus the NIST zip), and writes
`data/step-samples/SOURCES.md` with each file's URL and SHA-256. The owner approved
the download on 2026-10-21 (TKT-313). The files are for local tests only: none is
committed or redistributed, whatever its terms allow.

| Folder | Source | Licence or terms (as read on 2026-10-22) |
|---|---|---|
| `steptools-ap203/`, `steptools-ap214/` | STEP Tools sample data files, <https://www.steptools.com/docs/stpfiles/> (block, moon_buggy_asm, as1_pe, turbine, bull, clip, cubcylso; as1-ec-214, io1-tc-214, as1-ug-214) | No licence stated. The pages offer the files as samples for testing STEP applications; the site footer reads "Copyright STEP Tools Inc. All Rights Reserved." Several came from the NIST DPPA repository or STEP Tools customers. Treat as test use only. |
| `occt/` | OpenCascade `data/step` (`screw.step`, `linkrods.step`), commit 53706f78 of <https://github.com/Open-Cascade-SAS/OCCT> | The repository's licence: LGPL 2.1 with the Open CASCADE exception. |
| `nist/` | NIST MBE PMI test cases, <https://www.nist.gov/document/nist-pmi-step-files> (the zip: CTC 1 to 5, FTC 6 to 11, STC 6 to 10 as AP203 and AP242) | NIST's page: "The test cases, CAD models, and STEP files can be used without any restrictions." |
| `nasa/` | `rassor_shrinkwrap.stp` from NASA 3D Resources, <https://github.com/nasa/NASA-3D-Resources>, commit 463f2b29 (removed from master afterwards) | The repository's README: "free and without copyright", subject to NASA's media usage guidelines (no implied endorsement, no use of NASA insignia). |
| `u-blox/` | Twelve files of the u-blox 3D-Step-Models-Library, <https://github.com/u-blox/3D-Step-Models-Library>, commit f3c136d2 (the corpus runs' commit) | "Copyright (C) u-blox. u-blox reserves all rights in this deliverable"; no licence file. The library is published for customers' CAD use. Test use only. |
