# Test data

Fixtures (the IFC Test Kit: `duplex.ifc`, ground-truth and analytics CSVs, the
large perf model) are **not committed** to this repository — `.gitignore`
excludes everything in `data/` except this README and the fetch script.

To populate locally:

```powershell
./data/get-test-data.ps1
```

This copies from a sibling clone of `nrc-ifc-llm` (`../nrc-ifc-llm/IFC-Test-Kit`),
which remains the canonical NRC deliverable copy.
