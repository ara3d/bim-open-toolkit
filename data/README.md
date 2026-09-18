# Test data

Fixtures (the IFC Test Kit: `duplex.ifc`, ground-truth and analytics CSVs, the
large perf model) are **not committed** to this repository — `.gitignore`
excludes everything in `data/` except this README and the fetch script.

To populate locally:

```powershell
./data/get-test-data.ps1
```

This copies from a sibling clone of `nrc-ifc-llm` (`../nrc-ifc-llm/IFC-Test-Kit`),
which remains the canonical NRC deliverable copy, and the sample models from
`../studio/ara3d-sdk/data`. Both defaults are relative to the repository root,
so from a git worktree (for example `.claude/worktrees/<name>`) pass them
explicitly:

```powershell
./data/get-test-data.ps1 -TestKit C:/Users/<you>/git/nrc-ifc-llm/IFC-Test-Kit -SdkData C:/Users/<you>/git/studio/ara3d-sdk/data
```
