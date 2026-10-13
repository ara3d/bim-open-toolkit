---
id: TKT-291
title: Duplex golden hashes reproduce on another machine
status: done
depends_on: []
owner:
fence: [tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-parameter-completeness.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-room-areas.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bcf-from-ids-failures.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bcf-from-sql.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/check-ids-carbon-psets.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/check-ids-door-width.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bos-to-relations.txt, deps/bim-open-flow/src/flow/BimOpenFlow.Host/SamplePreparation.cs, deps/bim-open-flow/tests/**, src/studio/BimOpenFlow.Studio/NrcPreparation.cs, deps/bim-open-data/src/**]
workflow: [W1]
related: [TKT-153]
confidence: high
created: 2026-10-12
closed: 2026-10-12
kind: defect
---

## Acceptance criteria

- [x] The Duplex entities table hash in the seven goldens (today sha 96afba73d5cb, table 4721 rows x 6 cols) is the one a fresh rebuild of samples/nrc/duplex-enriched.bos and the .duckdb files produces, with the cause of the difference named in the ticket notes (stale owner file, or a converter whose output differs per machine, fixed in bim-open-data)
- [x] SamplePreparation.Job.IsCurrent no longer trusts file times alone: a changed converter (bim-open-data assembly version or content hash) or a changed source IFC rebuilds the derived files, with a test

Reported 2026-10-12 by the Studio 2.5 colleague: seven SampleFlows goldens fail on their machine with the same table shape and a different hash. TKT-153 notes the likely cause: duplex-enriched.bos is git-ignored, built once by NrcPreparation, and IsCurrent compares only file times, so the goldens were approved against whatever the owner's machine held. Changes in deps/bim-open-flow or deps/bim-open-data are committed and pushed there; the supervisor moves the pins in deps.json afterwards.

## Notes

- 2026-10-12, diagnosis: a stale owner file, not a converter that differs per machine. The owner's duplex-enriched.bos (built 2026-10-10 23:26, stamp `ifc-duckdb/1`) reproduces the committed entities sha 96afba73d5cb. A fresh build of the same IFC (sha256 f0d2a05a9f46...) gives entities sha 8dd61d621f11 (and parameters 18551 rows sha 61628ffa56f3 becomes 18553 rows sha 01d959ee5fa2), the same on three separate builds on this machine, so the converter is deterministic here. The two .bos files differ in Descriptors, Entities, Parameters and Strings parquet tables (the other eleven tables are byte-identical). Cause: bim-open-data changed the converter after that build, on 2026-10-11 (f103af0 a type object's own property sets become parameters; ad26d33 area and volume unit scales; ea78043 and others touch geometry only), while the stamp's producer version stayed `ifc-duckdb/1`, so IsCurrent kept the old file and a9c850a7 approved the goldens against it. The colleague's machine built the file fresh, hence 8dd61d621f11 (not verified on that machine; the hash value is what a fresh build gives here).
- The stamp rule the second criterion asks for already exists since bim-open-flow 3a9cd35 (2026-10-04): `<output>.stamp` records the input's SHA-256 and a producer version, and file times are not consulted; SamplePreparationTests covers input change, producer change, missing and stale stamps. The gap was that the producer version is a hand-kept constant nobody bumped. Fix: bim-open-data 54b0c95 bumps `IfcDuckDbBuild.Version` to `ifc-duckdb/2` and adds IfcDuckDbVersionTests, which fingerprints the BOS written for duplex-enriched.ifc (SHA-256 over archive entry names and bytes, not zip timestamps) and fails when the output changes without a bump. A content hash of the converter assembly was rejected: it changes on every build and would rebuild three 30 s files after each compile.
- The seven goldens are re-approved from a clean rebuild (entities sha 8dd61d621f11). The checkout's own samples/nrc derived files cannot be rebuilt while a studio host (port 5214) holds the .duckdb files open; they rebuild on its next start because the producer version changed. Checked in a clean copy of the tracked files at C:\w291 with deps linked: the whole SampleFlows suite passes (702) after the rebuild. The pin of bim-open-data in deps.json must move to 54b0c95 or later before these goldens pass in a clean clone.

## Close gates

2026-10-12, bim-open-flow pin: `node scripts/check-pin.mjs bim-open-flow` in `.` passed.

```
bim-open-flow: pinned at ac694ac, pushed
```
