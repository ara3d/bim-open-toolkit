# Test data

Fixtures (the IFC Test Kit: `duplex.ifc`, ground-truth and analytics CSVs, the
large perf model) are **not committed** to this repository — `.gitignore`
excludes everything in `data/` except this README and the fetch script.

To populate locally:

```powershell
./data/get-test-data.ps1
```

The script runs bim-open-data's copy of the fetch logic
(`deps/bim-open-data/data/get-test-data.ps1`, so run `node deps.mjs` first) with
this folder as the destination. The toolkit's own tests that read `data/` are
the View3d workflow tests and the IFC Ask tests; the data libraries' tests now
live in bim-open-data, which keeps its own `data/`.

It copies from a sibling clone of `nrc-ifc-llm` (`../nrc-ifc-llm/IFC-Test-Kit`),
which remains the canonical NRC deliverable copy, and the sample models from
`../studio/ara3d-sdk/data`. Both defaults are relative to the repository root,
so from a git worktree (for example `.claude/worktrees/<name>`) pass them
explicitly:

```powershell
./data/get-test-data.ps1 -TestKit C:/Users/<you>/git/nrc-ifc-llm/IFC-Test-Kit -SdkData C:/Users/<you>/git/studio/ara3d-sdk/data
```
