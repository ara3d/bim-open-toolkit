# That Open integration: brainstorm

> Brainstorm, 2026-10-10. A wide, unjudged list of ways BIM Open Toolkit could connect to That Open Company's open-source stack (https://github.com/ThatOpen), followed by the tensions, five grouped approaches, and a soft recommendation. Nothing here is decided; the next step is to pick ideas and evaluate them (the `platonic:investigate` skill for a spike, `platonic:no-new-wheels` for reuse). Facts about That Open were checked on 2026-10-10 against its GitHub repositories (shallow clones of `engine_components`, `engine_fragment`, `engine_web-ifc`, `platform_services`, `engine_templates`), the npm registry, docs.thatopen.com, and two press articles, and are marked **docs**; everything else is **inferred**. Earlier mentions in this repository: one row in `docs/CONTRIBUTIONS.md` ("web-ifc sits under the loader"), TKT-172 (read Fragments files into BOS), and TKT-171 (BCF 3.0 export).

## What That Open is, in the terms this repository uses

- **The company and its reach.** That Open Company started as IFC.js, a browser IFC toolkit. It says its SDKs serve more than 1,000 companies (RIB, Bosch, and Ferrovial are named) and a community of more than 10,000 developers. **docs** (AEC Magazine, 2026-07-21; the company's own figures). npm downloads for the week 2026-10-02 to 2026-10-08: `web-ifc` 184,468; `@thatopen/fragments` 100,641; `@thatopen/components` 77,478; `@thatopen/components-front` 52,171. GitHub: 1.4k followers on the organisation, 1,059 stars on `engine_web-ifc`, 711 on `engine_components`, 212 on `engine_fragment`. **docs**
- **web-ifc** (`engine_web-ifc`, npm `web-ifc` 0.0.78). A C++ IFC reader and writer compiled to WebAssembly for the browser and Node, also buildable as a native library. Licence MPL-2.0 (Mozilla Public License, a file-level copyleft) since February 2021; every other engine package is MIT. **docs** The toolkit already uses it: `Ara3D.IfcLoader` (in `deps/bim-open-data/src/data/`) calls a native build, `web-ifc-library.dll`, through `WebIfcDll.cs` for geometry, while STEP parsing is the toolkit's own. The `bimopen-ifc` MCP server's `ifc_to_bos` and analytics tools need that DLL, and `Ara3D.IfcMeshingComparison` uses web-ifc as the oracle that the toolkit's pure C# mesher (`Ara3D.Ifc.Mesher`) is scored against. **docs** (this repository)
- **Fragments** (`engine_fragment`, npm `@thatopen/fragments` 3.4.8, MIT). A binary format and a three.js runtime for large BIM models in the browser, run in a web worker, with culling and level of detail. The format is FlatBuffers (Google's zero-copy serialisation) with file identifier `0001` and one root `Model` holding: GlobalIds mapped to local ids; a category per item; `Meshes` (instanced `samples` that point at a material, a local and a global transform, and a `representation`, which is either a `Shell`, a polygon boundary representation with profiles and holes, or a `CircleExtrusion`, used for reinforcement bars); per-item `attributes` and `relations`, each stored as an array of strings; a `spatial_structure` tree; a list of relation names; user-defined `indexes` (flat key and value lookup tables in four shapes); and a JSON `metadata` string. **docs** (`packages/fragments/flatbuffers/index.fbs`) The README says the format "Supports geometries, properties, and relationships". The schema calls this generation "Fragments 2.0" while the npm package is at 3.4. **docs**
- **IFC import and export.** `IfcImporter` (in `@thatopen/fragments`) turns IFC into Fragments in the browser or in Node. There is no Fragments-to-IFC exporter; the README says more importers and exporters are planned. The model API has an `editor` for items, materials, and transforms, and `getBuffer()` saves a model back to bytes. IFC writing exists only at the web-ifc level. **docs**
- **Components** (`@thatopen/components` 3.4.9 and `@thatopen/components-front` 3.4.5, MIT). The building blocks of a viewer: worlds, cameras, raycasting, clipping, grids, viewpoints, a classifier, an items finder, a hider, bounding boxes, an `IfcLoader`, technical drawings with a DXF exporter; in the front package a highlighter, hoverer, outliner, measurements (length, angle, area, volume), and civil alignment navigators. Peer dependencies: `three >=0.182.0`, `web-ifc >=0.0.77`. **docs**
- **IDS and BCF.** `IDSSpecifications` in `@thatopen/components` reads and writes IDS (Information Delivery Specification, buildingSMART's XML for data requirements) and tests a loaded Fragments model against all six facets (entity, attribute, property, classification, material, part-of). Source comments say bounded and table property values are not supported and unit conversion is still to do. `BCFTopics` reads and writes BCF (BIM Collaboration Format, the issue exchange file) in versions 2.1 and 3. **docs** (source)
- **UI** (`@thatopen/ui` 3.4.14 and `@thatopen/ui-obc` 3.4.3, MIT). Lit web components, with chart.js for charts; `ui-obc` binds them to the components (model trees, property tables). `ui-obc` pins `three` 0.185.0, the version line the toolkit's viewer uses (`^0.185.0` in `deps/bim-open-viewer/package.json`). **docs**
- **That Open Platform** (platform.thatopen.com). A hosted common data environment (CDE: the shared store a project's files live in) with roles and permissions, versioning, app hosting, pre-made apps including a model checker, and Revit and Rhino streaming. Founding membership opened on 2026-06-22 for one week. No public price was found. **docs** (AEC Magazine, OSArch) The client and CLI, `@thatopen/services` 0.19.0, are MIT; the private beta engine libraries (`@thatopen-platform/*-beta`) are for founding members only. This is the paid part of the stack. **docs** (`platform_services/README.md`) Apps run in the platform's browser UI. Cloud components are server-side jobs; the built-in ones convert IFC to Fragments, LAS point clouds to Potree octrees, and Gaussian splats. Writes are limited to 30 a minute and component runs to 20 a minute per user. **docs**
- **That Open Flow.** A collaboration layer on the platform, not a node graph. Native files (`.rvt`, `.3dm`) stay unconverted; each application's plugin publishes a `.frag` of the model plus a commit history (`guid`, `parents`, `author`, `changes` as create, update, or delete per item). Anyone, "a script (automation), a model ... suggesting something (AI)", writes a **proposal**, shaped like a commit, that the owner of the native file accepts or rejects. **docs** (`platform_services/docs/flow-architecture.md`) The name collides with BimOpenFlow; the idea of a proposal that has not happened yet is close to the toolkit's "nothing writes until Run". **inferred**
- **AI and MCP.** The platform ships `thatopen mcp`, an MCP server with two tools, `platform-status` and `send-app-command`, that lets Claude Code drive a running That Open app over a socket channel. The docs include an `ai-quickstart.md` addressed to an AI assistant and an `AGENTS.md`. AEC Magazine reports that every demo was built with Claude Code, including a model checker with GIS made in about ten minutes. **docs** That Open's AI story is "Claude writes the app"; the toolkit's is "Claude answers the question and keeps the graph". **inferred**
- **Claude skills.** The OpenAEC Foundation lists `thatopen-claude-skill-package` on skills.sh: 18 skills (MIT, by Impertio Studio) for building viewers on That Open Engine 3.3.x, such as `thatopen-core-fragments`, `thatopen-impl-bcf`, `thatopen-impl-federation`, and `thatopen-agents-model-analyzer`, with 90 installs. There is no IDS skill. **docs**
- **Older and side projects.** `web-ifc-three`, the original three.js IFC loader (MIT, last updated April 2024), and `engine_clay`, a "Lightweight BIM modelling engine" (MIT, last updated October 2024). `create-bim-app` scaffolds a Vite app. **docs**

## Brainstorm

Goal: find where That Open's stack and the toolkit fit together so that a That Open user (a developer with a `.frag` viewer, or a platform customer) gets something they cannot get today, and the toolkit gets a faster IFC path, a widely used browser viewer, a format its audience already holds, and a distribution channel of more than 10,000 developers, without giving up its principles (one edit path, nothing writes until Run, honest absence, runs as evidence, tables as the currency).

Ideas, grouped by where the data moves. Tags name the prompt that produced the idea.

### Fragments as a source

1. A `frag.load` node: a `.frag` file in, the three BOS tables (entities, parameters, relations) and the geometry out, cached by content hash. TKT-172 already specifies the reader in `Ara3D.BimOpenSchema.IO.Fragments`; the node is a thin wrapper. (extends `bos.load` in `src/flow/BimOpenFlow.Nodes.Bos` and the `ModelRef` parameter kind)
2. An `ifc_open`-style MCP tool, `frag_to_bos`, beside `ifc_to_bos` in `BimOpenMcp.Ifc`: a That Open user hands Claude the `.frag` their viewer already loads and asks questions over DuckDB. (extends `deps/bim-open-data/src/mcp/BimOpenMcp.Ifc`)
3. Read the Fragments `indexes` table as extra BOS parameters: a That Open app that stored "items with issues" or "zone per item" brings those lookups into SQL without a mapping. (what if the format already carried our data)
4. The `spatial_structure` tree as BOS `ContainedIn` and `PartOf` relations, checked against the IFC-derived ones: a disagreement table shows where the importer and the toolkit read the spatial tree differently. (biology: redundancy, two readers and one diff)
5. Fragments attributes are arrays of strings. Keep each value's type only where the file states it and leave the rest as text with a warning, never a guessed number: honest absence applied to a format that flattens types. (a deliberately bad idea, parse every string as a number, and its inversion)
6. A whole platform project's `.frag` files, one per discipline, loaded as a federated BOS through `Ara3D.BimOpenSchema.Federation`. (extreme: fifty models)
7. A Revit model with no IFC export: the platform's Revit plugin publishes a `.frag` and a commit history, the toolkit reads the `.frag`. The brief rules out a live link to any authoring tool; the platform is that link, built by someone else. (what if the problem moved to someone else)
8. Commit history as a time axis: `revitflow_history.json` read into a table of commits, and a `frag.diff` node over two commits' changed items, giving "what changed in the structural model this week" as a table. (invert: one model becomes a series)

### web-ifc, shared underneath

9. Upgrade the pinned native `web-ifc-library.dll` to 0.0.78 and record the version in the run record, so a run says which parser made its geometry. (runs are the evidence)
10. web-ifc's WebAssembly build in the browser behind the notebook: a public sample page opens an IFC file with nothing installed and answers counts with DuckDB-wasm (workflow 1). (extreme: zero install)
11. Use web-ifc's Node build as a second IFC parser in the benchmark harness and score the toolkit's answers against answers derived through web-ifc directly: a parser-level arm for workflow 5. (borrow from testing: an oracle)
12. Report the toolkit mesher's discrepancies from `Ara3D.IfcMeshingComparison` upstream as web-ifc issues with the failing IFC lines, so both meshers improve. (economics: shared maintenance)
13. Drop web-ifc entirely once `Ara3D.Ifc.Mesher` passes its scorecard, ending the native DLL and the `net8.0-windows` target. Deliberately the opposite of integration, listed so the cost of the dependency is visible. (deliberately bad, then weighed: the MPL-2.0 licence is fine for an unmodified library, so the reason to drop it is portability, not licence)

### Fragments as a sink

14. A `sink.exportFrag` effect node: a BOS model, or a filtered subset, written as a `.frag` that any That Open viewer opens. Run-gated like the other sinks in `BimOpenFlow.Nodes.Effects`. (invert: source becomes sink)
15. Write toolkit results into the `.frag` itself as `indexes` (verdict per item, room per element, carbon per element) so a That Open app shows them with no toolkit code. (what if nobody opened the toolkit)
16. BOS-to-Fragments as the toolkit's web delivery format: the Snowdon model (about 450,000 instances) streamed by Fragments' worker and level-of-detail code instead of the toolkit's own loader. (extreme: the largest model)
17. A Fragments exporter for every BOS source: Revit add-in exports, the DuckDB export, Speckle data. That Open has an IFC importer only and says more are planned; the toolkit could be the second importer, built from BOS. (what if we supplied what they lack)
18. Byte-exact IFC write-back for Fragments users: there is no Fragments-to-IFC exporter, so an edit made in a That Open app (through the `editor`) cannot reach the original IFC. The toolkit's `Ara3D.Ifc.Editing` could apply property edits, matched by GlobalId, to the original bytes. (what if we kept the one thing we are uniquely good at)

### The viewer

19. A That Open viewer pane in the studio beside the toolkit's 3D pane: `view3d.color` and `view3d.isolate` outputs sent to the Fragments highlighter and hider by GlobalId. Both use three.js 0.185, so one page can host both. (recombine)
20. The reverse: a `@bim-open-viewer/loaders` reader for `.frag`, so the toolkit's viewer opens That Open files. (extends `deps/bim-open-viewer/packages/loaders`)
21. Measurements, clipping, civil alignment navigation, and technical drawings with DXF export come from `components-front` for free; the toolkit's viewer has none of the civil or drawing features. (what if it already existed)
22. A picture of the model for workflow 3 rendered headless by a That Open viewer in Node, as a second renderer for the capture step. (borrow from printing: two presses, one proof)
23. Selection both ways: a click in a That Open viewer sets the toolkit's selection, so "Claude knows what is selected" (principle 7) works inside someone else's viewer. (extends the editor's selection contract)
24. `@thatopen/ui` tables and charts as alternative renderers for `view.table` and `chart.bar` results in a That Open app. (recombine: same table, their widget)

### IDS and BCF

25. An IDS parity arm: run the same `.ids` file through `Ara3D.Ids` (TKT-50, in `deps/bim-open-data/src/data/Ara3D.Ids`), IfcOpenShell's `ifctester`, and That Open's `IDSSpecifications`, one verdict table per checker, and publish the disagreements. (biology: redundancy)
26. Fill That Open's stated gaps: bounded and table property values and unit conversion are not supported in their IDS code. The toolkit's evaluator could report those facets as "not available" rather than pass, and the comparison shows which checker is honest. (honest absence)
27. A `check.ids` verdict table written as a `.bcf` (the writer in `Ara3D.BimOpenSchema.IO.Bcf`, TKT-171) that a That Open app opens through `BCFTopics`, with viewpoints framing the failing elements. (extends TKT-171)
28. Import BCF topics from a That Open app as a table with GlobalIds, then join to BOS: "which storeys collect the most open issues". (recombine: issues plus `bim.containment`)
29. An IDS authored in a That Open app's UI, saved as XML, then run by the toolkit over a model too large for the browser. (extreme: a model the browser cannot hold)

### That Open Platform and That Open Flow

30. A toolkit graph as a platform cloud component: a new `.frag` version triggers a named graph and writes a verdict file. Reaches paying founding members. (manufacturing: an inspection station on the conveyor)
31. Toolkit results as That Open Flow proposals: a Run that would set properties instead publishes a proposal (a patch over published fields), and the model's owner accepts it in Revit. "Nothing writes until Run" becomes "nothing writes until someone accepts". (recombine: two systems with the same deferred-write idea)
32. The proposal as the toolkit's Run record: a proposal's `parents` pin the commit it was computed against, which is the content-hash pinning that "runs are the evidence" asks for. (what if it were a convention instead of a tool)
33. Read a platform project through `@thatopen/services` (`PlatformClient`: files, folders, versions) with a local poller, so a free local toolkit follows a hosted project without running in their cloud. (invert: push for pull)
34. A toolkit app on the platform: the notebook or a dashboard published as a platform app, scaffolded with `thatopen create`. (borrow from app stores)
35. The platform's model checker against the toolkit's checks on the same model and the same rules: which finds more real failures, which explains its verdict. (competition as a test)
36. Respect the rate limits by design: 30 writes a minute fits one Run that writes once, not an evaluate loop that writes per change, which the toolkit already forbids. (what if the limit were the feature)

### Claude and the AI story

37. A `bimopen-frag` MCP server, or two tools on `bimopen-ifc`: open a `.frag`, list categories, run SQL, export a verdict back as indexes. Same shape as the existing servers. (extends the two MCP servers in `.mcp.json`)
38. Bridge the two MCP servers: Claude asks the toolkit for the answer, then calls `thatopen mcp`'s `send-app-command` to colour the result in the user's open That Open app. Their server drives an app; ours answers questions. (recombine)
39. Add the missing skills to the OpenAEC package: a `thatopen-ids` skill and a "question to answer" skill that points at the toolkit, so the 18-skill package covers analysis as well as viewer building. (economics: contribute to the channel the audience already installs)
40. A benchmark arm for That Open's approach: Claude Code writes a That Open app to answer each benchmark question (their demo style), scored on correctness, time, and tokens against the toolkit arm and the bare arm (workflow 5). (what if a competitor did it their way)
41. Claude writes a That Open app from a toolkit graph: the graph is the specification, the app is generated, and the run record says whether the app's numbers match. (what if code were the output, not the answer)
42. Positioning: That Open's agents build software for BIM developers; the toolkit answers questions for BIM professionals who write no code (TKT-1). A one-paragraph comparison in `docs/CONTRIBUTIONS.md`. (what if we did nothing: people assume the two overlap)

### Ecosystem, community, and far-fetched

43. Public sample models published as `.frag` beside `.bos` on the public pages, so That Open developers try the toolkit on files their viewer already opens (workflow 1). (what if a file format were the integration)
44. A talk or tutorial in That Open's community ("query your `.frag` with Claude and DuckDB"), the largest open-source web BIM developer audience. (outside software: distribution)
45. Use That Open's Gaussian splat and point cloud converters to put site captures beside a BOS model, and the toolkit's `spatial.*` nodes to measure deviation. (far-fetched: reality capture meets BIM data)
46. `engine_clay`, their modelling engine, as a way to author simple geometry that the toolkit then checks. Authoring is out of scope in the brief; listed because it is the one way geometry editing could arrive without the toolkit building it. (far-fetched, out of scope)

### Minimal and deliberately bad

47. Ten lines: a Node script with `@thatopen/fragments` that dumps a `.frag`'s GlobalIds, categories, and attributes to CSV, and a graph that starts with `csv.read`. No FlatBuffers code in the toolkit. (extreme: ten lines)
48. Deliberately bad: rewrite the toolkit's viewer and loader on `@thatopen/components` and store BOS as Fragments. Its inversion: keep BOS as the store and Fragments as one import and export format among GLB, USD, and BCF, so a change to the Fragments schema touches one library. (bad idea, then inverted)
49. Do nothing: a That Open user exports IFC from their source and opens it in the toolkit; their `.frag` is a derived file anyway. Document that path and count its steps. (what if we did nothing)

## Tensions

- **Format coupling against reach.** Reading and writing `.frag` reaches the users of a package downloaded about 100,000 times a week, but ties a library to a FlatBuffers schema that has already changed once (Fragments 2.0) and whose attributes are untyped strings. Going through IFC costs nothing to maintain and loses the edits and indexes that only exist in `.frag`.
- **Whose viewer.** The toolkit's viewer is BIM-free and shaped around one edit path; That Open's components bring measurements, drawings, civil tools, and a large user base. Hosting both risks two ways to colour the same element, which principle 1 forbids; replacing one wastes the work in `deps/bim-open-viewer`.
- **Open engine against paid platform.** Everything useful for a file bridge is MIT or MPL-2.0. The parts with live data (Revit and Rhino streaming, commit histories, cloud components, proposals) are on the paid platform with private beta libraries and rate limits. The toolkit's audience today is not that platform's founding members.
- **Which workflow it serves.** Ideas 2, 37, and 43 serve workflow 1 (look, then install one thing) and workflow 2; 14, 15, 19, and 27 serve workflow 3; 11, 25, and 40 serve workflow 5. Principle 9 says the first piece of work names one.

## Approaches

1. **File bridge** (ideas 1, 2, 47, 49, 43): read `.frag` into BOS (TKT-172) and expose it through `bos.load`-style nodes and one MCP tool. Good for letting That Open users ask Claude about files they already have, at the cost of one library with a pinned schema; fails when the user wants the platform's history, proposals, or anything live.
2. **Round trip through Fragments** (14, 15, 17, 18, 20): write `.frag` with verdicts as indexes, and a `.frag` loader in the toolkit's viewer. Good for workflow 3, because results appear in viewers the user's colleagues already run; fails if the Fragments schema changes faster than the writer, or if index conventions differ between That Open apps.
3. **Shared open standards** (25, 26, 27, 28, 29): meet That Open at IDS and BCF rather than at its format. Good because both sides already implement the standards, the work is mostly already filed (TKT-50, TKT-171), and a three-checker IDS comparison is a result nobody has published; fails to give That Open users anything they cannot get from their own IDS checker unless the comparison shows a real difference.
4. **Platform participant** (30, 31, 32, 33, 34, 36): the toolkit as a cloud component and a proposal author on That Open Platform. Good for the strongest conceptual fit (proposals and Run are the same idea) and for paying customers; fails for everyone without a membership, depends on private beta libraries, and moves the run record into someone else's store.
5. **Two-server Claude bridge** (37, 38, 39, 42): `bimopen-frag` plus `thatopen mcp`, with skills that tell Claude which server does what. Good for the AI story with little code, because each server keeps its job; fails if the user has no running That Open app, since `send-app-command` needs an open tab.

## Recommendation (soft; the user asked for evaluation afterwards)

Approach 1 first, with approach 3 beside it. TKT-172 already specifies the reader, and a `.frag` read into BOS tests the fact that decides every other idea: whether Fragments' string-typed attributes and relations map onto BOS parameters and relations without loss. The test is the acceptance criterion already in the ticket, matching the Duplex's element count, GlobalIds, and storey containment against the BOS made from the same IFC. If that holds, `frag_to_bos` is one MCP tool and the writer in approach 2 is the reverse of a mapping already proven. Approach 3 is cheap because `Ara3D.Ids` and the BCF writer exist, and a published comparison of three IDS checkers is the first thing a That Open developer would notice. The tension that decides the order is open engine against paid platform: approach 4 has the best conceptual fit, a Run as a proposal, but should wait until a user with a platform membership asks for it.

## Decisions for the user

- Which workflow does the first That Open work serve? Default: workflow 2 (a `.frag` as the model Claude asks about, through TKT-172), with workflow 3 (verdicts back into a That Open viewer as BCF or indexes) second.
- Is a `.frag` writer in scope, or only a reader? Default: reader only until the reader's round-trip test passes; TKT-172 already leaves the writer out.
- Does the toolkit's viewer read `.frag`, or does the studio host a That Open viewer pane? Default: neither yet; decide after the reader exists, because principle 1 rules out two colouring paths.
- Does That Open's IDS checker join the IDS parity run (idea 25)? Default: yes, as a third column beside `ifctester` once TKT-50's evaluator passes its own parity test.
- Any platform work before a member asks? Default: no; record approach 4 as a deferred design note, with the naming collision between That Open Flow and BimOpenFlow noted for TKT-4 (the user-facing noun).

## Sources checked on 2026-10-10

- https://github.com/ThatOpen (repositories, stars, licences, last updates)
- https://github.com/ThatOpen/engine_fragment (README; `packages/fragments/flatbuffers/index.fbs` for the schema; `src/Importers/IfcImporter`; `src/FragmentsModels/src/edit`)
- https://github.com/ThatOpen/engine_components (`packages/core/src/openbim/IDSSpecifications` and `BCFTopics`; `packages/front/src`)
- https://github.com/ThatOpen/engine_web-ifc (README; `LICENSE.md` history: MPL-2.0 added 2021-02-26)
- https://github.com/ThatOpen/platform_services (README; `docs/flow-architecture.md`, `docs/flow-plugin-guide.md`, `docs/ai-quickstart.md`, `docs/cli/mcp.md`, `docs/rate-limits.md`, `docs/cloud/`)
- https://github.com/ThatOpen/engine_templates (`create-bim-app`)
- https://registry.npmjs.org/ and https://api.npmjs.org/downloads/ (versions, licences, peer dependencies, weekly downloads)
- https://docs.thatopen.com/intro and https://docs.thatopen.com/Tutorials/Fragments/Fragments/FragmentsModels/
- https://aecmag.com/software/that-open-company-raises-the-stakes/ (platform features, community figures, Claude Code demos; 2026-07-21)
- https://osarch.org/2026/06/06/that-open-platform-founding-member-launch/ (launch date)
- https://skills.sh/openaec-foundation and https://github.com/Impertio-Studio/ThatOpen-Claude-Skill-Package (the 18-skill package)
