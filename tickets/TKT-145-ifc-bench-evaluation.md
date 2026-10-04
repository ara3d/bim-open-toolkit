---
id: TKT-145
title: Measure the IFC ask and the Ask box against IFC-Bench, an external benchmark with ground-truth answers
status: open
depends_on: []
owner:
fence: [scripts/**, samples/ask/**, docs/bim-flow-mcp-demo.md]
---

## Acceptance criteria

- [ ] A runner takes questions from IFC-Bench v2 (huggingface.co/datasets/sylvainHellin/ifc-bench, CC BY 4.0, 1,027 questions over 22 projects, 4 categories) for the projects whose models are CC BY 4.0 or MIT, runs the unattended IFC ask (bimopenmcp-ifc-ask, Claude CLI backend) on each, and records answers, tool calls, and cost
- [ ] Scoring compares each answer with the ground truth, per category; category 4 (information not available) counts an honest 'not available' as correct and an invented value as wrong
- [ ] A first run on a stratified subset (about 100 questions, all four categories) is committed with its transcript, score per category, model, effort, date, and cost; the full set runs only after the owner approves its cost
- [ ] The score table in docs/bim-flow-mcp-demo.md gains an IFC-Bench row; every wrong answer that shows a toolkit defect becomes a ticket

Filed 2026-10-03 after the owner pointed at IFC-Bench. It answers a gap in PROJECT.md workflow 2: today the agent is measured only on the toolkit's own ten questions and the NRC paper's eight. An external benchmark with ground truth, built by someone else, is stronger evidence, and its category 4 tests principle 3 (honest absence). Download the models at a pinned dataset revision; do not commit the IFC files; cite the dataset (see its README's Citation section) and each project's licence. Related: TKT-8 (Ask set), TKT-18 (IFC ask double count), TKT-41, TKT-144.
