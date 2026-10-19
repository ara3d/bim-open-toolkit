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
5. **Floats now, doubles later.** Every check runs under `gpu32`. When TKT-315 lands, the supervisor merges it alone, switches the default profile to `cpu64`, and reruns the full sweep; any law whose verdict changes is a finding.
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
| 1 | P (TKT-344) | about 45 min | not recorded | private builds only | 0 | 0 | One warm program per folder set: a one-body edit answers in 4.0 to 4.6 s while another track's program stays warm |

### Rule changes

| Date | Change | Evidence |
|---|---|---|
| 2026-10-18 | Staging folders replace direct edits in shared layers | Version 1 log: shared-file requests and the parse-error outage |
| 2026-10-18 | Status and requests go in `TRACK.md`, not messages | The ten-message limit, hit once |
| 2026-10-18 | Servers and pinned CLIs are built from clean exports of committed Plato, never from the working tree | TKT-315's uncommitted Intrinsics edits sat in the Plato tree when the TKT-344 server was built |
| 2026-10-18 | Whole-model laws over the torus need `--budget` above 900 s, or wait for step C | The topology track's request ran past the script's 1800 s timeout on the torus witness |

## Log

- 2026-10-18, 23:55: server on 8768 replaced by Plato f2b20722 and studio 60abd7fb (TKT-344), from clean exports, kept in `C:\Users\cdigg\.plato-cli\navmcp-f2b20722-60abd7fb`, default profile `gpu32`, `--law-programs=8`. Checked: a staging folder compiles once (2.7 s on a warm parse cache) and the library's own program stays warm alongside it.
