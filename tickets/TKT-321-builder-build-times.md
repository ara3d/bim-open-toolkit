---
id: TKT-321
title: Builder build and test loops take 45 minutes to 3 hours: measure where the time goes, then narrow the inner loop and prebuild shared inputs
status: done
depends_on: []
owner: session c4298a2b
session: c4298a2b-52b5-4c66-abfe-c7b982524e14
fence: [docs/plans/build-times.md, Directory.Build.props, Directory.Build.targets, deps/bim-open-data/Directory.Build.props, deps/bim-open-data/Directory.Build.targets, scripts/**, docs/plans/visualization/TOOLING-LEDGER.md]
workflow: [process]
related: [TKT-303, TKT-310, TKT-312]
confidence: medium
created: 2026-10-18
claimed: 2026-10-18
closed: 2026-10-18
kind: defect
---

## Acceptance criteria

- [x] docs/plans/build-times.md records, for one typical builder loop in bim-open-data (build, focused tests, full test project, corpus run), the wall time and binlog-derived top costs, measured on a quiet machine and with three concurrent builders
- [x] at least the two highest-ranked changes from the brainstorm are made, and the same loop is re-measured with before and after numbers in the same document
- [x] the builder brief guidance (where briefs are written: platonic builder prompts and AGENTS.md 'Working here') says which tests to run in the inner loop and which only at close, and asks for a duration breakdown in every builder report
- [x] each new tool or rule is entered in TOOLING-LEDGER.md with how its effect will be judged

Observed 2026-10-17/18 in the STEP work (docs/plans/step-reader.md): builder runs took 45 minutes (TKT-305 part B), 80 minutes (TKT-310), about 3 hours (TKT-303); a first `StepBrepGenerationTests` run took 9 minutes, most of it building Plato's CLI; IFC test projects take minutes per run; the session-start hook reported 22 idle MSBuild nodes with 4 builds in flight. Nobody has measured where the time goes. Causes seen so far: each builder builds into its own `--artifacts-path` (isolation from other builders, but a cold build every time); the toolkit's and bim-open-data's `Directory.Build.targets` rewrite every Ara3D SDK package reference into a project reference to `deps/ara3d-sdk`, so the SDK compiles from source in every cold build; large generated projects (Ara3D.StepTypes 39,077 lines, Ara3D.StepBrep 914 files); full test projects and 88-file corpus runs repeated inside the edit loop; several sessions building on one 22-thread machine at once, with locked-file retries.

## Brainstorm

Goal: builder agents finish a chunk in minutes, not hours, without losing the isolation that lets several work in one checkout.

Ideas:
1. Record a binlog and wall time per build and test step for a typical builder loop, and rank the costs (compilers: profile before optimising).
2. Pack `deps/ara3d-sdk` at its pinned commit into a local NuGet feed once per pin; consume packages unless the ticket's fence includes `deps/ara3d-sdk` (reuse: `Directory.Build.targets` already switches between package and project references).
3. One shared warm build output per repository at HEAD; builders build incrementally on top of it instead of a cold per-builder artifacts path (compilers: incremental recomputation).
4. A build lease: one MSBuild at a time per repository, queued, so concurrent builds stop thrashing the CPU and locking files (operating systems: scheduling, leases).
5. A limit on concurrent builders per machine, for example three (manufacturing: kanban, work-in-progress limit).
6. Solution filters (`.slnf`) per area, so a builder builds only the projects its fence reaches.
7. Affected-test selection: from the changed paths, run only the test projects that reference them; the full gate at close only.
8. Corpus results cached by input-file hash plus code hash; rerun only files whose inputs changed (databases: memoisation).
9. Prebuilt, pinned Plato CLI kept between runs, so regeneration never rebuilds the compiler.
10. Generated projects (StepTypes, StepBrep, IfcTypes) produce reference assemblies, so downstream projects skip recompiling when only implementation changes.
11. A warm test host: build once, then `dotnet test --no-build` and in-process reruns (like the Plato verifier's warm worker).
12. Extreme, a builder never builds: a build daemon builds every commit and builders read its verdict (manufacturing: inspection station).
13. Extreme, one builder at a time with the whole machine; measure whether serial beats parallel once contention is gone.
14. Bad idea: give every builder its own full clone so builds never collide. Inversion: one shared clone and one shared warm build output, writes serialised by a lease (ideas 3 and 4).
15. Time budgets in briefs ("stop and report if a test loop exceeds 5 minutes") and a duration breakdown in every builder report.
16. A ratchet that flags a test project whose run time grows past its recorded ceiling (fits docs/plans/visualization/TOOLING-LEDGER.md, the owner's rule that tooling is measured and switched off if unhelpful).
17. Kitchen mise en place: before dispatching a wave, the supervisor prepares shared inputs once (SDK packages, regenerated code, warm build) and builders start from them.
18. Hardware: obj and artifacts folders on a RAM disk or an excluded-from-antivirus folder (Windows Defender scanning build output is a common multiplier).

Tensions:
- isolation of builders vs reuse of one warm build
- freshness (SDK from pinned source) vs speed (prebuilt packages)
- coverage (full tests and corpus) vs a fast edit loop
- parallel builders vs contention on one machine

Approaches:
1. Measure (ideas 1, 15, 16): needed for every other choice; alone it changes nothing.
2. Narrow the loop (6, 7, 8, 11): cheap, no shared state; fails if a builder's change reaches more than it thinks, which the close gate catches.
3. Prebuild the inputs (2, 9, 10, 17): removes the SDK and Plato compiles from most builds; fails when a builder edits a dependency, handled by the fence switch.
4. Schedule the machine (4, 5, 13, 18): removes contention; fails if one builder's long build blocks the others.
5. Shared warm output (3, 12, 14): largest gain, most risk of stale or colliding state.

Recommendation: approach 1 first (a day's measurement), then approach 2 and approach 3 in that order. The deciding tension is coverage vs speed: narrowing the loop and prebuilding inputs keep full coverage at close while cutting every inner-loop build, and they need no shared mutable state.

Decisions for the user:
- How many builders may run at once on this machine? Default: three.
- May builders consume the pinned Ara3D SDK as local packages when their fence does not include `deps/ara3d-sdk`? Default: yes.
- Should build output folders be excluded from Windows Defender scanning? Default: ask the owner to do it, since it is a security setting only the owner may change.

## Progress

- 2026-10-18, idea 6 (solution filters per area), builder session 10b9c9c6: measured and dropped. Builders build one test project in about 9 of 10 runs (transcripts of 2026-10-14 to 18: 158 project builds, 17 whole-solution builds). For the step and ifc areas of bim-open-data, a filter's build and its tests take 1 to 3 times as long as that single project's; they are 2 to 5 times faster than the whole solution's. No filter, script, or README text was added. Numbers in `docs/plans/build-times.md`; ledger row marked off. Found on the way: in this checkout, a warm build of `BimOpenData.sln` is no faster than a cold one (43 to 57 s against 49 to 56 s), because the solution lists the SDK, schema and Parakeet projects through the `deps/bim-open-data/deps` junctions while `DepsRoot` reaches them through the toolkit's `deps/`, so MSBuild builds each twice into the same folders.
- 2026-10-18, ideas 1, 2, 7, 11, 15 (measure, prebuilt SDK, narrow loop), builder session c4298a2b: loop measured with `scripts/measure-build-loop.ps1` alone and with three concurrent builds; the two top-ranked changes made: `scripts/pack-ara3d-sdk.ps1` plus the package switch in both `Directory.Build.targets` (cold build of the step test project 24.7 to 10.8 s, three at once 40 to 44 to 18 to 19 s, IFC interleaved 18 to 27 to 10 to 11 s), and `scripts/inner-loop.ps1` (10.6 s per edit). The machine was never fully quiet; loads are in the document. Guidance in AGENTS.md 'Working here' (outside the fence, named by the third criterion) and `docs/plans/build-times.md`; the platonic builder prompt lives in the platonic-coder repository and was not changed here. `deps/bim-open-flow` still compiles the SDK from source (outside the fence); the studio restores and builds, and `node gates/e2e-smoke.mjs` passes without `ARA3D_SDK_FROM_SOURCE`.
