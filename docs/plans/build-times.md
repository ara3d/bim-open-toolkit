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
