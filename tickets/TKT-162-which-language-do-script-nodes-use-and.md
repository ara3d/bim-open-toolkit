---
id: TKT-162
title: Which language do script nodes use, and where do they run?
status: open
depends_on: []
owner:
fence: []
workflow: [W4]
created: 2026-10-04
kind: question
---

Serves W4 (extend with a script or a pack). The owner decided on 2026-10-04 that a script is how a person or Claude makes a new node; the brief says nothing about the language or the runtime. Options: 1. C# scripts compiled and loaded by the host (same language as the packs, no second runtime). 2. TypeScript or JavaScript run by the host through a sandboxed runtime. 3. Python in a subprocess, the data scientist's language, tables passed as Parquet or Arrow. 4. SQL only, a script being a named sql.query with declared ports. Default: none (blocks W4): the choice fixes the node contract, the test harness, and the catalog entry.
