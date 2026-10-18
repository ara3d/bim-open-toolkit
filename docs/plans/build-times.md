# Build times

Measured notes for TKT-321 (builder build and test loops take 45 minutes to 3 hours). Each section is one idea from the ticket's brainstorm, with the commands, the numbers, and the decision.

## Solution filters per area (idea 6): measured 2026-10-18, dropped

Question: would a solution filter (`.slnf`) per area make builders' builds and tests faster?

### How builders build today

Builders build and test one test project. The evidence is the `dotnet build` and `dotnet test` commands that agents actually ran in this checkout's session transcripts from 2026-10-14 to 2026-10-18 (scratchpad and Plato commands excluded):

- 148 named a project, for example `dotnet test tests/data/Ara3D.Step.Mesher.Tests --artifacts-path artifacts/builders/tkt305b`
- 10 ran inside a project folder with no argument, which also builds one project
- 17 named a whole solution (`BimOpenToolkit.sln`, `BimOpenFlow.sln`, `Ara3D.DataFlow.slnx`), mostly a supervisor's full check before a pin move or a close

The plans and tickets show the same split: every `dotnet test` quoted in a build log names one project. Only the READMEs (`deps/bim-open-data/README.md`, `deps/bim-open-flow/README.md`) give whole-solution commands, for the release check.

`dotnet build <project>` already compiles only that project and its references. A filter can therefore beat today's command only where someone builds or tests a whole solution (about 1 command in 10), or several test projects one after another.

### The filters tried

A script read the reference graph with `dotnet msbuild <project> -getItem:ProjectReference -p:Ara3DSdkFromSource=true`, so the Ara3D SDK package-to-project rewrite in `Directory.Build.targets` was included as MSBuild applies it. For each area it wrote `BimOpenData.<area>.slnf`: the area's projects and tests, plus every project they reach that `BimOpenData.sln` lists. It also ran a `--check` that failed on a stale filter, a missing referenced project, or a project the solution does not list. The five areas of `deps/bim-open-data`:

| Area | Name patterns | Projects in filter |
|---|---|---|
| step | `Ara3D.Step*`, `Ara3D.StepBrep`, `Ara3D.StepTypes.Tests` | 8 |
| ifc | `Ara3D.Ifc*`, `Ara3D.MeshKernel*`, `Ara3D.DoorClearance.Tests` | 20 |
| bos | `Ara3D.BimOpenSchema*`, `BimOpenData.TestSupport` | 38 |
| mcp | `BimOpenMcp.*` | 18 |
| bcf-ids | `Ara3D.BimOpenSchema.IO.Bcf*`, `Ara3D.Ids*` | 10 |

The filters and the script were removed after the measurement. They exist only in this session's scratchpad, and the method above is enough to rebuild them.

### Measurements

Machine: 22 threads, .NET SDK 10.0.400, `MSBUILDDISABLENODEREUSE=1`, other sessions building at the same time. Each command ran from `deps/bim-open-data` with its own `--artifacts-path artifacts/builders/slnf-<n>` and `-nodeReuse:false`. Cold means the artifacts path was deleted first (the NuGet cache stayed warm). Warm means the same command again with no source change. Tests ran with `--no-build --filter "TestCategory!=RequiresTestData"`, the filter the release check uses. The runs were interleaved (solution, step filter, step project, ifc filter, ifc project, then repeat), three times. Times are wall seconds.

| Command | Cold build | Warm build | Tests |
|---|---|---|---|
| `dotnet build BimOpenData.sln` / `dotnet test BimOpenData.sln` | 49 to 56 | 43 to 57 | 138 to 182 |
| `dotnet build BimOpenData.step.slnf` / `dotnet test BimOpenData.step.slnf` | 18 to 23 | 10 | 11 to 90 |
| `dotnet build tests/data/Ara3D.Step.Mesher.Tests` / `dotnet test` the same | 16 | 9 to 10 | 7 to 10 |
| `dotnet build BimOpenData.ifc.slnf` / `dotnet test BimOpenData.ifc.slnf` | 30 to 31 | 24 to 28 | 24 to 65 |
| `dotnet build tests/data/Ara3D.Ifc.Mesher.Tests` / `dotnet test` the same | 15 to 43 | 8 to 11 | 7 to 24 |

Left out of the ranges, with the reason:

- The first whole-solution run took 2,963 s cold, 1,709 s warm and 1,230 s for tests, between 16:10 and 17:50, with 50 to 70 dotnet processes from other sessions on the machine. The two later runs, at 18:14 and 18:19, are the ones in the table.
- Two cold builds of `Ara3D.Step.Mesher.Tests` took 536 s and 277 s while other sessions were compiling; the third took 16 s. A cold build of the step filter, a superset of that project, took 18 to 23 s at the same times, so scope does not explain the gap; contention does.
- One warm build of the step filter failed (19 s) because another session was regenerating `src/data/Ara3D.StepBrep/Generated` at that minute. One warm build of the STEP project took 83 s because those sources had changed since its cold build.
- Every whole-solution test run has one failure in `Ara3D.BimOpenSchema.DuckDb.Tests`, outside this work.

Contention from other sessions moves a single number by more than 10 times. Comparisons hold only between runs made in the same few minutes.

### Decision: dropped

Filters beat whole-solution commands: their builds are 2 to 5 times faster and their tests 2 to 13 times faster. They lose to the single-project command builders already use 9 times in 10: a filter's build and its tests each take 1 to 3 times as long, because it builds and runs the area's other test projects too. The remaining whole-solution runs are a supervisor's full check before a close or a pin move, where building everything is the point. No filter was kept, so nothing was added to the READMEs, `AGENTS.md`, or the ledger beyond an "off" entry.

### Found on the way: whole-solution builds of BimOpenData.sln never become incremental in the toolkit checkout

`BimOpenData.sln` lists the SDK, schema and Parakeet projects as `deps\ara3d-sdk\...`, which resolves to `deps/bim-open-data/deps/...`, a set of junctions to `bim-open-toolkit/deps/...`. When the repository sits under the toolkit, `deps/bim-open-data/Directory.Build.props` sets `DepsRoot` to the toolkit's `deps/`, so project references reach the same projects through the other path. MSBuild treats the two paths as two projects and builds each into the same `bin/<name>` and `obj/<name>` folders, each build overwriting the other's outputs. The build log shows CS warnings from both `deps\bim-open-data\deps\ara3d-sdk\src\Ara3D.Geometry` and `deps\ara3d-sdk\src\Ara3D.Geometry`. In the table, the solution's warm build (43 to 57 s) is no faster than its cold build (49 to 56 s). A step or ifc filter leaves out the junction-path entries, so it does not have the defect. The fix belongs in the solution or the `DepsRoot` rule, not in a filter. Two options: list the deps in `BimOpenData.sln` by a path that matches `DepsRoot` in both layouts, or have `Directory.Build.props` use the repository's own `deps/` junctions when they exist.

## One builder loop, before and after the two changes: measured 2026-10-18

Question: where does a typical builder loop in bim-open-data spend its time, and how much do the two highest-ranked changes save?

### The loop and how it was measured

`scripts/measure-build-loop.ps1` runs the loop a STEP builder ran in TKT-305 to TKT-310 (the STEP decoder chunks): a cold build of `tests/data/Ara3D.Step.Decode.Tests` into a fresh artifacts path, the same build again with no change, the focused tests (`--filter FullyQualifiedName~WitnessTests`, 4 tests), the full test project (12 tests), and a corpus run: a throwaway Release console program that decodes the 88 u-blox STEP files (`3d-format-shootout/data/submodules/3D-Step-Models-Library`, outside the repository). `-Concurrent 3` starts three cold builds at once, each into its own artifacts path, as three builders do. Each build writes a binlog and MSBuild's performance summary; the script's report lists the top projects, targets and tasks. The same loop was run over `tests/data/Ara3D.Ifc.Tests` for the IFC area.

Machine: 22 threads, .NET SDK 10.0.400, `MSBUILDDISABLENODEREUSE=1`. The machine was never quiet: other sessions ran Plato and studio builds throughout, and the CPU load before a step ranged from 0 to 100 percent (it is in each report). "Quiet" below means the single-builder run; "x3" means three cold builds at once. The full test project fails one test in every run (`CommittedOutputIsCurrent` looks for `BimOpenData.sln` above the artifacts path, which here sat in the session's temp folder); its time is still a real run.

### Before: where the time went (wall seconds)

| Step | Step loop, 1 builder | Step loop, 3 builders | IFC loop, 1 builder |
|---|---|---|---|
| Cold build | 24.7 | 40.0, 43.7, 42.0 | 28.1 |
| No-change build | 7.3 | 14.1 | 20.6 |
| Focused tests | 6.7 | 17.2 | 8.4 |
| Full test project | 3.1 | not run | 26.5 |
| Corpus build (Release) | 23.9 | not run | not run |
| Corpus run (88 files) | 29.1 | not run | not run |

Top costs from the cold build's binlog (step loop, one builder): `Csc` 28.7 s of compiler time over 9 projects, of which the four bim-open-data projects (`Ara3D.Step.Decode`, `Ara3D.Step.Entities`, `Ara3D.StepBrep`, the test project) take most; the five Ara3D SDK projects compiled from source (`Ara3D.IO.StepParser` 7.6 s, `Ara3D.Logging` 5.9 s, `Ara3D.Memory` 3.7 s, `Ara3D.Utils` 3.1 s, `Ara3D.Collections` 1.2 s inclusive); restore and the project-reference walk (`_GenerateRestoreProjectPathWalk`, `_GetProjectReferenceTargetFrameworkProperties`) about 7 s. In the IFC loop 21 projects compile, 6 of them SDK projects (`Ara3D.DataTable`, `Ara3D.PropKit`, `Ara3D.Models`, `Ara3D.Geometry` and others, 10 to 14 s inclusive each), and the reference walk costs 27 s of target time. With three builders the same build takes 40 to 44 s instead of 25: the compile time is unchanged (27.6 s of `Csc`), the waiting is in `ResolveProjectReferences` and the restore walk.

Ranking, by seconds saved per builder chunk:

1. Every chunk pays a cold build (25 to 44 s, and the 277 to 536 s outliers of the solution-filter measurement under contention), because each builder gets a fresh `--artifacts-path`. A per-session artifacts path pays it once per session.
2. Of that cold build, the Ara3D SDK compiled from source is 5 to 6 of 9 to 21 projects. Prebuilt packages at the pin remove them.
3. The corpus build and run (53 s) and the full test project belong to the close of a chunk, not to each edit.
4. Contention: three builders make each cold build 1.7 times slower. Not changed here (the brainstorm's lease and work-in-progress limit, ideas 4 and 5).

### The two changes

1. **Prebuilt Ara3D SDK at the pin (brainstorm ideas 2 and 17).** `scripts/pack-ara3d-sdk.ps1` packs `deps/ara3d-sdk` at the commit `deps.json` pins into `deps/ara3d-sdk-packages/<commit>/` (git-ignored, 31 packages, version `1.6.2-pin98a90590`); it refuses a dirty or unpinned SDK tree and does nothing when the feed exists. `Directory.Build.targets` in the toolkit and in `deps/bim-open-data` keep each Ara3D package reference whose id is in that feed as a package at the pinned version; every other id still becomes a project reference as before. Without the feed (a fresh clone, or a pin move before anyone repacks) builds compile from source as before. `-p:Ara3DSdkFromSource=true` or `ARA3D_SDK_FROM_SOURCE=true` compiles from source on purpose, for a fence that includes `deps/ara3d-sdk`. `deps/bim-open-flow` is outside this ticket's fence and still compiles the SDK from source, so the studio build gains nothing yet; it restores and builds cleanly with the mixed graph, and `node gates/e2e-smoke.mjs` passes without the variable.
2. **A narrow inner loop in one warm artifacts path per session (ideas 7, 11 and 15).** `scripts/inner-loop.ps1 -Project <test project> -Filter <tests>` builds into `artifacts/builders/<session id, 8 characters>`, so the cold build is paid once per session rather than once per chunk, then runs only the focused tests with `--no-build`, and prints `durations: build N s, test-focused N s` for the builder's report. `-Full` runs the whole test project, at the close of a chunk. The corpus and the full gates stay at close.

### After (wall seconds)

| Step | Step loop, 1 builder | Step loop, 3 builders | IFC loop, 1 builder |
|---|---|---|---|
| Cold build | 10.8 | 19.0, 18.4, 18.4 | 10.3 and 10.8 (27.4 at 94 % load) |
| No-change build | 4.4 | 3.8 | 13.9 |
| Focused tests | 26.2 (39 % load; 6.3 in an earlier run) | 13.3 | 4.9 |
| Full test project | 11.6 | not run | 22.5 |
| Corpus build (Release) | 13.4 | not run | not run |
| Corpus run (88 files) | 35.2 | not run | not run |

The cold builds compile no SDK project: the binlogs list only bim-open-data and bim-open-schema projects (IFC: 21 projects before, 15 after). To separate the change from the machine's load, the IFC cold build was also run interleaved, from source (`ARA3D_SDK_FROM_SOURCE=true`) and from the feed, within the same minutes: 27.0 and 18.0 s from source, 10.3 and 10.8 s from the feed. Test and corpus times moved both ways with the load; the changes do not touch them.

The inner loop through `scripts/inner-loop.ps1`, step project: 15.6 s build plus 8.6 s focused tests on the first call in a session, then 6.1 s plus 4.5 s per edit. Before, a chunk began with a 25 s cold build (40 to 44 s with three builders), and builders often ran the full project and the corpus (another 56 s) inside the edit loop.

| Per chunk, step area | Before | After |
|---|---|---|
| Cold build, 1 builder | 24.7 s | 10.8 s |
| Cold build, 3 builders at once | 40 to 44 s | 18 to 19 s |
| Cold build, IFC, interleaved | 18 to 27 s | 10 to 11 s |
| Each later edit (build plus focused tests) | 25 s plus tests (new artifacts path per chunk) | 10.6 s (6.1 plus 4.5) |

### Guidance for builders

- In the inner loop, build and test only the test project your change reaches, with a filter for the tests you are changing: `powershell -File scripts/inner-loop.ps1 -Project <test project> -Filter <filter>`.
- Run the full test project (`-Full`), corpus programs, and whole-solution builds once, at the close of a chunk.
- Keep one artifacts path for the whole session; do not create a new one per chunk.
- Run `scripts/pack-ara3d-sdk.ps1` after `node deps.mjs` moves the SDK pin. Set `ARA3D_SDK_FROM_SOURCE=true` when the fence includes `deps/ara3d-sdk`.
- End every builder report with a duration line per step: builds, focused tests, full tests, corpus, waiting on other sessions.

## Studio cold build with the prebuilt SDK packages (TKT-339): measured 2026-10-18

`deps/bim-open-flow/Directory.Build.targets` now has the same package-feed switch as the toolkit and bim-open-data (TKT-321); `ARA3D_SDK_FROM_SOURCE=true` still compiles the SDK from source. The ticket's fence did not include this file; the section was appended anyway to keep the numbers with the others.

Command, run from the toolkit root, each into a fresh artifacts path with `MSBUILDDISABLENODEREUSE=1` and `-nodeReuse:false`: `dotnet build src/studio/BimOpenFlow.Studio --artifacts-path <scratch> -nologo -v q`. "Before" sets `ARA3D_SDK_FROM_SOURCE=true`, which gives the same project graph as the old targets file.

| Run | Wall seconds | Ara3D SDK projects compiled |
|---|---|---|
| Before (SDK from source) | 44 | 12 (Collections, DataTable, F8, Geometry, IO.BFAST, IO.StepParser, Logging, MCP, Memory, Models, PropKit, Utils) |
| After (SDK from the feed) | 32 | 0 |

One run each, with other sessions building, so the 12 s gap is indicative; the project count is exact (counted from the `obj/` folders of the two artifacts paths).

Found on the way: `node gates/host-smoke.mjs` fails with "host did not start" while a studio process runs from `src/studio/BimOpenFlow.Studio/bin/Debug`, because `dotnet run` cannot overwrite the locked DLLs. Setting `UseArtifactsOutput=true` and `ArtifactsPath=<scratch>` for the gate avoids it.
