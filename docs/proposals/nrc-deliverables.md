# NRC deliverables: what the toolkit still owes the statement of work

> Proposal, 2026-09-27. Sources: the paper repository `nrc-ifc-llm` at
> `cc8d309` (its `statement-of-work.md`, `IFC-Test-Kit/README.md`,
> `paper/condensed-paper.md`, `paper/handoff-needs.md`,
> `paper/poc-gap-report.md`), and this repository's `samples/nrc*`,
> `docs/nodes.md`, and tickets up to TKT-47. Serves workflows W2 (ask about an
> IFC file), W5 (check a rule and hand over evidence), and W6 (reproduce the
> paper). Nothing here is built yet; the owner decides the questions at the end.

## What `nrc-ifc-llm` is

It is a consulting engagement between Studio 2.5 (Ara 3D) and the National
Research Council of Canada (NRC). NRC computes operational carbon, embodied
carbon, and energy use for buildings with tools outside IFC, and wants to know
three things: where those numbers should live relative to an IFC file, how to
show them on the geometry, and how a language model can answer questions about
an enriched model. The repository holds the statement of work, an options
brief, a viewer inventory and test kit, the technical paper (deliverable D3, a
full version and a condensed ten-page version), and a proof of concept under
`poc/` built entirely on this toolkit.

The paper's answer, in one line each:

- **Storage.** Three layers: summary values in custom property sets
  (`Pset_NRCEmbodiedCarbon` and friends) on elements and containers; an
  `IfcDocumentReference` to a long-format Parquet table joined on `GlobalId`;
  and a metric dictionary (`NRC.EC.A1A3.TOTAL`, ...) that both map to. Written
  by byte-exact patch, and expressed as an IDS (Information Delivery
  Specification).
- **Display.** Colour driven by a value table joined on `GlobalId`, unmatched
  elements grey, a property panel for the picked element, and per-storey
  aggregates beside the model.
- **Query.** The model sits behind a small typed read-only MCP tool surface
  over a DuckDB copy of the model; compliance rules are queries with a verdict
  column.

The proof of concept on the buildingSMART Duplex model (38,898 entities)
wrote 664 property sets and 2,438 typed values, answered eight questions (7 of
8 by hand, 4 of 8 unattended with gpt-5), and produced door-clearance verdicts
that matched ground truth. The toolkit already carries 16 `nrc-*` graphs, the
enriched file under `samples/nrc`, a walkthrough that regenerates Figures 2 to
13, and CI that asserts all eight answers by number (TKT-19, TKT-32).

## The constraints, and where the toolkit stands

The statement of work, section 6, accepts the work when the options analysis
covers component, zone, storey, and building levels with recommendations;
natural-language questions are answered against an enriched IFC model; the
paper passes editorial review; and the handover is done. The rows below add
the constraints the work names elsewhere (sections 2, 3.3, 7, 8, and the test
kit).

| Constraint | Source | State in the toolkit | Gap |
|---|---|---|---|
| Analytics at component, **zone**, storey, and building level | SoW 2.1, 6 | Element, storey, building, project sets written; `StoreyOfElement` view | No space or zone level anywhere; Duplex has 21 `IfcSpace` and no `IfcZone` |
| Aligned with NRC's existing IDS framework | SoW 3.1, 7 | `check.required` and `check.rule` produce verdict tables | No IDS file, no IDS reader, no validation of the enriched model |
| Reuse and export as priorities | SoW 2.1 | `sink.exportParquet`; `IfcDocumentReferenceBuilder` exists (6b34a54) | The enriched file has no document reference; Layer 2 is a CSV with no checksum |
| Metric dictionary (Layer 3) | Paper §3 | Metric ids appear only as a column of `nrc_analytics_long.csv` | No dictionary file; agents cannot resolve "carbon" to a column |
| Aggregates distinguishable from elements | Gap report 2.10 | `StoreyOfElement` works around it for one join (TKT-18) | Storey and building sets still reuse the element property names; three of four unattended misses came from this |
| An LLM agent answers the questions | SoW 3.3, 6 | `bimopenmcp-ifc-ask`, 4 of 8 on gpt-5 | Claude never measured (TKT-41, via the CLI per TKT-45); one run is not a reliability figure; eight questions cover no zone level |
| Colour coding, text annotation, aggregated views | SoW 2.2 | Colour and property panel done; charts done | No text in the scene: no labels on elements or storeys |
| Test kit steps 1 to 7 | `IFC-Test-Kit/README.md` | Toolkit row filled for steps 1 to 5 on the prepared CSV | No reusable graph for an arbitrary CSV with a match report; `large_test_model.ifc` (49 MB, IFC2X3) never measured |
| Proof-of-concept package (D2) | SoW 4 | The walkthrough regenerates figures in 291 s | No single bundle an NRC reviewer can open; Windows only |
| Enrichment with evidence | Paper §3; W5 | `nrc-enrich-run` writes typed values under an engine Run | Run from the editor, report, and evidence package wait on TKT-12 |
| No vendor lock-in, no production viewer, no portfolio scale | SoW 8 | Holds | Keep holding: nothing below adds a hosted service |

## Proposal

Seven pieces, in priority order. The first four close stated acceptance
criteria; the last three make the handover usable. Each piece names its
files, the check that says it is done, and its dependencies.

### P1. The analytics contract: a metric dictionary, and aggregates that are computed

The one defect the paper reports in its own recommendation is that storey
and building aggregates carry the element property names. The fix is not a
rename in the Python generator; it is to make the aggregates derived.

- `samples/nrc/nrc-metrics.csv`, the metric dictionary, one row per metric:
  `MetricId, PropertySet, PropertyName, Unit, LifecycleStage, AppliesTo
  (element|space|zone|storey|building), Rollup (sum|areaMean|none),
  Description`. It is the single source every later piece reads: the rollup
  graph, the IDS generator, the agent's skill, and the paper's Appendix A.
- Aggregate sets get their own names: `Pset_NRCSpaceSummary`,
  `Pset_NRCZoneSummary`, `Pset_NRCStoreySummary`,
  `Pset_NRCBuildingSummary`, each carrying the rolled-up properties and
  `ElementCount`, `AnalysisRunId`, and `ScenarioName`.
- A graph `nrc-rollup` computes them from the element rows and the
  dictionary: element values joined to `StoreyOfElement` (and to the space and
  zone views of P2), grouped, and aggregated by each metric's `Rollup` rule.
  Its output has the same columns as `psets_to_write.csv`, so
  `nrc-enrich-run` consumes it unchanged. The input CSV then holds element
  values only; nothing supplies a total that a graph can compute.
- The IFC MCP server exposes the dictionary as a view, `MetricCatalog`, read
  from the Layer 2 location the provenance set names, and the `ifc-ask` skill
  says to resolve a metric through it and to aggregate element sets only.

Done when: `nrc-rollup` reproduces today's storey and building totals to the
decimal; the regenerated enriched file has no `Pset_NRC*` element set on any
`IfcBuildingStorey` or `IfcBuilding`; and a test that sums
`OperationalCarbon_kgCO2e_per_year` over every entity carrying it, with no
class filter, returns the element total (37,196.2) and not a multiple of it.
That test is the storage defect expressed as an assertion.

### P2. Space and zone level

The statement of work names zone level twice, and the proof of concept has
none. Zone level also matters more than the paper admits: an energy model
computes operational energy per thermal zone, not per wall, so NRC's real
operational data will arrive keyed by zone. The test kit's per-element
`energy_intensity` column is an artefact of synthetic data.

- Views `SpaceOfElement` (through `ContainedIn` to an `IfcSpace`, the path gap
  report 2.5 observed in the Duplex conversion) and `ZoneOfSpace` (through
  `IfcRelAssignsToGroup` to an `IfcZone`), in the same place as
  `StoreyOfElement`, exposed to `ifc_sql` and to the `bos.*` graphs.
- An `IfcZoneBuilder` in `Ara3D.Ifc.Editing`, beside
  `IfcDocumentReferenceBuilder`: appends `IFCZONE` and
  `IFCRELASSIGNSTOGROUP` for a table of `(ZoneName, SpaceGlobalId)`, with the
  same deterministic `GlobalId` and diff-and-reverse tests.
- A zone table for Duplex, `samples/nrc/nrc-zones.csv`, grouping its 21 spaces
  into thermal zones per unit and storey, labelled synthetic like the rest.
- Zone-level operational values in the synthetic data (energy per zone,
  carbon from energy times the grid factor), so the question list can ask a
  zone question with a known answer.

Done when: `SpaceOfElement` reaches every element the Duplex conversion
places in a room; the enriched file contains the zones and a
`Pset_NRCZoneSummary` on each; and `nrc-q9-zone-eui` (a new graph) answers
"which zone has the highest energy use intensity" with the expected value,
asserted in `NrcWorkflows.Tests`.

### P3. IDS: an NRC specification and a node that checks it

IDS is the only recommendation in the paper's storage section that has
nothing behind it, and the statement of work asks for alignment with NRC's
IDS framework. The shape already exists: an IDS specification is an
applicability plus requirements, and `check.rule` already turns that shape
into a verdict table.

- `samples/nrc/nrc-analytics.ids`, IDS 1.0 XML, generated from
  `nrc-metrics.csv` (one specification per `AppliesTo` level): the element
  classes require `Pset_NRCEmbodiedCarbon` and `Pset_NRCOperationalCarbon`
  with typed values and `AnalysisRunId`; storeys require
  `Pset_NRCStoreySummary`; the project requires the provenance set. A second
  file, `samples/nrc/dc-w1.ids`, expresses rule DC-W1 (an `IFCDOOR` whose
  `OverallWidth` is at least 850 mm) to show that a threshold rule is an IDS.
- A library `Ara3D.Ids` under `src/data` that reads an IDS file and evaluates
  it over BOS tables: entity applicability by class and predefined type,
  property facets (set, name, data type, value, enumeration, bounds), and
  attribute facets. A facet it does not support (material, partOf,
  classification, at first) yields `InfoNotAvailable` with a warning naming
  the facet; it never passes silently. Before building the reader, run
  `no-new-wheels` against Xbim.InformationSpecifications, which parses IDS
  into an object model, and IfcOpenShell's `ifctester`.
- A node `check.ids` in the Compliance pack: inputs the model's entity and
  parameter tables, a path parameter for the `.ids` file; output the standard
  verdict table (`GlobalId, checkId, checkTitle, verdict, citation`), so
  `check.rollup`, `view3d.color`, and `sink.writePsets` work on it unchanged.
- An MCP tool `ifc_ids_check` in `bimopen-ifc` over the same library, so the
  agent can say "12 elements lack embodied carbon" from a tool result.
- A graph `nrc-ids-check` that colours the Duplex by IDS verdict.

Done when: `check.ids` over the enriched file gives the same pass and fail
counts as `ifctester` on the same file and IDS (a recorded parity run,
committed as a transcript); the roof, which deliberately has no embodied
carbon, fails; and `dc-w1.ids` gives 8 pass and 6 fail, the ground truth.

### P4. The agent measured, repeatedly, on a question set that covers every level

The acceptance criterion is that questions are answered. The paper's own
limitations section says one run is not a measurement.

- `samples/nrc/questions.json` replaces `questions.txt`: 16 questions, four
  levels (element, zone, storey, building) by three metrics, plus absence
  (Q7), provenance (Q6), ambiguity (Q4, whose right answer lists four doors),
  and an IDS question ("which elements are missing embodied carbon"). Each
  entry names the graph under `samples/nrc-analyses` that computes its
  expected answer, so CI owns the expectations, never prose.
- A scorer in `bimopenmcp-ifc-ask` that compares each answer with the graph's
  value: numeric within 0.1 %, lists as sets, absence as a stated absence.
  Verdicts are `Match`, `Miss`, `Honest non-answer`.
- Five runs per question through the Claude CLI backend (TKT-45, Haiku at
  medium effort), reported as matches out of five per question and a total,
  with tool calls and tokens. The transcript and the score table are committed
  under `artifacts/nrc-walkthrough/duplex/`.

Done when: the committed score table shows, for the P1-regenerated file, at
least 14 of 16 questions matching in at least four of five runs and no
question with a confidently wrong number in more than one run. If the target
is missed, the table is still committed and the paper quotes it; the point is
a measured figure, not a good one. TKT-41 becomes the first pass of this.

### P5. The test kit as a graph: bring your own IFC and CSV

When NRC sends a real model and dataset (SoW section 7 says it will), the
first thing anyone does is steps 1 to 5 of the test kit. Today that means
editing seeded graphs.

- A template graph `nrc-join-analytics` with three parameters, the IFC file,
  the CSV file, and the key column (default `GlobalId`): `csv.read` into
  `rel.join` on the key; a match report from two `rel.join` anti joins
  (CSV rows with no element, physical elements with no row) and their counts;
  `view3d.color` by a numeric column through a gradient and by a text column
  through a palette; per-storey totals and means from `StoreyOfElement`. Every
  column parameter uses the existing live suggestions.
- Run it once on the test kit's own `analytics_dataset_with_levels.csv`
  (268 rows) against `duplex.ifc` (218 physical elements in the synthetic
  set) and record what the match report finds; the mismatch is itself a
  finding for the paper.
- Test kit step 6: measure `large_test_model.ifc` (49 MB, IFC2X3, public)
  with `scripts/profile-bim-flow-startup.mjs`: conversion time, first frame,
  memory. This gives the paper a large-model number it can publish, which
  Snowdon, being private, cannot.

Done when: the template opens green on `duplex.ifc` with the test-kit CSV,
the match report's counts are asserted in a test, and the walkthrough index
lists the large-model timings.

### P6. Enrichment as a Run that leaves evidence

This joins P1 to P3 into the one operation NRC would repeat: take a model and
a dataset, produce an enriched file they can trust.

- Extend `sink.writePsets` with two optional inputs, `documents` (rows for
  `IfcDocumentReferenceBuilder`) and `zones` (rows for `IfcZoneBuilder`),
  rather than adding a second writer. Two sinks writing one output file in one
  Run would need an order between effects that the engine does not have; one
  writer with three inputs produces one file and one entity diff.
- `nrc-enrich-run` grows to: element CSV, `nrc-rollup`, `check.ids` against
  the specification (a warning table, never a block, per principle 6),
  `sink.exportParquet` of the long table, a document row naming that Parquet
  with its SHA-256, and `sink.writePsets` writing all three into a copy of the
  source.
- The evidence package comes from TKT-12 (claimed by another session): the
  run record pins the graph hash and every input hash, and the package lists
  the enriched IFC, the Parquet, the IDS, the IDS verdicts, and the entity
  diff with a SHA-256 each. This proposal adds nothing to TKT-12's fence; it
  only waits for it.

Done when: one Run from the editor over `nrc-enrich-run` writes the enriched
IFC, the Parquet, and the evidence zip; the entity diff equals the additions;
removal restores the source byte for byte; and a second Run produces
identical bytes.

### P7. Text in the scene, and the handover bundle

Two smaller pieces that the handover needs.

- **Labels.** SoW 2.2 lists text annotation beside colour. A `label` column on
  the instance table (principle 5: a column, not a wire type), set by a node
  `view3d.label` from a join column and a format string, drawn by the viewer
  as screen-space text at each instance's bounds centre, with a cap on how
  many are shown at once. The first figure: each storey's total operational
  carbon written over its slab, from the `nrc-rollup` output. Done when the
  figure is in the walkthrough.
- **The package (D2).** `npm run nrc:package --prefix bimopenflow/web` writes
  `artifacts/nrc-package/`: the enriched IFC, Parquet, dictionary, IDS files,
  graphs, figures, transcripts, score table, large-model timings, the last
  evidence zip, and a README for an NRC reviewer that gives the one command
  to start the host and page on Windows. Done when a fresh clone on a second
  Windows machine runs the package's command and opens the enriched Duplex
  coloured by operational carbon.

## Order and dependencies

| Order | Piece | Depends on | Size |
|---|---|---|---|
| 1 | P1 contract and rollup | TKT-18 (landed) | 3 chunks |
| 2 | P2 space and zone | P1 dictionary format | 3 chunks |
| 3 | P3 IDS | P1 dictionary; `no-new-wheels` first | 4 chunks |
| 4 | P4 measurement | P1 to P3 (questions cover their data); TKT-45 | 3 chunks |
| 5 | P5 test-kit template | none; can run beside P1 | 2 chunks |
| 6 | P6 enrichment Run | P1 to P3; TKT-12 | 3 chunks |
| 7 | P7 labels and package | P1 (labels), P6 (package contents) | 2 chunks |

P1 and P5 touch disjoint files and can proceed at once. P2 and P3 both edit
the IFC MCP server and should run one after the other. Each regenerated
enriched file must be copied to the paper repository with its new SHA-256,
and the paper's Tables 1 and 2 and Appendix A rewritten from the new run, in
that repository, not this one.

## What this proposal leaves out

- **RDF export over the Building Topology Ontology.** The statement of work
  asks for knowledge graphs as a discussion of future extensions, which the
  paper's Section 8 gives. An exporter would be mechanical and would not
  change an acceptance criterion.
- **The bidirectional viewer operations** (select, isolate, BCF viewpoints,
  write-back from the viewer). The statement of work asks for a roadmap, which
  the paper has; TKT-26 and TKT-28 build the first stage for the toolkit's
  own reasons.
- **Runs in Bonsai and a web viewer** for the viewer comparison (handoff M4).
  They are manual tests in the paper repository and do not need the toolkit.
- **A second public model** (FZK-Haus, handoff I7). Worth doing after P4, as
  a rerun of the same pipeline; it adds no feature.
- **Linux and macOS.** Everything touching IFC targets `net8.0-windows`
  because of the native web-ifc build; see the questions below.

## Questions for the owner

1. Has NRC sent its IDS framework, a real model, or a real dataset? Any of
   the three replaces a synthetic stand-in above, and P3 in particular should
   start from NRC's IDS rather than one written here.
2. May the zone table for Duplex be synthetic (P2), labelled as such, or
   should zone level wait for an NRC energy model that defines real thermal
   zones?
3. The aggregates move from the paper repository's Python generator into the
   `nrc-rollup` graph (P1). That makes the toolkit the source of the enriched
   file and the paper repository a copy. Is that the right direction of
   ownership?
4. Will NRC reviewers run the package on Windows? If not, a Linux build of the
   IFC MCP server becomes part of P7, and its size depends on whether web-ifc
   is the only Windows-only dependency.
