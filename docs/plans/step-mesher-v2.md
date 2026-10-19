# STEP mesher in Plato, version 2: independent tracks merged in waves

Status: in progress
Ticket: TKT-323

Written 2026-10-18 by the supervising session, at the owner's request: plan the remaining mesher work so it runs in parallel, keeps each piece of work independent, merges at the end, and does not slow down as more tracks are added; the coordination learns as it goes. Owner decisions the same day: plain 32-bit floats (the `gpu32` profile) until the 64-bit Number profile lands, which gets its own track; no exact predicates; work unattended. It replaces the track table of `docs/plans/step-mesher-parallel.md` (version 1, whose rules and log stay in force where this file does not override them).

## Why version 1 slowed down as work grew

Evidence from 2026-10-18, wave 1 of version 1:

- **One program, one failure for everyone.** The library compiles as one program. One agent's missing semicolon made the shared warm checker report "0 laws, 0 type errors" for every agent until it was fixed (TKT-337).
- **Shared files between fences.** Of the cross-fence requests the supervisor routed by hand, at least eight came from functions or laws that two tracks both needed: `CopiesInside`, `ClosestParameter`, two witnesses, two layer 7 check files, the derivative tolerance, the cone's area sign.
- **One mailbox.** Every request went through one supervisor session, which hit the app's limit of ten messages between sessions once and had to wait for the owner.
- **Ordered steps.** Steps C and F waited on each other only because the build order said so, not because the code did.

## Design

1. **A staging folder per track.** Each track works only in `sandbox/step-mesh-staging/<track>/`, outside the library tree, adding new files. Its checks compile the library plus its own folder, so a broken track breaks only itself. Rules and naming: `sandbox/step-mesh-staging/README.md`.
2. **Merge by wiring, not by splicing.** A body for a declared function is staged as `<Name>Body`; a replacement gets a new name. At merge the supervisor moves the files into the layer they belong to and makes the one-line wiring edits each track lists under "Merge instructions" in its `TRACK.md`. No merge splices lines inside a function two tracks both wrote.
3. **Contracts frozen per wave.** Types and signatures in the library change only between waves. Additive contract requests (a new field, a new function signature) may be applied at once, because they cannot break another track.
4. **Status in files, not messages.** Each track keeps `TRACK.md` (status, merge instructions, contract and cross-track requests, findings, durations, lessons). Requests to another track are written there; the supervisor collects them at merge. Messages are only for being blocked.
5. **Floats now, doubles later.** Every check ran under `gpu32` until TKT-315 merged on 2026-10-19; since then the default is `cpu64`. When TKT-315 lands, the supervisor merges it alone, switches the default profile to `cpu64`, and reruns the full sweep; any law whose verdict changes is a finding.
6. **Checks stay warm per track.** `tools/plato_laws.py --staging <folder>` runs on the warm server; TKT-344 makes the server keep one compiled program per folder set, so tracks stop evicting each other.

## Tracks, wave 1

| Track | Ticket | Staging folder | Session | Notes |
|---|---|---|---|---|
| D2: 64-bit Number, last writer fixes | TKT-315 | Plato repository | the TKT-332 session | Owner lifted the pause 2026-10-18; merged alone |
| P: warm cache per program, parse errors | TKT-344, TKT-337 | Plato and studio repositories | the TKT-331 session | Unblocks warm checks for every track |
| C: poles, two seams, the cone's tip | TKT-325 | `poles` | the step B session | `ExpandedPoles`, `CutWholePeriods`, `LimitNormal`, sphere, torus and cone arms |
| F: B-spline faces | TKT-327 | `bspline` | new session | No longer waits on step C |
| T: triangulation quality | TKT-343 | `triangulation` | new session | Constrained Delaunay and refinement by insertion and flips |
| G: holes, voids, cone area sign | TKT-328 | `genus` | the topology session | First commits its verified layer 07 and 08 work directly, the last direct edit |
| E: C# mesher calls Plato | TKT-313 | `deps/bim-open-data` | the STEP parsing session | Cube first; regenerates only from merged states |

Later waves: the 88-file corpus (inside TKT-313), the library hot spots (TKT-335), glTF dumps and instancing (TKT-316), and any track a merge's findings create.

## Merge procedure (supervisor)

1. A track marks `Status: ready to merge` in its `TRACK.md` and commits it.
2. The supervisor moves its files into the right layer folders, renames `Law_<Track>_` laws, makes its wiring edits, and type-checks the whole library.
3. Full sweep under the current profile with `--report` and `--baseline` against the last committed verdict file (`sandbox/step-brep-mesh/reviews/verdicts-<profile>.tsv`). A law that passed and no longer passes stops the merge; the track gets it back with the evidence.
4. Commit the merge, the new verdict file, and the track's findings in `reviews/FINDINGS.md`.
5. Record the track's row in the ledger below.
6. When a merge changes generated C# behaviour, announce it to track E, which regenerates once.

## Learning loop

After each merge the supervisor adds one row per track to the ledger and reviews the rules: a rule that cost time and caught nothing is removed; a failure that a rule would have caught adds one. Each rule change is logged with its evidence.

### Ledger

| Wave | Track | Claim to ready | Law runs | Builds | Regressions at merge | Cross-track requests | Lesson |
|---|---|---|---|---|---|---|---|
| 1 | G (TKT-328) | about 3 h with the layer 07/08 work | not recorded | none | 0 (sweep: 4 laws to pass) | 3 (2 witnesses for B, cone sign) | Torus witnesses run past 900 s per law; a 120 s budget keeps sweeps bounded |
| 1 | T (TKT-343) | about 2 h | not recorded | none | 0 (sweep: 15 new laws pass, 1 open) | 0 | A criterion can be unreachable by construction; the track proved it and asked before relaxing |
| 1 | D2 (TKT-315) | about 2 h | not recorded | private builds | none, merged alone | 0 | Clean-export builds collide on two projects named Ara3D.Utils unless sequential |
| 1 | Term (TKT-346) | about 1.5 h | 7 laws staged | none | 0 (sweep: 9 new laws pass) | 0 | A merge into code changed by earlier merges went through: wiring by definition, not by call site |
| 1 | P (TKT-344) | about 45 min | not recorded | private builds only | 0 | 0 | One warm program per folder set: a one-body edit answers in 4.0 to 4.6 s while another track's program stays warm |

### Rule changes

| Date | Change | Evidence |
|---|---|---|
| 2026-10-18 | Staging folders replace direct edits in shared layers | Version 1 log: shared-file requests and the parse-error outage |
| 2026-10-18 | Status and requests go in `TRACK.md`, not messages | The ten-message limit, hit once |
| 2026-10-18 | Servers and pinned CLIs are built from clean exports of committed Plato, never from the working tree | TKT-315's uncommitted Intrinsics edits sat in the Plato tree when the TKT-344 server was built |
| 2026-10-19 | Clean-export builds of the server use `-m:1`: two projects named Ara3D.Utils (Plato's parser and studio's SDK) collide in one artifacts path when built in parallel | The 951a70ab server build failed with CS2012, then built in 7 s sequentially |
| 2026-10-19 | A background script with several steps chains them with `&&` and stops at the first failure | A failed server build let a later `cp` copy the whole studio export into the pinned server folder (1,118 MB), found and replaced by a clean copy (`navmcp-951a70ab-clean`) |
| 2026-10-18 | Whole-model laws over the torus need `--budget` above 900 s, or wait for step C | The topology track's request ran past the script's 1800 s timeout on the torus witness |

## Log

- 2026-10-18, 23:55: server on 8768 replaced by Plato f2b20722 and studio 60abd7fb (TKT-344), from clean exports, kept in `C:\Users\cdigg\.plato-cli\navmcp-f2b20722-60abd7fb`, default profile `gpu32`, `--law-programs=8`. Checked: a staging folder compiles once (2.7 s on a warm parse cache) and the library's own program stays warm alongside it.
- 2026-10-19: track D2 merged alone. TKT-315 closed (toolkit dc8a784f; Plato 78be1798, 64-bit Integer exact within 2^53, 0 C# errors under cpu64; criterion 2 waived for 7 stdlib laws, stdlib-464). CLI pinned at `C:\Users\cdigg\.plato-cli\951a70ab` and the server on 8768 rebuilt from the same clean export (`navmcp-951a70ab`), default profile now `cpu64`; `plato_laws.py` and the staging rules default to `cpu64`. The topology track's last direct edit landed as 7e709372 (gpu32 and cpu64 verdicts identical: 133 laws, 112 pass, 1 fail fixed in staging, 4 torus budget errors, 10 obligations, 6 skipped). Tracks T (TKT-343) and G (TKT-328) are ready to merge.
- 2026-10-19: baseline sweep under cpu64 on the library at f9c029a9 (pinned CLI 951a70ab, budget 120 s): 709 laws, 471 pass, 24 fail, 5 error, 122 obligation, 87 skipped, 12 min. Committed as `sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv`, the baseline for the wave 1 merges. Server on 8768 now runs from `C:\Users\cdigg\.plato-cli\navmcp-951a70ab-clean`.
- 2026-10-19: tracks G and T merged by a merge agent, one at a time, each checked by a full sweep against the baseline: G in 848b66d6 (475 pass, 22 fail, 5 error, 120 obligation; 4 laws to pass), T in 7d8dae2d (725 laws: 490 pass, 23 fail, 6 error, 119 obligation, 87 skipped; 15 new laws pass, Law_RefinedInteriorMeetsMinAngle open, Law_RefinementNeverCoarsens now exceeds the budget on the torus). No regressions. TRACK.md statuses in 7efe05e3; the verdict file is the new baseline. Track E told to regenerate (layer 08 included, cpu64).
- 2026-10-19: track Term (TKT-346) merged in 91e6b055: 734 laws, 499 pass, 23 fail, 6 error, 119 obligation, 87 skipped; no regressions. Leftovers for a sweep: Law_BoundedAgreesOnConsistentModels is now trivially true and DiscretizeAllBounded duplicates DiscretizeAll (FINDINGS F-56). Track E's regeneration is blocked by TKT-347 (the C# writer drops List-first functions), assigned to the TKT-315 session.
- 2026-10-19: Plato CLI 128cf769 pinned at `C:/Users/cdigg/.plato-cli/128cf769/Plato.CLI.dll` (clean export, 0 build errors, 19 MB). It carries the TKT-347 writer fix (C# methods for functions whose first parameter is List<T>). Smoke test under cpu64: Law_UnitsFactorsAgree and Law_RawUnitCubePreparesToUnitBox both pass. The Parakeet export needed `Ara3D.Logging` rewritten to an absolute path as well as `Ara3D.Utils`.
