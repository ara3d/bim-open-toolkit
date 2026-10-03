# Repository split

Status: building

Proposal: [repository-layout.md](../proposals/repository-layout.md). The owner approved the direction on 2026-10-03 and asked that the split be completed before any one product is polished, with every step reversible.

## Goal

Split the toolkit into the repositories of the proposal, so that each one builds on its own and the toolkit consumes them, with no repository checked out twice at different commits:

| Repository | Takes | Phase |
|---|---|---|
| `ara3d/bim-open-viewer` | `viz/` | 2 |
| `ara3d/bim-open-data` | `src/data`, `tests/data`, `BimOpenMcp.Ifc`, `apps/`, `tools/Ara3D.IfcTypeGen`, the building-model tools | 4 |
| `ara3d/bim-open-flow` | the generic part of `src/flow` and `tests/flow`, the editor's web packages, `BimOpenFlow.Ask`, `BimOpenMcp.Flow` | 5 |
| `ara3d/bim-open-notebook` | `bimopenflow/web/packages/bim-open-notebook` and its design | 6 |
| `ara3d/bim-open-toolkit` | what remains: the studio host and pages, the BIM node packs, the samples, the gates, the NRC work | 7 |

## How a repository finds its dependencies

Each repository lists its dependencies in `deps.json` and reads them only from its git-ignored `deps/` folder. `node deps.mjs` fills that folder. The same script is copied into every repository, and the workspace checks that the copies are identical (proposal, question Q4).

```json
{
  "gratify": { "url": "https://github.com/ara3d/gratify", "commit": "a2d1723be6039836bf72cd7865b2fad147083092" }
}
```

For each entry, `deps.mjs` does the first of these that applies:

1. `deps/<name>` already exists: it is left alone, and its commit is compared with the pin.
2. The repository's parent folder is a **deps root**, and `../<name>` exists: `deps/<name>` becomes a link to it (a directory junction on Windows, a symlink elsewhere).
3. Otherwise: the repository is cloned into `deps/<name>`, and a local `main` branch is created at the pinned commit.

A **deps root** is a folder holding a `.deps-root` marker file. The script writes the marker into every `deps/` folder it creates. The workspace repository will commit one at its own root.

The script then repeats this for each dependency's own `deps.json`, so a dependency's dependencies land flat in the same `deps/` folder as siblings. Rule 2 then links them. The result is one copy of each repository per checkout. When two pins disagree, the first one wins and the script prints both.

Why a marker, rather than any sibling folder: `~/git/gratify` on the owner's machine is a separate clone at another commit (`f8764ca`, against the toolkit's `a2d1723`). Linking any sibling it found would build against the wrong Gratify without saying so.

`node deps.mjs --check` prints each dependency's mode (linked or cloned), its commit, and whether that matches the pin. Later, the workspace's commit-and-pin command writes the pins.

## Phases

Each phase is its own commit or commits. Each ends with the checks below and lists how to back it out.

**Checks.**
- The full .NET solution builds, and the tests that CI runs pass.
- `node gates/web-smoke.mjs` passes.
- The notebook package's tests and typecheck pass.
- `viz` typecheck passes.
- The studio and 3D pages load in the browser.

**Baseline**, taken on 2026-10-03 before phase 1: see Build log.

0. **Clear the ground.** Done 2026-10-03 (`df2e7e9`, `77a92da`, `bee955d`). The 14 stale ticket claims were released or closed, the IDS skeleton was committed, the meshing data was ignored, and the Parakeet timestamp churn was stashed.
1. **`deps/` on Gratify, inside the toolkit.** Add `deps.mjs`, `deps.json`, and the ignore rule. Point the 10 web configuration files and `viz/package.json` at `deps/gratify` instead of `submodules/gratify`. Remove the Gratify submodule. Make CI run `node deps.mjs`. Run the checks with `deps/gratify` cloned, and again with it linked to a checkout outside the repository, to prove the link case under Vite, tsc, vitest, and npm.
   - Back out: revert the phase's commits, then `git submodule update --init submodules/gratify`.
2. **The viewer.**
   - On `bim-open-viewer`: replace the nested Gratify submodule with `deps.json` and `deps/gratify`, then merge `extraction` into `main`.
   - In the toolkit: delete `viz/`, add `bim-open-viewer` to `deps.json`, and repoint the editor's configuration, 7 scripts, `launch.json`, the gates, and the current documents at `deps/bim-open-viewer`.
   - Back out: revert the toolkit commits. `viz/` returns with its history.
3. **Seams inside the toolkit.**
   - The graph host takes node packs from whoever composes it.
   - The editor takes panes the same way.
   - The BIM composition moves into `BimOpenFlow.Studio`.
   - The layering test is updated.
   - Back out: revert.
4. **`bim-open-data`.** Extract with history, then consume it through `deps/`. Back out: revert. The folders return with their history.
5. **`bim-open-flow`.** As phase 4.
6. **`bim-open-notebook`.** As phase 4, after TKT-86. Write the README with screenshots at this point.
7. **The toolkit as the entry point.** Create the workspace repository, tag the first combination that passes every check, and move `nrc-ifc-llm` to the tag.

## Build log

- 2026-10-03: phase 0 done.
