---
id: TKT-218
title: The notebook snapshot records graph input values
status: open
depends_on: []
owner:
fence: [deps/bim-open-notebook/**]
workflow: [W3]
related: [TKT-204]
created: 2026-10-11
---

## Acceptance criteria

- [ ] A notebook snapshot stores the graph input values (name and value) in force when each result was taken
- [ ] A published notebook page shows which model a result came from, from those values
- [ ] A snapshot taken before this change still opens

Split from TKT-204 (criterion 5: the notebook's snapshot records the graph input values). The host, the MCP server and the run record already carry graph inputs (run records list them under graphInputs; EvalUpdate reports them). The snapshot format and the page live in the separate bim-open-notebook repository, which the TKT-204 builders did not touch. Start from a run record's graphInputs and the GraphInputInfo contract in deps/bim-open-flow.
