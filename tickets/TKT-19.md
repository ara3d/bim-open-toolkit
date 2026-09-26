---
id: TKT-19
title: The NRC walkthrough and its eight numbers run as a gate on every push
status: open
depends_on: []
owner:
fence: [gates/**, .github/workflows/build.yml, bimopenflow/web/package.json, tests/NrcWorkflows.Tests/**]
---

Serves W6 and guards W4 and W5. docs/nrc-walkthrough.md and artifacts/nrc-walkthrough/README.md: the walkthrough runs by hand in 291 s; README.md 'Maturity' says the publishing chain has no end-to-end gate. Cheapest guard on the demos the owner shows.
