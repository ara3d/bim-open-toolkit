# Track M checkpoint — model contracts

State: working (chunk 1 verified)
Contract revision in force: P0 (the text of `docs/plans/visualization/V2-PLAN.md`). Acknowledged.
Proposed revision: M1 (this package). Chunk 1 published `M1-stub`.

Fence: `viewer/packages/model/**` except `package.json`, `tsconfig.json`, `tsconfig.build.json`,
`vitest.config.ts` (supervisor-owned).

Nested sub-agents spawned so far: 0.

## Chunk plan

| # | Concern | Files | State |
|---|---|---|---|
| 1 | Stub types Track S needs: result, math, identity, coordinates, objects, style appearance, table, mesh, facts | `src/{result,math,identity,coordinates,objects,style,table,mesh,facts}.ts` | verified, committed |
| 2 | schema combinators | `src/schema.ts` | not started |
| 3 | object sets | `src/sets.ts` | not started |
| 4 | style rules, precedence, composition | `src/style.ts` | not started |
| 5 | edit layers and history | `src/edits.ts` | not started |
| 6 | view state and saved views | `src/view.ts` | not started |
| 7 | state slices and scene document | `src/slices.ts` | not started |
| 8 | table operations | `src/table.ts` | not started |
| 9 | facts operations | `src/facts.ts` | not started |
| 10 | feature, command, event, session | `src/{feature,command,event}.ts` | not started |
| 11 | `docs/CONTRACTS-M1.md`, `README.md` | docs | not started |

## Chunk 1 — `M1-stub` (recovered and verified by the replacement agent)

Delivered: the nine modules above with one `//` contract line per exported declaration, nine test
files, `src/index.ts` re-exporting one level. No runtime dependencies, no `any`, no `as` casts, no
non-null assertions, no compiler or lint directives.

Exported names Track S depends on are stable from this commit:
`Result`/`Diagnostic` and combinators; `Vec3`, `Color`, `Matrix4`, `Bounds` and matrix/bounds helpers;
`ModelRef`, `ObjectRef`, `ModelKey`, `ObjectKey`, `objectKey`, `modelKey`, `parseObjectKey`,
`parseModelKey`; `CoordinateContext`, `LengthUnit`, `UpAxis`, `Registration`, `metresZUpLocal`,
`unknownCoordinates`; `ObjectRecord`, `ModelData`; `Appearance`, `AppearanceChange`,
`defaultAppearance`; `Table`, `Column` and constructors; `Mesh`, `InstanceRecords`, `Geometry`;
`Fact`, `Observation`, `Coverage` and constructors.

Skeleton `test/index.test.ts` was deleted; the nine per-module tests cover every export path.

Commit: `M1-STUB-HASH`

## Commands and results

Run from `viewer/` at chunk 1, 2026-09-07:

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/model/tsconfig.json` | pass, no output |
| `npx eslint packages/model` | pass, no output |
| `npm test -w @bim-open-toolkit/model` | pass, 9 files, 59 tests, 813 ms |

## Blockers

None.

## Requests to the supervisor

None yet.

## Findings

- `viewer/packages/testing/docs/instance-updates.md` (PERF findings) does not exist yet. The instance
  record shape stays columnar typed arrays; re-check before the final chunk.
- The previous Track M agent stalled after writing chunk 1 without verifying it. The written code
  passed all three checks unchanged; only one comment was corrected (`Coverage` said four counts sum
  to `total`, it is three).

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | 1 | ~25 s | 0 so far | none | neutral so far; the strict settings are what make `noUncheckedIndexedAccess` code shapes necessary, so its value shows as absence of casts |
| `eslint` | 1 | ~35 s | 0 | slow relative to what it checks on a nine-file package | neutral |
| escape-hatch scan (grep for `any`, `as`, `!`, directives) | 1 | <1 s | 0 | matches prose comments containing the word "as"; needs a real parser to be precise | neutral, cheap |
| `vitest` | 1 | 0.8 s | 0 | none | helpful, fast |
