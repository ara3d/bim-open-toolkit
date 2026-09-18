# Start-up and test timings (track P)

Measured 2026-09-18 on the development machine, Debug build, host started
from `artifacts/main`, `--models samples/tables`, time from process start
to the "listening at" line. Budget: about two seconds for anything a person
waits on, start-up first of all.

## Host start-up

| Case | Before | After |
|---|---|---|
| tables profile, warm store, generated files present | 0.33 s | 0.35 s |
| bim profile, warm store | 0.34 s | 0.35 s |
| tables profile, empty store (seeds 19 graphs) | 0.35 to 0.62 s | 0.53 s |
| bim profile, empty store, `samples/bim/sample.bos` regenerated | 1.61 s | 1.6 s |
| tables profile, `samples/nrc/duplex-enriched.duckdb` absent | **36.5 s** | **0.53 s** listening; database ready 0.9 s later |
| any profile, first launch after a rebuild (disk cache cold) | 2.7 to 4.4 s | same; not on the code path |

The one offender was the NRC database build inside start-up. It now runs on a
background task after the port opens (`SamplePreparation`, commit ff9f2aa).
While it runs, a `rel.table` over `duplex-enriched` reports "Source
'duplex-enriched' is not ready yet: building duplex-enriched.duckdb from
duplex-enriched.ifc in the background; it appears when done", and when it
lands the host invalidates the relation caches and re-evaluates every open
analysis, so the graph turns green without a reload (checked over HTTP on
`nrc-storey-of-element`: two Error nodes, then seven Ok).

The 36 s figure was a first build of the process's native libraries as much
as the IFC conversion; a second cold build took under a second. Either way
it no longer sits in front of the port.

## Test suites

| Suite | Duration | Note |
|---|---|---|
| `NrcWorkflows.Tests --filter CsvGraphTests` | 1 s (was the IFC build plus 1 s) | fixture builds the database lazily, commit below |
| `NrcWorkflows.Tests` whole | 4 s | includes the one IFC to DuckDB build |
| `TableWorkflows.Tests` | 2 to 21 s | the long runs coincided with other agents' builds on the same disk |
| `BimWorkflows.Tests` | 0.8 to 30 s | same |
| `Host.Tests` | 2 to 8 s | starts a real Kestrel host |

## Still to measure

- Time from opening `3d.html` to the first rendered frame, and any `/api`
  request over one second (track 3D reports these).
- Result paging of a large `rel.materialize` in the table pane.
- Web dev-server cold start (`npx vite`) and the production bundle size.
