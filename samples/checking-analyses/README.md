# Checking sample analyses

Graphs for the `ids.*` and `bcf.*` packs over the NRC Duplex in `samples/nrc`:
IDS (Information Delivery Specification, buildingSMART's machine-readable
requirements) files evaluated to verdicts, and BCF (BIM Collaboration Format,
the issue files Revit, Solibri and BIMcollab exchange) written from those
verdicts and read back. Each file is a canonical graph document whose file
name is the analysis id. `{SAMPLES}` is `samples/nrc`; the host seeds the
graphs with it resolved and builds `duplex-enriched.bos` from the IFC in the
background. The two IDS files live in `samples/nrc/ids`, the committed BCF in
`samples/nrc/bcf`. The written BCF files go to `artifacts/checking`, which is
git-ignored, and only after Run (PROJECT.md principle 2).

| Id | Shows | Numbers |
|---|---|---|
| `check-ids-door-width` | rule DC-W1 as an IDS: `bos.load` into `ids.check`, the verdicts counted, charted, and coloured on the model | 14 doors, 8 Pass, 6 Fail, the same as `nrc-dc-w1-verdicts` and as ifctester |
| `check-ids-specifications` | `ids.specifications` listing what each IDS asks, with no model read | 2 carbon specifications, 1 door specification, all supported |
| `check-ids-carbon-psets` | the NRC carbon property sets as an IDS over the enriched model: summary chart and the failing rows | 218 elements per specification; the roof, with no embodied-carbon row, is the one Fail (honest absence) |
| `bcf-from-ids-failures` | `bcf.topics` previews the failing doors as one topic; `bcf.write` writes the BCF with a viewpoint framing them once Run | 1 topic, 6 elements, 1 viewpoint |
| `bcf-from-sql` | a `sql.query` over the entity and parameter tables (external doors) becomes BCF topics | 1 topic |
| `bcf-read-colour` | `bcf.read` over the committed `dc-w1-failures.bcf`, the flagged doors coloured on the model and counted per topic | 6 doors |

Tests: `tests/studio/BimOpenFlow.NrcWorkflows.Tests/CheckingGraphTests.cs`. The
committed BCF is rewritten by its explicit test `RegenerateTheCommittedBcf`.
