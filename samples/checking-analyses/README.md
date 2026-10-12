# Checking sample analyses

Graphs for the `ids.*` and `bcf.*` packs over the NRC Duplex in `samples/nrc`:
IDS (Information Delivery Specification, buildingSMART's machine-readable
requirements) files evaluated to verdicts, and BCF (BIM Collaboration Format,
the issue files Revit, Solibri and BIMcollab exchange) written from those
verdicts and read back. Each file is a canonical graph document whose file
name is the analysis id. `{SAMPLES}` is `samples/nrc`; the host seeds the
graphs with it resolved and builds `duplex-enriched.bos` from the IFC in the
background. The two IDS files live in `samples/nrc/ids`, the committed BCF in
`samples/nrc/bcf`. The `bcf.write` nodes target `{ARTIFACTS}/checking`, which
the seeder resolves to the checkout's git-ignored `artifacts` folder; they write
only after Run (PROJECT.md principle 2).

Every graph that reads the Duplex declares a graph input `model`, held by one
`value.path` node, `modelPath`, so a user runs it on another building by
changing one value; each opens with an `about` note and ends in a node named
`answer`. The 3D scene node `view3d.instances` meshes IFC and cannot read a
`.bos` file, so `check-ids-door-width` also declares `geometry`, the same
building as IFC, and `bcf-read-colour`'s `model` is the IFC.

| Id | Shows | Numbers |
|---|---|---|
| `check-ids-door-width` | rule DC-W1 as an IDS: `bos.load` into `ids.check`, each door named in `answer`, the verdicts counted, charted, and coloured on the model | 14 doors, 8 Pass, 6 Fail, the same as `nrc-dc-w1-verdicts` and as ifctester |
| `check-ids-specifications` | `ids.specifications` listing what each IDS asks, each in a titled table, with no model read | 2 carbon specifications, 1 door specification, all supported |
| `check-ids-carbon-psets` | the NRC carbon property sets as an IDS over the enriched model: a chart of Pass, Fail and InfoNotAvailable per specification, and the failing elements in `answer` | 218 elements per specification; the roof, with no embodied-carbon row, is the one Fail (honest absence) |
| `bcf-from-ids-failures` | `bcf.topics` previews the failing doors as one topic, the file Run writes; `bcf.write` writes the BCF with a viewpoint framing them once Run | 1 topic, 6 elements, 1 viewpoint |
| `bcf-from-sql` | table steps (filter, filter, join, derive, derive, project, sort) over the entity and parameter tables pick the external doors and become one BCF topic | 4 external doors, 1 topic |
| `bcf-read-colour` | `bcf.read` over the committed `dc-w1-failures.bcf` (not the file `bcf-from-ids-failures` writes): its topics port in `answer`, the flagged doors coloured on the model | 1 topic, 6 doors |

Tests: `tests/studio/BimOpenFlow.NrcWorkflows.Tests/CheckingGraphTests.cs`. The
committed BCF is rewritten by its explicit test `RegenerateTheCommittedBcf`.
