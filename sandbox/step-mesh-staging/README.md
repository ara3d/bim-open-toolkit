# Staging folders for the STEP mesher tracks

Each track of `docs/plans/step-mesher-v2.md` owns one folder here and works only in it until the
supervisor merges it into `sandbox/step-brep-mesh`. The folder sits outside the library on
purpose: the library compiles as one program, so a track that does not parse or type-check breaks
only its own runs, not every other track's.

## Rules

1. **New files only.** A track never edits a file under `sandbox/step-brep-mesh`. It adds `.plato`
   files here: bodies, laws and witnesses for its part.
2. **Names that do not collide.**
   - A body for a function the library declares without one is written as `<Name>Body` with the
     same parameters, for example `ExpandedPolesBody(m, f, loops, c)`. At merge the supervisor
     gives the library's `ExpandedPoles` the body `=> ExpandedPolesBody(m, f, loops, c)`, or moves
     the body in.
   - A replacement for a function that already has a body gets a new name, for example
     `TriangulateRegionCdt`. At merge the supervisor points the old function at it.
   - New laws are named `Law_<Track>_<What>` until merge, so two tracks never declare the same law.
3. **Contracts are frozen during a wave.** The types and signatures in the library do not change
   while tracks run. A track that needs a new type, field or signature writes it under
   "Contract requests" in its `TRACK.md`; additive ones may be applied by the supervisor at once.
4. **Checks.** `python -I sandbox/step-brep-mesh/tools/plato_laws.py "<laws>" --staging
   sandbox/step-mesh-staging/<track>`: the library plus this folder, under the `cpu64` profile
   (64-bit Number, since TKT-315 merged on 2026-10-19; `--profile gpu32` still runs 32-bit floats). Fallback: the pinned CLI in the plan with the staging
   folder as an extra root.
5. **Status in the file, not in messages.** Each track keeps `TRACK.md` current (template below)
   and commits it with its work. The supervisor reads every `TRACK.md` at merge time. Send a
   message only when blocked.
6. **Commits by path**, only the track's own folder and ticket, with the `Ticket:` and `Agent:`
   trailers, pushed after each commit.

## TRACK.md template

```
# <track>: <one-line goal>

Ticket: TKT-n
Status: working | ready to merge | blocked: <on what>

## Done
- <commit>: <laws that now pass, verdicts before and after>

## Merge instructions
- <library function> => <staging function>   (one line per wiring edit the supervisor makes)

## Contract requests
- <type, field or signature needed, and why>

## Requests to other tracks
- <track>: <what is needed, and whether it blocks>

## Findings
- <defects or design facts found, for reviews/FINDINGS.md>

## Durations
| Step | Wall time | Runs |
|---|---|---|
| <step> | <minutes> | <law runs or builds> |

## Lessons
- <what slowed this track, what would have avoided it>
```
