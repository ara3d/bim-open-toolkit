---
id: TKT-301
title: Spike: measure how far ExpressGrammar parses the AP242 long form and how the STEP tokenizer handles complex instances
status: done
depends_on: []
owner: session 10b9c9c6
session: 10b9c9c6-0052-40f3-a1c2-c12f2f8861d7
fence: [docs/plans/step-reader.md]
workflow: [W3, W4]
related: [TKT-299]
confidence: high
created: 2026-10-17
claimed: 2026-10-17
closed: 2026-10-17
---

## Acceptance criteria

- [x] the number of AP242 entity and type blocks ExpressGrammar fails to parse, with the constructs that cause each failure class, is in the plan's build log
- [x] the number of complex instances in at least two real AP242 or AP214 files, and what StepDocument records for them, is in the plan's build log
- [x] the source and redistribution terms of the AP242 long-form schema file are recorded

Plan: docs/plans/step-reader.md (reading STEP geometry in C# the way IFC is read: generated schema types from EXPRESS via Parakeet). Throwaway code lives outside the repository; only the plan's build log changes.
