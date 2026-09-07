# Verification record — 2026-09-06

Validated with .NET SDK 10.0.301 on Windows, targeting .NET 8. No source sample was modified.

- Full categorized run: **35 passed, 0 failed, 0 skipped**. Includes all 15 local sample files,
  the 100,000-entity synthetic workload, and 19 small tests.
- Final Release small run, after adding malformed-manifest handling: **20 passed, 0 failed**.
  This covers **36 distinct passing test cases** across the two runs.
- Platonic probe: immutable record compiled; deliberately mutable class and setter were rejected
  with `PURE001` and `PURE002`. All twelve analyzers are loaded by the production projects.
- New projects compiled without warnings. A clean build of their existing BOS dependency exposes
  its pre-existing CS8632 nullable-context warning; that project was not changed.
- New isolated `BimDataModel.slnx` lists the two production projects and their test project.

Representative latest sample results (conversion, validation and indexing; includes loading):

| Sample | Entities | Properties | Instances | Time | Cumulative managed allocation |
|---|---:|---:|---:|---:|---:|
| Structural advanced | 3,120 | 75,000 | 5,816 | 0.18 s | 80 MiB |
| MEP advanced, legacy layout | 22,356 | 874,197 | 105,774 | 1.91 s | 926 MiB |
| Snowdon architectural | 51,139 | 1,620,524 | 471,462 | 4.18 s | 2,128 MiB |
| Autodesk hospital | 100,353 | 4,567,240 | 1,069,391 | 12.17 s | 5,264 MiB |
| DRBT new hospital | 492,658 | 18,204,541 | 3,097,112 | 45.05 s | 20,346 MiB |
| UHS combined | 78,976 | 3,787,496 | 2,015,556 | 11.59 s | 5,284 MiB |

The 100k synthetic conversion, full graph walks and indexed property queries took 0.68 seconds.
These are observations, not benchmarks or performance guarantees. Allocation is cumulative, not
peak retained memory. The largest model remains a substantial in-memory workload.

After distinguishing `-1` missing values from invalid values, none of the 15 samples reported an
`InvalidPropertyValue` diagnostic. Duplicate property assignments, duplicate local identities,
duplicate relations, source warnings/errors and some invalid relation references remain visible.
The geometry-only sample correctly produced no invented entities and reported 33,235 orphan instances.

Validation scope: synthetic fixtures assert exact semantics and compare spatial results with brute
force. Sample tests assert conversion, reference integrity and query behavior, rather than certifying
every source value's domain meaning. DuckDB and SQLite tests use synthetic values, not full exports
of the largest sample. Exact mesh clashes, out-of-core operation and federation are not implemented
or claimed as validated.

Local evidence (ignored build artifacts):

- `artifacts/bim-data-model/3f85746aabc94e41b326d5dc5694769f/results.trx` — complete 35-case run and per-sample output.
- `artifacts/bim-data-model/small-final.trx` — final 20-case Release run.
- `artifacts/bim-data-model/4ac36647413248fcaf729abfb5399171/analyzer-clean.log` and
  `analyzer-negative.log` — compiler sentinel.

Reproduce with the commands in [README.md](README.md). The source files must be locally available
and `BOS_SAMPLE_DIRECTORY` (or the wrapper's `-SampleDirectory`) must identify their directory.
