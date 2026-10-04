---
id: TKT-145
title: Measure the IFC ask and the Ask box against IFC-Bench, an external benchmark with ground-truth answers
status: open
depends_on: []
owner:
fence: [scripts/**, samples/ask/**, docs/bim-flow-mcp-demo.md]
---

## Acceptance criteria

- [x] A runner takes questions from IFC-Bench v2 (huggingface.co/datasets/sylvainHellin/ifc-bench, CC BY 4.0, 1,027 questions over 22 projects, 4 categories) for the projects whose models are CC BY 4.0 or MIT, runs the unattended IFC ask (bimopenmcp-ifc-ask, Claude CLI backend) on each, and records answers, tool calls, and cost
- [x] Scoring compares each answer with the ground truth, per category; category 4 (information not available) counts an honest 'not available' as correct and an invented value as wrong
- [x] A first run on a stratified subset (about 100 questions, all four categories) is committed with its transcript, score per category, model, effort, date, and cost; the full set runs only after the owner approves its cost
- [ ] The score table in docs/bim-flow-mcp-demo.md gains an IFC-Bench row; every wrong answer that shows a toolkit defect becomes a ticket

Filed 2026-10-03 after the owner pointed at IFC-Bench. It answers a gap in PROJECT.md workflow 2: today the agent is measured only on the toolkit's own ten questions and the NRC paper's eight. An external benchmark with ground truth, built by someone else, is stronger evidence, and its category 4 tests principle 3 (honest absence). Download the models at a pinned dataset revision; do not commit the IFC files; cite the dataset (see its README's Citation section) and each project's licence. Related: TKT-8 (Ask set), TKT-18 (IFC ask double count), TKT-41, TKT-144.

## Outcome of the first run (2026-10-03)

The work lives in bim-open-data, not in this repository's `scripts/`: [`bench/ifc-bench/`](https://github.com/ara3d/bim-open-data/tree/main/bench/ifc-bench) (commits 7eb12c3 tooling, a780ebc results), because the IFC MCP server is built there. The runner calls `claude -p` directly with the `bimopen-ifc` server and the ifc-ask guide as the appended system prompt, rather than through `bimopenmcp-ifc-ask`; the effect is the same agent, model, and guide.

- Dataset: IFC-Bench v2 at revision `df630de`, 1,026 questions (one duplicate was removed after the 1,027 count). Licences read from each `license.txt` into `manifest.json`: CC BY 4.0 or MIT for 16 projects; GPL 3.0 for `4351`, `ettenheim_gis`, `hitos`, `samuel_macalister_sample_house`; CC BY 3.0 for `west_riverside_hospital` (no questions). Models are cached, not committed.
- Subset: 100 questions over 22 models of at most 80 MB, category seats 15/55/11/19 in proportion to the dataset.
- Score, Claude Haiku 4.5 at medium effort, 30 turns at most: 62 correct, 29 wrong, 7 unresolved, 2 at the turn limit. By category: 1 direct retrieval 8 of 15, 2 aggregation 39 of 55, 3 geometric 3 of 11, 4 not available 12 of 19. The deterministic comparator settled 38 questions; the evaluating agent reviewed all 100 (`review.json`). The owner has not checked those verdicts.
- Cost and time: $6.79 at list price on a subscription login ($0.068 a question), 46 min wall time at three sessions at a time.

Candidate toolkit defects, not yet filed as tickets (this ticket's fence did not cover them):
1. A `ParameterText` join to `StoreyOfElement` returns two rows per element for DigitalHub pipes and ducts (questions 213 and 236), doubling totals. Possibly the same as TKT-18.
2. Material layer sets and thicknesses were not found for wall and roof types (387, 421, 434, 457).
3. The ifc-ask guide does not tell the agent to compute totals in SQL; two answers listed the right areas and then summed them wrongly (375, 440).

Still open: the IFC-Bench row in `docs/bim-flow-mcp-demo.md`, and the tickets above.

Owner decisions:
- Whether `review.json`'s verdicts stand, and the four unresolved category 4 questions (210, 343, 502, 946) where the answer cites a value the ground truth says is absent.
- Whether to run the full set, at this run's rates: the 733 eligible questions about $50 and 5 h; with the five large models (97 to 343 MB) 837 questions, about $57 and 6 h or more; with the GPL projects all 1,026, about $70 and 7 h.
- Whether GPL 3.0 models may be used for evaluation (no redistribution) or stay excluded.

## Note, 2026-10-04: the three candidate defects

Fixed in bim-open-data (commits 26b8691, 817e609, 616c742, 9cb7366; rerun 95db8e2):

1. Double count (213, 236). Not StoreyOfElement and not TKT-18's cause: the DigitalHub Revit exports attach two property sets of the same name with the same values to every pipe and duct (two 'Abmessungen' sets, each with Länge), and the converter wrote both, so ParameterText held 69,279 rows for the plumbing model where 48,911 are distinct. The converter, the parameter index, and `ifc_properties` now read each (set, name, value) once per element; differing values are all kept. Test: `DuplicatePropertySetTests`.
2. Material layers (387, 421, 434, 457). The tools exposed IfcMaterialLayer as an entity with a HasLayer relation, but no thickness, and named every material wrongly. Causes: a material's name was read from IfcRoot's position (attribute 2, which is IfcMaterial.Category, so 'Generisch'); attributes became parameters only from index 3, so LayerThickness (attribute 1) was dropped; IfcMaterialConstituent was excluded; IfcPhysicalComplexQuantity, where Revit reference-view exports keep each layer's width, was not parsed; and the `\X\hh` escape ('W\X\E4rmed\X\E4mmung') was not decoded. Layers and constituents now carry their thickness, material, set, and position (`Ifc:LayerThickness`, `Ifc:LayerIndex`, `Ifc:ConstituentIndex`, ...), and layer widths read as '<layer>/Width'. Tests: `MaterialLayerTests`, `IfcStringDecoderTests`.
3. Guide (375, 440). The ifc-ask guide says to compute every total in SQL, and describes the material rows. The guide exists twice: bim-open-data's `.claude/skills/ifc-ask/ifc-guide.md`, which the bench runner reads, and this repository's copy, which `BimOpenMcp.Ifc.Ask` embeds; both carry the change (the duplication is recorded in `docs/plans/repository-split.md`, phase 4 debt).

Rerun of the eight questions (`bench/ifc-bench/results/2026-10-04/`, same model and runner, $0.77): 4 correct (213, 375, 440, 457), 2 wrong (387 misses a one-layer wall type; 434 lists roof layers alphabetically without repeats), 2 for the owner (236: the ground truth's levels are reference levels, the answer's are containment storeys; 421: the file associates materials with GK 125, the ground truth says none). On 2026-10-03 all eight were wrong or out of turns. Reviewed by the agent that made the fixes, not the owner.

Filed from this work: TKT-146 (conversion never returns on a model without units), TKT-147 (a round-trip test rewrites a file it holds open), TKT-148 (guide: layer order and one-layer types). The toolkit should pin bim-open-data at 95db8e2 to pick the fixes up.
