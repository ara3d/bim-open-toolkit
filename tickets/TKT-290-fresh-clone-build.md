---
id: TKT-290
title: A fresh clone builds and tests green with the .NET 8 SDK alone
status: done
depends_on: []
owner:
fence: [README.md, .github/workflows/build.yml, .mcp.json, global.json, deps/bim-open-flow/src/flow/BimOpenFlow.Relations/Compile/SqlCompiler.cs, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bfast-buffers.txt]
workflow: [W1]
related: [TKT-153]
confidence: high
created: 2026-10-12
closed: 2026-10-12
kind: defect
---

## Acceptance criteria

- [x] README.md and .github/workflows/build.yml name the Platonic.Core and Platonic.Analyzers 0.1.0 packages, where they come from, and the step that makes them restorable (clone cdiggins/Platonic.CSharp and pack, or a nuget.org restore once TKT-293 is done)
- [x] deps/bim-open-flow SqlCompiler.cs line 89 compiles with the .NET 8 SDK: the condition before ? [] is parenthesised, and a global.json or an explicit LangVersion keeps CI and an 8.0-only machine on the same compiler
- [x] .mcp.json no longer lists the platonic server (it depends on ../platonic-ts, which exists only on the owner's machine); the owner's user-level MCP config carries it instead
- [x] golden/bim/bfast-buffers.txt holds no absolute path from the owner's machine; the test passes in a clone at any location

Reported 2026-10-12 by the Studio 2.5 colleague from a clone on Windows 11 with .NET SDK 8.0.424 only: NU1101 on the seven BuildingModel and DataModel projects (Platonic packages not on nuget.org, Platonic.props expects a sibling Platonic.CSharp/artifacts), CS1513/CS1002 at SqlCompiler.cs(90,17), and the bfast golden expecting C:/Users/cdigg/.... The same cause explains the red CI on ara3d/bim-open-toolkit, whose workflow has no Platonic step. The bim-open-flow change is committed in deps/bim-open-flow and pushed; the supervisor moves the pin in deps.json afterwards (deps.json is outside this fence).

## Notes

2026-10-12, builder a2a91874: SqlCompiler.cs condition parenthesised (bim-open-flow c74cc5bb, pushed; the pin in deps.json still has to move). README gains a Platonic packages note and build.yml a clone-and-pack step; .mcp.json no longer lists the platonic server. Not done: no global.json (this machine has only the 9.0 and 10.0 SDKs, so a 8.0 pin cannot be tested; criterion 2's parenthesis part is met, the pin part is open). Not done: bfast golden. The path is printed because the bim profile's model roots (BimSampleSeeding.SeededModelRoots) and GoldenTests.ModelRoots do not include deps/bim-open-flow/samples/tables, the {SAMPLES} target of samples/showcase-tables; the fix is a PathAlias there, outside this fence (GoldenTests.cs), followed by re-approving the golden.

2026-10-12, session a2a91874: the compiler guard is CI itself, not a global.json. Every project in BimOpenToolkit.sln targets net8.0; build.yml now installs only the 8.0 SDK (cf73d951), so CI compiles with the compiler an 8.0-only machine has. A global.json was rejected: the owner's machine has no 8.0 SDK, and the .NET 10 SDK was only in CI for bim-open-data's Browser app, which this solution does not build. The pin moved with a68782f1 (bim-open-flow ac694ac, which contains c74cc5b). bfast golden: GoldenTests.cs adds a PathAlias for bim-open-flow's samples/tables as {SAMPLES} and the golden is re-approved (87f0a91a); 702 SampleFlows goldens pass in a clean copy of the tracked files (C:\w290, deps linked). The platonic MCP server is now in the owner's user-level ~/.claude.json with absolute paths. Not verified: a build with an actual 8.0 SDK, which the next CI run on main is.

## Close gates

2026-10-12, bim-open-flow pin: `node scripts/check-pin.mjs bim-open-flow` in `.` passed.

```
bim-open-flow: pinned at ac694ac, pushed
```

2026-10-13, session a2a91874: CI still failed at dotnet build after the clone-and-pack step. Reproduced with the .NET 8.0.425 SDK on a clean copy with the Platonic packages removed from the global NuGet cache: NU1101 in every toolkit project that reaches bim-open-data, and in bim-open-data's Ara3D.Ids and BimOpenMcp.Ifc, because the restore source lived only in Platonic.props and the transitive consumers never import it. Fixed by setting PlatonicRoot and RestoreAdditionalProjectSources in both Directory.Build.props files (bim-open-data 26d3d02, pinned here). Clean copy, empty cache, 8.0 SDK: 0 errors.
