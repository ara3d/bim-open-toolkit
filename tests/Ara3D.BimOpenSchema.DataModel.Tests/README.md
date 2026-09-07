# Data model verification

The tests use the production core, Parquet reader, JSON adapter and DuckDB exporter. Synthetic
fixtures provide exact expectations; local samples exercise complete conversion at real scale.
Existing test projects and sample files are unchanged.

| Suite | Coverage |
|---|---|
| CoreTests | Detached entity rows, full property-key identity, duplicate preservation, type inheritance, explicit units, dirty references, graph cycles/direction/path semantics |
| QueryTests | Schedule provenance, numeric/text filters, required-property audit, missing vs invalid vs negative integer, missing source arrays |
| GeometryTests | Quantization, transform order, mirroring, hidden/multiple instances, invalid geometry, indexed vs brute-force searches, inclusive boundary contact |
| SerializationTests | Deterministic JSON round trip and invalid snapshots, typed DuckDB/SQLite exports, transaction rollback, recursive SQL, multiple Parquet row groups, legacy numbers, malformed manifest |
| SampleAndScaleTests | 100k-entity graph/property workload and 15 opt-in local BOS samples including 18.2 million properties and geometry-only data |

Tests have independent feature, size, maturity and source categories; see
[the runner documentation](../../tools/bim-data-model/README.md). No experimental tests are currently
enabled. The default runner executes small synthetic tests. Sample tests explicitly skip when the
directory/file is unavailable; a run with no executed tests fails in the wrapper.

```powershell
./tools/bim-data-model/test.ps1 -Suite Small -VerifyAnalyzers
./tools/bim-data-model/test.ps1 -Feature Geometry
./tools/bim-data-model/test.ps1 -Suite Large
./tools/bim-data-model/test.ps1 -Suite All -SampleDirectory 'C:/Users/cdigg/Documents/BIM Open Schema'
```

Logs and TRX results are written beneath ignored `artifacts/bim-data-model`. Sample output reports
row counts, issue-code counts, elapsed time and cumulative managed allocations. Timing and memory
are observations, not flaky pass/fail thresholds or formal benchmarks. Peak memory is not measured.

The analyzer sentinel separately verifies acceptance of an immutable record and rejection of a
mutable class/setter by actual compiler errors. No production assembly has a blanket purity exemption.

Real sample assertions check that conversion succeeds, references remain valid, and spatial searches
find their own entities. They do not prove the domain semantics of every exported property. Exact
semantics are covered by small fixtures; ambiguous units and duplicate values remain visible for
workflow-specific decisions rather than being declared correct by a smoke test.
