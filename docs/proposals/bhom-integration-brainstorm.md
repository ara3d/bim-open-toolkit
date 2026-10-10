# BHoM integration: brainstorm

> Brainstorm, 2026-10-10. A wide, unjudged list of ways BIM Open Toolkit could connect to BHoM, the Buildings and Habitats object Model from Buro Happold (https://github.com/BHoM), followed by the tensions, five grouped approaches, and a soft recommendation. Nothing here is decided; the next step is to pick ideas and evaluate them (the `platonic:investigate` skill for a spike, `platonic:no-new-wheels` for reuse). Facts about BHoM were checked on 2026-10-10 against the GitHub organisation (through the public REST API), the `BHoM/documentation` repository, bhom.xyz, and the NuGet profile, and are marked **docs**; everything else is **inferred**. This repository had no earlier mention of BHoM; the nearest is the Speckle row in `docs/CONTRIBUTIONS.md` and its companion `docs/proposals/speckle-integration-brainstorm.md`.

## What BHoM is, in the terms this repository uses

- **Four kinds of code.** The oM (object model) is C# classes with public get/set properties and no methods or constructors; the Engine is static extension methods sorted into `Create`, `Modify`, `Query`, `Compute`, `Convert`, and `External` classes, with immutability enforced on inputs "to enable translation to flow based programming"; the Adapter is a common protocol for talking to outside software; the UI layer exposes all three by reflection, so a new Engine method appears in Grasshopper and Excel with no UI code. **docs** This is the toolkit's design seen from the other side: pure functions over immutable data, and a catalog generated from declarations. The difference is the data: BHoM passes object graphs (a `Bar`, a `Panel`, a `Space`), the toolkit passes tables.
- **The base object.** Every type implements `IObject`. `BHoMObject` adds `BHoM_Guid`, `Name`, `Tags` (a set of strings), `CustomData` (a string-to-object dictionary), and `Fragments`, extra typed records attached to an object. Adapters use fragments for identity and source data: a Revit pull attaches `RevitIdentifiers` (`PersistentId` from the element's UniqueId, `ElementId`, `CategoryName`, `FamilyName`, `Workset`, and more) and `RevitPulledParameters`; the IFC adapter has `IfcPulledProperties`. **docs** A fragment is close to a BOS parameter group; `PersistentId` is close to a BOS entity's global id. **inferred**
- **Adapters.** Five actions: Push (reads what exists, then creates, updates, or deletes, deciding with a "Venn diagram" comparison), Pull (a read for an `IRequest`), Move (pull from one tool, push to another without loading the data in the UI), Remove, and Execute (a tool-specific command such as run an analysis or save). Each takes an `ActionConfig`. In Grasshopper a Pull or Push does nothing until its `active` input is true. **docs** That input is the same idea as "nothing writes until Run", per component instead of per graph. **inferred**
- **Repositories and activity.** 113 repositories in the GitHub organisation; 80 were pushed in 2025 or 2026. Most active in the last two weeks: `BHoM`, `BHoM_Engine`, `LifeCycleAssessment_Toolkit`, `Versioning_Toolkit`, `Revit_Toolkit`, `ETABS_Toolkit`, `SAP2000_Toolkit`, `Lusas_Toolkit`, `TeklaStructuralDesigner_Toolkit`, `SQLite_Toolkit`, `Python_Toolkit`, and `OpenAI_Toolkit`. 37 repositories were last pushed on 2026-09-25, the day the 9.3 beta was cut, which is likely a version bump rather than feature work. **docs** (dates) and **inferred** (the reason). Adapters with recent pushes cover structural analysis (ETABS, SAP2000, Robot, GSA, Lusas, RFEM 5 and 6, RAM, MidasCivil, Karamba3D, Tekla Structural Designer), environmental and daylight (IES, LadybugTools), authoring (Revit, Rhinoceros), data (Excel, SQL, SQLite, Mongo, XML, File, HTTP, Socket, STL, OpenStreetMap, PowerPoint), and carbon (LifeCycleAssessment, CarbonQueryDatabase, 2050Materials). **docs**
- **Stale integrations.** `IFC_Toolkit` (built on xBIM, with a pull of floors, spaces, and rebar and a push of IFC properties through fragments) and `Speckle_Toolkit` ("simple push pull for a speckle stream") were last pushed in January 2024 and February 2024. `EnergyPlus_Toolkit`, `TeklaStructures_Toolkit`, and `Civil3D_Toolkit` are also quiet. **docs** So BHoM's own IFC route is effectively unmaintained, and the toolkit's IFC stack is the stronger of the two. **inferred**
- **Licence.** 95 of the 113 repositories are LGPL-3.0, including `BHoM`, `BHoM_Engine`, `BHoM_Adapter`, and every toolkit checked; the toolkit is MIT. **docs** Referencing BHoM's NuGet packages from an MIT host is allowed by the LGPL so long as BHoM stays a replaceable library; copying BHoM source into this repository is not. **inferred** (not legal advice)
- **Packaging.** BHoM installs with a Windows installer into `C:\ProgramData\BHoM\Assemblies`, and toolkits reference DLLs there by hint path. Since 2023 the core also ships on NuGet: `BHoM`, `BHoM.Engine`, `BHoM.Adapter`, `BHoM.UI`, and `BHoM.Interop.*` packages (Excel, SQL, File, Python, LifeCycleAssessment, Analytics, LadybugTools, and others), 24 packages and about 345,000 downloads in total; `BHoM` 9.3.0-alpha.6.0 targets .NET Standard 2.0. The Revit toolkit itself builds against .NET Framework 4.8 and supports Revit 2022 to 2026, talking to Revit through a `RevitListener` plug-in and sockets. **docs** The toolkit's host is `net8.0-windows`, so the NuGet core loads in-process; the Revit adapter would not. **inferred**
- **Releases and versioning.** One version for everything, `major.minor.alpha/beta.increment`, quarterly: 9.1 (April 2026), 9.2 (July), 9.3 (October), and 10.0 planned for January 2027. Each project keeps a `Versioning_XX.json` of renamed namespaces, types, properties, and methods (the latter through a `PreviousVersion` attribute); a separate `BHoMUpgrader` executable per quarter upgrades an old serialised script one version at a time until it deserialises. **docs**
- **Hashing and diffing.** `BH.Engine.Base.Query.Hash()` hashes any `IObject` under a `ComparisonConfig` (tolerances, ignored properties), can store the result in a hash fragment, and the Diffing engine reports added, removed, and modified objects between two sets. **docs**
- **UIs.** Grasshopper (the README names Rhino 5 and 6; the repository was pushed in September 2026), Excel (an add-in whose formulas call Engine methods and adapter actions from cells), and Dynamo (README names Dynamo 2.0 and 2.3; last pushed June 2026). **docs**
- **Carbon.** `LifeCycleAssessment_Toolkit` models environmental product declarations (EPDs), element results, and scope; reports global warming potential in kgCO2e and other indicators by life-cycle stage (A1 to A3, B, C); has `EvaluateProjectLifeCycleAssessment`, `ConcreteVolume`, `ReinforcementVolume`, `BenchmarkVariance`, and tests for IStructE-style evaluation. EPD data comes from EC3, CarbonQueryDatabase, 2050 Materials, or BHoM datasets. A Revit pull can attach a `RevitMaterialTakeOff` fragment that the LCA toolkit turns into volumes. **docs**
- **AI and Python.** `OpenAI_Toolkit` (created July 2025, pushed 2026-10-07) is an adapter whose Execute action sends an `ExecutePrompt` to OpenAI's chat API with a text, JSON-object, or JSON-schema output type. `Python_Toolkit` installs a Python environment from a Grasshopper component. `BHoM_JSONSchema` (2025) publishes generated JSON Schemas of the oM, and `BHoM_PythonSchema` was created on 2026-10-05 and still holds the template. `MachineLearning_Toolkit` exists. No MCP (Model Context Protocol) server or Claude work was found in the organisation's issues or repositories. **docs** (what exists) and **inferred** (absence, from a search of issue titles and repository lists only)
- **Community and bots.** 63 contributors to `BHoM`, 80 to `BHoM_Engine`, 44 to `Revit_Toolkit`, 21 to the LCA toolkit; 249 stars on the core repository. BHoMBot runs compliance, versioning, serialisation, dataset, and unit-test checks on every pull request, builds the installers, and publishes the NuGet packages. AEC Magazine (December 2024) describes "over 1,200 object models" and adapters to "over 30 different software packages", used at Buro Happold from feasibility to connection design. **docs**
- **Relationship to Speckle.** BHoM is an object model, Speckle a server; Speckle once carried BHoM objects as a "kit", and BHoM had a Speckle adapter, both now dormant. **docs** (the Speckle community description and the repository dates)

## Brainstorm

Goal: find where BHoM and the toolkit fit together so that a BHoM user (mostly an engineer at Buro Happold or another consultancy working in Grasshopper and Excel) gets something they cannot get today, and the toolkit gets a way into thirty-odd analysis and authoring tools, a schema for engineering objects, and a library of tested engineering functions, without giving up its principles (one edit path, nothing writes until Run, honest absence, runs as evidence, tables as the currency).

Ideas, grouped by what is borrowed or offered. Tags name the prompt that produced the idea.

### BHoM adapters as a source

1. A `bhom.pull` node: an adapter name, an `IRequest` as a Json parameter, and the BOS tables out (entities from objects, parameters from properties, fragments, and `CustomData`, relations from object references). Pure, cached by the hash of the pulled objects. (extends `bos.load` in `src/flow/BimOpenFlow.Nodes.Bos`, which already returns three tables keyed by a content hash, and the Json parameter kind in `docs/nodes.md`)
2. A generic flattener: any `IObject` list to an entity-attribute-value table by reflection, one row per leaf property, typed by the property's CLR type. One function makes every adapter a table source. (what if it already existed: BHoM's own `Explode` in the Excel UI does a shallow version)
3. ETABS, SAP2000, Robot, and GSA results as tables: bar forces, node reactions, utilisations per load case. Then `table.aggregate` and `chart.bar` give a utilisation chart per storey with no Excel macro. (recombine: BHoM's structural adapters plus `BimOpenFlow.Nodes.TableOps`)
4. The structural model and the architectural model in one graph: a Robot pull and an IFC file, joined on position or on a mapping table. The brief excludes several models in one Run (TKT-21 may reopen it), so this is a test of that rule. (extreme: two disciplines, one question)
5. Revit through BHoM instead of the toolkit's own Revit 2025 exporter in `plugins/Ara3D.BIMOpenSchema.Revit2025`: BHoM already supports Revit 2022 to 2026, the exporter supports one version. (what if the problem moved to someone else)
6. `RevitIdentifiers.PersistentId` as the BOS entity's global id, so a Revit element pulled through BHoM and the same element exported to IFC join without a correspondence table. (borrow from databases: a natural key)
7. IES and LadybugTools results (daylight factors, solar gains per room) as tables joined to `bim.rooms`. (recombine: environmental adapters plus `BimOpenFlow.Nodes.BimAnalysis`)
8. A `bhom.move` dry run: BHoM's Move action pulls from one tool and pushes to another; the toolkit shows the table of what would move, and the push waits for Run. (invert: preview before act)
9. OpenStreetMap through BHoM's adapter into `spatial.*` nodes: site context without a GIS tool. (recombine)
10. A pull's warnings and errors (BHoM records them with `Compute.RecordError`) as a table beside the data, so a failed conversion is a row and not a lost object. (extends principle 3, honest absence)

### BHoM adapters as a sink

11. A `sink.bhomPush` effect node: a table and an adapter in, a Push on Run. BHoM's `active` toggle and the toolkit's Run gate are the same rule at two scales; the node sits in `BimOpenFlow.Nodes.Effects` beside `sink.writePsets`. (extends `deps/bim-open-flow/src/flow/BimOpenFlow.Nodes.Effects/WritePsetsNode.cs`)
12. Rule-check verdicts pushed to Revit as a shared parameter through `Revit_Toolkit`: the toolkit writes to Revit while the brief's "no live link to an authoring tool" stays true for the toolkit's own code. (what if someone else held the link)
13. The Push's Venn comparison run in the toolkit before Run: a table of creates, updates, and deletes, so a reviewer signs off a push the way a pull request is reviewed. (borrow from code review)
14. A section-size optimisation graph: pull a Robot model, pick lighter sections in a `table.derive`, push back, run the analysis with Execute, pull results, repeat. A loop over Runs. (extreme: a thousand iterations)
15. `sink.exportXlsx` writing sheets in the layout BHoM's Excel UI reads as objects, so an engineer opens the workbook and the cells are already BHoM objects. (what if a file format were the integration)
16. PowerPoint through BHoM's `PowerPoint_Toolkit`: the toolkit's chart and 3D picture pushed into a client's slide template on Run. (workflow 3: hand it to someone)

### The oM as a schema

17. A published mapping from oM types to BOS: `Bar` to a structural member entity with section and material parameters, `Panel` to a slab or wall, `Space` to a room, fragments to parameter groups. Written as a table, committed, and tested both ways. (what if it already existed as a format)
18. Generate BOS parameter names from BHoM's JSON Schemas in `BHoM_JSONSchema`: the schema becomes the dictionary of engineering properties BOS does not have yet. (borrow: someone else's data dictionary)
19. The inverse: BOS's closed relation vocabulary (`PartOf`, `ContainedIn`, `HostedBy`, `BoundedBy`) offered to BHoM as a fragment, so a BHoM object graph can say "contained in" without a custom property. (invert: give instead of take)
20. BHoM objects stored as JSON in a BOS string column, with a `bhom.inflate` node that turns rows back into objects for an Engine call. The table carries the object; the object never leaves the table. (deliberately far: one column holds a whole object model)
21. BHoM units conventions (SI throughout, documented in `BHoM-Units-conventions.md`) checked against the `BimOpenSchema.Harmonizer` SI columns: two independent unit systems, one diff table. (biology: redundancy)
22. A BHoM `Dataset` (sections, materials, EPDs) as a lookup table node: `bhom.dataset` with the dataset name as an Enum parameter. (extends `table.inline` in `BimOpenFlow.Nodes.Tables`)

### BHoM Engine methods as nodes

23. A node pack generated by reflection over `BH.Engine.*`: each `Query` and `Compute` method with scalar inputs becomes a node over table columns, one row per call. BHoM's UI does the same reflection to fill Grasshopper's menu, so the metadata (`Description`, `Input`, `Output` attributes, enforced by BHoMBot) is already there. (extends `BimOpenFlow.Host.Catalog` and the `NodeSpec` declarations that `BimOpenFlow.NodeDocs` turns into `docs/nodes.md`)
24. Purity by namespace: `Query` and `Compute` map to Pure nodes, adapter actions map to Effect nodes, `Modify` returns a new object and is pure too. BHoM's naming rule gives the toolkit's purity flag for free. (what if a convention were the type system)
25. Section property nodes (`Area`, `MomentOfInertia`, `Mass` on a section from a dataset) for a structural take-off from an IFC file: the toolkit supplies the geometry, BHoM supplies the engineering. (recombine)
26. Geometry Engine methods as the toolkit's missing 2D and 3D geometry library: offsets, intersections, planar checks over footprints from `spatial.footprint`. (borrow: a tested library)
27. `Humans_Engine.ViewQuality` (stadium sightline C-values, documented in the BHoM docs) as a node over seat tables: a niche analysis nobody else in the toolkit's catalog offers. (extreme: one very specific client)
28. Engine method descriptions merged into the Ask box's tool description, so Claude sees "Compute.EvaluateProjectLifeCycleAssessment" with its BHoM description and inputs. (extends `.claude/skills/bim-flow/`, which is also the Ask box's system prompt)
29. Script nodes (workflow 4, TKT-162) whose first language is "a BHoM Engine method name": the cheapest script is one that already exists and is tested by BHoMBot. (what if the scripting language were a library)

### Carbon and life-cycle assessment

30. An `lca.evaluate` node: a quantities table and an EPD table in, kgCO2e per element and stage out, calling the LCA toolkit's evaluation. Fills the "embodied carbon" pack named in `docs/OVERVIEW.md` and `docs/CANDIDATE-WORK.md` line 105. (extends `BimOpenFlow.Nodes.BimAnalysis` quantities and `table.join`)
31. Carbon from any IFC file: the toolkit's volumes (`ifc_volume`, `view3d.measures`) feed BHoM's LCA, so a consultancy gets a carbon number from a model it did not author in Revit. (what if the obvious source, Revit, were forbidden)
32. A carbon heat map in 3D: `lca.evaluate` into `view3d.color`, one picture per design option for a client meeting. (workflow 3)
33. Honest carbon: elements with no matched EPD stay as a separate "unassessed" row and percentage instead of being priced at zero, which is the principle that TKT-18 (the IFC Ask double count) broke. (extends principle 3)
34. Benchmark variance (`BenchmarkVariance` in the LCA engine) against the published targets, run on every model in the 467-file corpus. (extreme: every building at once; TKT-21)
35. Carbon per design iteration over time, one run record per iteration, so "the scheme dropped 12% since stage 2" has a replayable derivation behind it. (borrow from accounting: an audit trail)

### Claude and the AI story

36. A `bimopen-bhom` MCP server beside `bimopen-ifc` and `bimopenflow-duckdb`: list adapters, pull to tables, describe an oM type, call an Engine method, push on Run. Same shape as `deps/bim-open-flow/src/mcp/BimOpenMcp.Flow`. (extends the two MCP servers in `.mcp.json`)
37. Claude as a BHoM engineer's assistant in Claude Code: "pull the ETABS model, list bars over 90% utilisation by storey, chart it", answered with a graph that replays. BHoM has an OpenAI adapter that sends one prompt; it has no agent that drives its own adapters. (what if the agent were the UI)
38. Claude writes a Grasshopper definition from a toolkit graph, since both are graphs over the same Engine methods. (far-fetched)
39. Claude reads an existing Grasshopper `.gh` file that uses BHoM components and rebuilds it as a toolkit graph, so a script nobody can maintain becomes a documented, replayable one. (invert: import instead of export)
40. A benchmark arm for BHoM users: the committed question set (workflow 5) asked of an ETABS or Revit model through BHoM, scored on correctness, time, and tokens, against Claude with only the BHoM installer and a shell. (what if a competitor did it by hand)
41. Claude writes a BHoM Engine method and its BHoMBot-compliant attributes when a node is missing, and the toolkit picks it up by reflection with no host change. (recombine 23 and workflow 4)

### Evidence, versioning, and identity

42. BHoM's `Hash()` with a `ComparisonConfig` as the content hash a run record pins for a pulled model, so a run against a live ETABS model is still replayable evidence. (extends run records in `BimOpenFlow.Evidence`)
43. BHoM's Diffing engine as a `bhom.diff` node: two pulls in, added, removed, and modified rows out, with the changed property names. The time axis BOS lacks, from someone else's tested code. (invert: one model becomes a series)
44. Borrow `BHoMUpgrader` for graph documents: each node pack keeps a versioning file of renamed kinds and parameters, and an old graph is upgraded one step at a time on load. The toolkit has no story yet for renaming a node kind without breaking saved graphs. (borrow from BHoM)
45. Borrow BHoMBot's compliance checks (every method has a description, inputs in order, no constructor on data types) as a gate over `NodeSpec` declarations. (borrow from BHoM's CI)

### Ecosystem and customers

46. A Grasshopper component pack that runs a saved toolkit graph: inputs as Grasshopper parameters, outputs as BHoM objects or trees. The engineer stays in Grasshopper and gets the toolkit's IFC parsing, DuckDB, and evidence. (what if nobody opened the toolkit)
47. An Excel formula `=BIMFLOW("door-schedule", A1)` through BHoM's Excel add-in pattern: a cell calls a graph on the toolkit host. (borrow from Excel UI's `CallerFormula`)
48. A BHoM toolkit named `BimOpenSchema_Toolkit`: an adapter whose Pull reads a BOS Parquet folder and whose Push writes one, published in BHoM's own organisation, so every BHoM user reads BOS with the installer they already have. (invert: the toolkit becomes a BHoM adapter)
49. Revive BHoM's IFC route: the toolkit's web-ifc parser and byte-exact property-set editing offered as the engine behind a new IFC adapter, replacing the dormant xBIM one. (what if we kept the one thing we are uniquely good at)
50. Notebook pages for Buro Happold's sample scripts (`BHoM/samples`, last pushed January 2024): each sample re-recorded as a toolkit notebook that opens with nothing installed. (workflow 1: look, then install one thing)
51. Teaching: BHoM's quarterly sprint cadence and the toolkit's public pages as material for a computational design course. (outside software: education)

### Minimal and deliberately bad

52. Ten lines: a C# script that references the `BHoM` and `BHoM.Engine` NuGet packages, serialises pulled objects to JSON, and a graph that starts with `json.read`. No BHoM dependency in the host. (extreme: ten lines)
53. Deliberately bad: replace BOS with the oM everywhere, so every wire carries BHoM objects. Its inversion: the toolkit stays tables, BHoM stays objects, and the only shared artefact is a mapping table and a flattener; a BHoM major version (10.0 in January 2027) then costs one regenerated mapping. (bad idea, then inverted)
54. Do nothing: a BHoM user pulls to Excel with the Excel UI and opens the workbook with `xlsx.read`. Document that path and count the steps. (what if we did nothing)

## Tensions

- **Objects against tables.** BHoM's value is rich typed objects with fragments and Engine methods over them; the toolkit's is one vocabulary of tables. Flattening loses the methods, and carrying objects through the graph breaks "tables are the currency". The mapping (idea 17) and the flattener (idea 2) decide how much survives.
- **In-process or out of process.** The NuGet core is .NET Standard 2.0 and loads in the `net8.0-windows` host; most adapters are built against .NET Framework 4.8 from DLLs in `C:\ProgramData\BHoM`, and the Revit adapter needs Revit running. In-process gives Engine methods as nodes; anything touching an adapter likely needs a separate process or the BHoM installer on the machine, which conflicts with workflow 1's one install.
- **Licence.** LGPL-3.0 against MIT: referencing the packages is fine, vendoring or modifying them is not. A node pack that depends on BHoM is a separate distributable with its own licence note.
- **Which user it serves.** The brief puts the BIM professional who writes no code first; BHoM's users are engineers who script in Grasshopper. Ideas 46, 47, and 48 serve BHoM's users on their own ground; 30, 31, 36, and 37 bring BHoM's capability to the toolkit's own user. Principle 9 says the first piece names one.

## Approaches

1. **File bridge** (ideas 52, 53 inverted, 54, 15): BHoM objects to JSON or Excel, read by `json.read` or `xlsx.read`. Good for testing the oM-to-BOS mapping on real ETABS and Revit pulls within a day, with no dependency; fails when a user wants a push back or a live pull.
2. **Engine methods as a node pack** (23, 24, 25, 26, 30, 31, 28, 29): reference the `BHoM.Engine` and `BHoM.Interop.LifeCycleAssessment` NuGet packages in one new pack, generate nodes by reflection, start with LCA and section properties. Good for workflow 2 and 4 and for the embodied-carbon pack the overview already names; in-process, no installer; fails if the useful methods need object inputs that a flattened table cannot rebuild, or if reflection-generated nodes swamp the catalog with thousands of entries.
3. **Adapters as sources and sinks with an MCP server** (1, 2, 3, 11, 12, 36, 37, 42, 43): `bhom.pull`, `sink.bhomPush`, `bhom.diff`, and `bimopen-bhom`. Good for reaching ETABS, Robot, Revit, IES and the rest, and for the Claude story with BHoM users; fails on install weight (the BHoM installer and each tool's licence on the machine) and on .NET Framework adapters that will not load in the host.
4. **Toolkit inside BHoM** (46, 47, 48, 49): a BOS adapter and a Grasshopper component that runs a graph, published to BHoM's ecosystem. Good for meeting BHoM's engineers in Grasshopper and Excel, and for giving BHoM a maintained IFC route; fails on BHoM's quarterly cadence and LGPL review, and serves the BHoM user rather than the brief's first user.
5. **Borrow ideas, not code** (44, 45, 21, 19): the upgrader pattern for graph documents, BHoMBot-style compliance checks over `NodeSpec`, and the relation vocabulary offered back. Good for the toolkit's own technical debt at no coupling; fails to give any BHoM user anything.

## Recommendation (soft; the user asked for evaluation afterwards)

Approach 2, scoped to life-cycle assessment first, with approach 1 as its test bench. The LCA engine is the most active BHoM repository after the core, it ships on NuGet for .NET Standard 2.0, it fills a pack the toolkit's overview already names, and "carbon from any IFC file with the unassessed elements shown" (ideas 31 and 33) is a result neither project gives today. The fact that decides it is whether `EvaluateProjectLifeCycleAssessment` and its inputs can be built from a quantities table without a Revit pull; a one-day spike with the NuGet packages answers that. Approach 3's MCP server (idea 36) follows only if a BHoM user asks for ETABS or Robot data through Claude, because the install weight cuts against workflow 1. Idea 44, the upgrader pattern, is worth a ticket on its own whatever is chosen.

## Decisions for the user

- Which workflow does the first BHoM work serve? Default: workflow 2 (a carbon question Claude answers over an IFC model, with BHoM's LCA engine behind the node), with workflow 4 (Engine methods as nodes without a host build) second.
- Is an LGPL-3.0 NuGet dependency acceptable in one node pack of an MIT repository? Default: yes, in a separate pack project with a licence note, never in the engine or host.
- In-process NuGet only, or the full BHoM installer and adapters? Default: NuGet only until a user needs a specific adapter.
- Is approach 4 (a BOS adapter inside BHoM's organisation) worth an approach to Buro Happold? Default: not before the LCA pack shows a result worth showing them.
- Does a BHoM arm go into the benchmark (idea 40)? Default: no; the benchmark compares the toolkit with a bare Claude session, and BHoM is not a question-answering tool.

## Sources checked on 2026-10-10

- https://github.com/BHoM and https://api.github.com/orgs/BHoM/repos (repository list, push dates, licences, stars, contributor counts)
- https://bhom.xyz/documentation/BHoM_Adapter/Adapter-Actions/ (Push, Pull, Move, Remove, Execute, Venn diagram)
- https://bhom.xyz/documentation/BHoM_oM/ (BHoMObject, IObject, IImmutable, no constructors)
- https://github.com/BHoM/documentation (Engine classes, technical philosophy, BHoM UI, BHoM releases, 2026 development cycle, BHoMBot, hashing and diffing, JSON schema, Revit toolkit identity, parameters, and material take-offs)
- https://github.com/BHoM/documentation/wiki/Versioning---How-to-modify-code-without-breaking-user-scripts (Versioning_XX.json, BHoMUpgrader)
- https://github.com/BHoM/LifeCycleAssessment_Toolkit/wiki and the repository tree (EPDs, indicators, stages, Engine methods)
- https://github.com/BHoM/OpenAI_Toolkit (ExecutePrompt adapter), https://github.com/BHoM/IFC_Toolkit (xBIM-based, dormant), https://github.com/BHoM/Speckle_Toolkit (dormant), https://github.com/BHoM/Revit_Toolkit, https://github.com/BHoM/Python_Toolkit, https://github.com/BHoM/BHoM_JSONSchema, https://github.com/BHoM/Excel_UI, https://github.com/BHoM/Dynamo_UI, https://github.com/BHoM/Grasshopper_UI (READMEs)
- https://www.nuget.org/profiles/BHoM and https://www.nuget.org/packages/BHoM/ (24 packages, downloads, .NET Standard 2.0, 9.3.0-alpha.6.0)
- https://aecmag.com/data-management/bhom-addressing-the-interoperability-challenge/ (1,200 object models, 30 software packages, use at Buro Happold, December 2024)
- https://speckle.community/t/speckle-and-bhom/547 (Speckle as server, BHoM as object model; seen through a search summary, the page itself returned 403)
