# STEP mesher in Plato: how the work is split across agents

Status: paused
Ticket: TKT-323

Written 2026-10-18 by the session that filed the epic TKT-323 (the STEP mesher in Plato), at the owner's request: split the remaining work so several agents can work at once with as few errors, builds, and wasted test runs as possible. The library is `sandbox/step-brep-mesh` (Plato source, layers 00 to 09); its build order is `sandbox/step-brep-mesh/TASKS.md`, whose lettered steps A to H each add one harder kind of shape. This file says who works on what, with which files, and how each agent tests.

## What the measurements say

From Plato's `docs/reports/interpreter-turnaround-2026-10-17.md` and one run on 2026-10-18:

- **A law check costs 20 to 35 seconds, and nearly all of it is compiling the program again.** `plato run --laws --filter=<name>` spent 32.5 s compiling 250 files and 0.3 s running the law (2026-10-18, machine shared with other sessions). A warm process that keeps the compiled program would cut this to a few seconds.
- **A full sweep of the 734 laws takes about 14 minutes.** 600 s of the 802 s is ten laws that mesh a whole model (a hollow box, a planted bad face), each stopped by the 60 s budget. Those laws have no verdict today, so steps A and G cannot close.
- **The C# path costs builds and gives no verdict yet.** Generating C# takes about 30 s, and the compiled library (`Ara3D.StepBrep`, 914 files in bim-open-data) builds on top of that. TKT-315 (the 64-bit number profile and the C# writer fixes) is paused by the owner, so backend results are not yet evidence (finding F-50 in `sandbox/step-brep-mesh/reviews/FINDINGS.md`).
- **The interpreter already runs under the 64-bit profile** (`--profile=cpu64`), so steps B, C and F can be developed and checked without TKT-315. Only the final check that the C# backend agrees needs it.
- **Rebuilding Plato under a running process breaks it.** The law runner, the gate (`sandbox/step-brep-mesh/tools/PlatoGate`, which references Plato's source) and the `plato-navigation` server (port 8768, shared by every session) all load Plato's binaries.

## Rules for every agent

1. **No builder builds bim-open-data, the gate, or Plato's default output.** Library builders check types and run laws with the pinned command below; its compile step reports type errors before any law runs. The `plato-navigation` server's `plato_check` does not help here: the server indexes only Plato's stdlib, not this library (found 2026-10-18 by the topology builder). TKT-331's warm tool is to load the library's folders. Agents changing Plato build into a private folder: `dotnet build <project> -c Release --artifacts-path <their scratchpad>/plato-build`.
2. **One pinned Plato CLI for all law runs.** The supervisor copies a built CLI to `C:\Users\cdigg\.plato-cli\<plato commit>\` and announces the path. The current one is `C:\Users\cdigg\.plato-cli\88aa0277\Plato.CLI.dll` (Plato 88aa0277: the acbc9b94 filters, TKT-332's D5 fix and call cache, and TKT-331's lazy writer tables, which take about 9 s off each compile). It takes `--filter=A,B,C`, a comma list of law or class names; `--laws-from=<file>`, one name per line; `--report=<file>`, one verdict line per law; and `--baseline=<file>`, which prints changed verdicts and exits 1 when a passing law stops passing. Run from `C:\Users\cdigg\git\plato`:

   ```
   dotnet C:/Users/cdigg/.plato-cli/88aa0277/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh --laws --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --profile=cpu64 --budget=60 --filter=<law name or class>
   ```

3. **Tests, by stage.**
   - Each edit: the warm law runner on the shared server, through `python -I sandbox/step-brep-mesh/tools/plato_laws.py "Law_A,Law_B"` (or `none` for the type check alone; `--types all` also checks callers in other files). It keeps the compiled program between calls: 0.7 s with no edit, about 5 s after a one-body edit, against 25 s for a cold `plato run`. Sessions started after 18:20 on 2026-10-18 can also call the `plato_laws` tool directly. The pinned command below stays the fallback, and is what the supervisor's sweeps use.
   - Before each commit: the laws the ticket names, by `--filter`. Since Plato 93907bd7 the ten formerly slow whole-model laws are included (78.6 s together).
   - When a step closes: the supervisor runs the full sweep once, compares it with the last committed results, and runs the C# backend once TKT-315 is done.
   - Never: a full sweep or a C# build inside an edit loop.
   - C# regeneration (`deps/bim-open-data/tools/regen-step-brep.ps1 -PlatoCli <pinned CLI>`) runs only from a committed library state, never from a checkout with other agents' uncommitted edits in `sandbox/step-brep-mesh`, and only when the supervisor announces a step close.
4. **Fences.** Each agent edits only its fence and commits by path. Shared files have one owner. `TASKS.md`, `VOCABULARY.md`, `reviews/FINDINGS.md` and this file belong to the supervisor. Builders record their findings and leftovers in their own ticket's log, and the supervisor moves them into FINDINGS.md.
5. **A body needed outside the fence** is reported to the supervisor (SendMessage), never written. The supervisor routes it to the fence's owner or widens a fence while nobody else holds those files.
6. **Laws before bodies, one commit per law group.** Each commit message names the laws it makes pass and the verdicts before and after.
7. **Fresh review at each step's close.** A reviewer that did not write the code reads the step's diff against its contracts and laws (platonic `REVIEWING.md`) before the ticket closes.

## Tracks

Wave 1 starts on 2026-10-18. The fences are disjoint.

| Track | Ticket | Fence | Why now |
|---|---|---|---|
| P1: warm law runs and verdict files | TKT-331 | `../plato/src/Plato.CLI/**`, `../plato/src/Plato.Navigation/**`, `../plato/src/Plato.Navigation.CLI/**`, `../plato/src/Plato.Interpreter/LawRunner.cs`, `../plato/tests/Plato.Interpreter.Tests/LawRunner*`, `../plato/docs/interpreter.md` | Cuts every builder's law check from about 30 s to a few seconds, and gives the supervisor a regression check |
| P2: interpreter speed on whole-model laws, defect D5 | TKT-332 | `../plato/src/Plato.Interpreter/**` except `LawRunner.cs`, `../plato/tests/Plato.Interpreter.Tests/**` except `LawRunner*` | Ten laws have no verdict; steps A and G cannot close without them |
| Topology and validation: close step A, then step G | TKT-314, then TKT-328 | `sandbox/step-brep-mesh/02-topology/**`, `06-mesh/**`, `07-validation/**`, `08-pipeline/**` | The cube's layer 2 laws run quickly today; the whole-box laws follow P2 |
| Step D: `PrepareModel` | TKT-326 | `sandbox/step-brep-mesh/03-step/**` | Unblocks the C# decoder's last check (TKT-312) and every real STEP file |
| Step B: the cylinder | TKT-324 | `sandbox/step-brep-mesh/01-geometry/**`, `04-discretization/**`, `05-face-meshing/**`, `00-foundation/**` | First step on the longest chain, B to C to F to H |

Wave 2, started by the supervisor as wave 1 lands:

- Step C (TKT-325) continues in step B's session, with the same fence and context.
- Step F (TKT-327) after C, in the same session.
- C# wiring (TKT-313) and the decoder's last check (TKT-312), after step D: the STEP parsing session (`STEP file geometry parsing with Ara 3D`), fence in `deps/bim-open-data`. This is the first C# build of the wave.
- Test tooling host shims (TKT-316: glTF and SVG dumps) when step B or C needs pictures to debug a seam or a pole.
- TKT-315 (the C# writer and the 64-bit Integer) only when the owner lifts the pause; until then, backend agreement is not checked.
- Step H (the 88-file corpus, inside TKT-313) last.

## Supervisor duties

- Refresh the pinned CLI when P1 or P2 lands a commit (one build), and tell the running agents the new path.
- After each step's commits, run the full sweep in the background, commit its verdict file (P1's format), and send each regression to the agent whose fence holds it.
- Move each ticket's findings into `reviews/FINDINGS.md`, and update `TASKS.md` when a step's scope changes.
- Start the reviewer for each step's close, and wave 2's tracks when their dependencies land.

## Log

- 2026-10-18: plan written; CLI pinned at Plato 062b8dc7; wave 1 started.
- 2026-10-18: TKT-331's fence widened to studio/labs/PlatoNavigationMcp/LawMcpTools.cs, its Program.cs (one Register line) and README.md, because the server on 8768 is built from the studio repository. Step B asked to move `CopiesInside` from 04-discretization to 00-foundation, so layer 2's `SharesCurveParameter` (TKT-314) can use it without calling layer 4. `plato_check` found not to see the library; rule 1 corrected.
- 2026-10-18: CLI re-pinned at Plato acbc9b94 (TKT-331 steps 1 and 2), built from a clean export so it excludes uncommitted interpreter edits; a comma-filter run over two laws took 23.7 s, all compile.
- 2026-10-18: step D (TKT-326) commit 72d36820: Reduced and ToleranceDiagnostics have bodies; Law_RawUnitCubePreparesToUnitBox and Law_RawTwoCubesPreparesToTwoBodies pass in the interpreter. Wave 2 started: TKT-312 criterion 2 handed to the STEP parsing session (C# regeneration of Ara3D.StepBrep, building only the projects the check needs). Plato 8cbf8894 fixes D5 (TKT-332); the next pin waits for its speed commit so one build carries both.
- 2026-10-18: load. Step D reported law-run compiles of 8 to 11 minutes (23 s on a quiet machine). At the time: 56 idle MSBuild nodes, 22 MCP servers, three builds at once (a Plato build, a Plato.Navigation.CLI build, and a whole BimOpenData.sln build into artifacts/builders from outside this plan) and two Plato interpreter test runs. TKT-331's warm tool removes the per-check compile; until then, builds outside this plan are the main cost.
- 2026-10-18: CLI re-pinned at Plato 93907bd7 (TKT-332: D5 fix 8cbf8894 and call cache). The ten budget-hitting laws finish in 78.6 s together: 6 pass, Law_WitnessIsOracleClean fails (a layer 1 tolerance defect, to step B), Law_ValidationIsIdempotent errors on generated input (to topology), 2 reach the bodiless ExpandedPoles. F-53 and TKT-335 record the library hot spots the cache hides. The STEP parsing session regenerates Ara3D.StepBrep for TKT-312 with the acbc9b94 CLI.
- 2026-10-18, from about 16:00: process starts 6 to 30 times slower (the pin build took 13 min 38 s, against 33 s at 15:30), with CPU at 13 to 17%, 170 ready threads, WmiPrvSE and Defender busy, and Dell.TechHub.Instrumentation.SubAgent among the WMI clients. Agents told to avoid WMI queries. Defender, Dell's agent and the 56 idle MSBuild nodes are the owner's call.
- 2026-10-18: TKT-312 done (68beddf2, bim-open-data 761c2cb): the decoded unit cube and two cubes prepare through compiled Plato, and C# agrees with the interpreter. TKT-313 handed to the STEP parsing session, cube first; the corpus waits for steps B, C and F.
- 2026-10-18, 18:20: TKT-331 landed (Plato 637264f0 lazy writer tables, 38f2031a warm runner; studio b7598e75 plato_laws). CLI re-pinned at Plato 88aa0277 (37 s build and a 25.5 s one-law check: the machine had recovered). The server on 8768 was replaced by a build of studio b7598e75 over Plato 88aa0277, kept in `C:\Users\cdigg\.plato-cli\navmcp-88aa0277-b7598e75` and started with the STEP library as a law folder (command in TKT-331's report; `ensure-server.ps1` does not pass the law flags, so a restart by that script drops them). `sandbox/step-brep-mesh/tools/plato_laws.py` calls it over HTTP for sessions whose tool list predates it: 12 s for the first call, 0.7 s warm.
- 2026-10-18, 18:40: paused by the owner (token budget; other work first). All agents stopped and idle. Left uncommitted in the topology session's fence: its F-54 work for layers 07 and 08 (9 files under `07-validation/` and `08-pipeline/`), not yet verified. On resume: that session verifies and commits it, then fixes the cone's Green-area sign (Oracle_FaceAreaByGreen) and claims TKT-328 (step G); step B's session claims TKT-325 (step C, now claimable); the STEP parsing session continues TKT-313 with the cube; the supervisor runs the first full sweep with `--report` as the baseline and gets TKT-337 (warm runner hides parse errors) fixed. The warm server on 8768 and the pinned CLI at 88aa0277 stay as they are.
