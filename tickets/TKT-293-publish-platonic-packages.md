---
id: TKT-293
title: Publish Platonic.Core and Platonic.Analyzers 0.1.0 to nuget.org
status: open
depends_on: []
owner:
fence: []
workflow: [W1]
related: [TKT-290]
confidence: high
created: 2026-10-12
kind: action
---

## Acceptance criteria

- [ ] dotnet restore of deps/bim-open-data succeeds on a machine with no Platonic.CSharp clone and no PlatonicRoot set

Only the owner holds the nuget.org key. Until this is done, TKT-290 documents the clone-and-pack step in the README and CI. After publishing, remove that step from both and from Platonic.props' RestoreAdditionalProjectSources.
