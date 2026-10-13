---
id: TKT-290
title: A fresh clone builds and tests green with the .NET 8 SDK alone
status: open
depends_on: []
owner:
fence: [README.md, .github/workflows/build.yml, .mcp.json, global.json, deps/bim-open-flow/src/flow/BimOpenFlow.Relations/Compile/SqlCompiler.cs, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bfast-buffers.txt]
workflow: [W1]
related: [TKT-153]
confidence: high
created: 2026-10-12
kind: defect
---

## Acceptance criteria

- [ ] README.md and .github/workflows/build.yml name the Platonic.Core and Platonic.Analyzers 0.1.0 packages, where they come from, and the step that makes them restorable (clone cdiggins/Platonic.CSharp and pack, or a nuget.org restore once TKT-293 is done)
- [ ] deps/bim-open-flow SqlCompiler.cs line 89 compiles with the .NET 8 SDK: the condition before ? [] is parenthesised, and a global.json or an explicit LangVersion keeps CI and an 8.0-only machine on the same compiler
- [ ] .mcp.json no longer lists the platonic server (it depends on ../platonic-ts, which exists only on the owner's machine); the owner's user-level MCP config carries it instead
- [ ] golden/bim/bfast-buffers.txt holds no absolute path from the owner's machine; the test passes in a clone at any location

Reported 2026-10-12 by the Studio 2.5 colleague from a clone on Windows 11 with .NET SDK 8.0.424 only: NU1101 on the seven BuildingModel and DataModel projects (Platonic packages not on nuget.org, Platonic.props expects a sibling Platonic.CSharp/artifacts), CS1513/CS1002 at SqlCompiler.cs(90,17), and the bfast golden expecting C:/Users/cdigg/.... The same cause explains the red CI on ara3d/bim-open-toolkit, whose workflow has no Platonic step. The bim-open-flow change is committed in deps/bim-open-flow and pushed; the supervisor moves the pin in deps.json afterwards (deps.json is outside this fence).
