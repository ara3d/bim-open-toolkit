# Joining the visualization V2 wave

For an agent starting fresh in this checkout while other tracks are running. Read this file, then the files it names, in order. Everything here is current as of 2026-09-08; the status file is the source of truth if they disagree.

## 1. Read, in this order

1. `C:/Users/cdigg/.claude/plugins/cache/platonic/parallel-wave/0.2.0/skills/parallel-wave/SKILL.md` — how tracks share one checkout.
2. `C:/Users/cdigg/.claude/plugins/cache/platonic/platonic-coder/0.2.0/skills/platonic-coder/SKILL.md` — how code is written here.
3. [V2-PLAN.md](V2-PLAN.md) — what is being built and why (packages, waves, acceptance).
4. [V2-STATUS.md](V2-STATUS.md) — what has landed, what is running, what each track measured, open requests between tracks.
5. [README.md](README.md), the decision records at the bottom — BFAST is the default format; model contract M1 is accepted; interact replaces viewer-controls.
6. `viewer/packages/model/docs/CONTRACTS-M1.md` — the contract every package builds on (M1 plus the additive M1.1 and M1.2 sections). Import from `@bim-open-toolkit/model`; never edit it; request additions in your checkpoint.
7. [REVIEW-2026-09-08.md](REVIEW-2026-09-08.md) — an independent review of the work so far; its "waste" findings are rules now: short checkpoints, no fixtures ahead of contracts.
8. [TOOLING-LEDGER.md](TOOLING-LEDGER.md) — what each check costs and catches; the user is deciding which to keep, so your checkpoint reports the same.
9. `AGENTS.md` at the repository root — repository rules on planning documents.

## 2. Claim a track

Open `.claude/wave.json`. Every path a running track owns is listed there; everything not listed is the supervisor's (manifests, lockfile, tsconfigs, `src/index.ts` skeleton exports, plan documents). The alpha packages `core`, `controls`, `loaders`, `visualization` belong to another session and are read-only for everyone.

Tracks that are ready and unclaimed, in value order:

| Track | Fence | What it delivers | Depends on |
|---|---|---|---|
| V viewer composition | `viewer/packages/viewer/**` | `createViewer`, command bus, feature host, slice persistence with migration, multi-view, disposal; a headless `Session` the tests drive | M1 (landed); renderer binding waits for R |
| C MCP bridge | `viewer/packages/mcp/**` | Node bridge exposing viewer commands as MCP tools over a WebSocket, descriptors generated from `describeCommands`, client walkthrough | M1 (landed); the MCP SDK dependency is a supervisor task, ask for it |
| E2E vertical slice | `viewer/packages/demos/src/slice/**` | One page: synthetic building drawn, unrated doors red | R's instance table |
| Gallery wave: V, UG, GAL, D1 to D4 | see [GALLERY-PLAN.md](GALLERY-PLAN.md) section 6 | `createViewer`, the Gratify widget and inspector layer, a new gallery and twenty-one demos | G1 contracts at the gallery wave's chunk 0 |

Tell the supervisor session (or the user) the letter you take so it is added to the manifest and status table. If you must invent a track, name it, name its fence, and add both to your checkpoint's first line.

## 3. Rules that have already bitten someone

- Commit by pathspec only: `git add -- <files>` then `git commit -F <message file> -- <files>`. Never `git add .`, `-A`, `commit -a`, `--amend`, or a piped commit message. An amend without a pathspec re-committed another track's staged files; a piped message held the index lock for four minutes.
- On `index.lock`, wait a few seconds and retry; never delete it unless you have confirmed no git process is running.
- Never push, stash, checkout, reset, rebase, `npm install`, or `npm run build`. Ask.
- Write files with the Write tool, not shell heredocs; backslashes get lost.
- Zero escape hatches in V2 code: no `any`, no `as` casts (`as const` is fine), no non-null `!`, no `@ts-` or eslint-disable comments. The strict tsconfig makes this possible; if you cannot express a shape without one, that is a finding, not a workaround.
- One `//` line above every export stating its contract, only if it says something the signature does not.
- Keep checkpoints under 80 lines. Prose was counted as waste.

## 4. Verify before every commit

From `viewer/`:

```
npx tsc --noEmit -p packages/<name>/tsconfig.json
npx eslint packages/<name>
npm test -w @bim-open-toolkit/<name>
```

Sibling V2 packages resolve to source; the alpha packages resolve from their built `dist`, already built. Do not run `npm run perf` while other tracks compile; benchmark relationships fail under load. The supervisor runs the combined gate (`node ../platonic-ts/node_modules/tsx/dist/cli.mjs tools/platonic-check.mts` from the repository root) at integration.

## 5. Checkpoint

`viewer/packages/<name>/docs/CHECKPOINT-<letter>.md`, written at your first milestone and kept current: state (working, implemented, verified), contract revision built against, files, delivered behavior, remaining work, commands with actual results, chunk commits, blockers, requests to other tracks, findings, and a "Tooling" section: for each check, runs, wall time, real defects caught, false positives or friction, one-line verdict.

## 6. Where things are

- Synthetic data for any test: `viewer/packages/synthetic` (`README.md`; `fixtures.ts` is the catalog of all twelve generators).
- Loading a file: `viewer/packages/formats` (`loadModel`, BFAST default).
- Camera and input: `viewer/packages/interact` (pure reducers, one DOM adapter).
- Measurements that shaped the render design: `viewer/packages/testing/docs/instance-updates.md` and `normalized-bindings.md`.
- Serving a model to a browser: `viewer/packages/demos/docs/fixture-server.md` (`npm run serve:fixtures -w @bim-open-toolkit/demos`).
- Expected results for the ten workflows: `viewer/packages/workflows/test/expected/`.
- Private Snowdon files, never committed: `viewer/packages/visualization/artifacts/bfast/snowdon-bim.bfast` and the BOS under `Documents/BIM Open Schema/`.
