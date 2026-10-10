# Speckle integration: brainstorm

> Brainstorm, 2026-10-10. A wide, unjudged list of ways BIM Open Toolkit could connect to Speckle (https://github.com/specklesystems), followed by the tensions, five grouped approaches, and a soft recommendation. Nothing here is decided; the next step is to pick ideas and evaluate them (the `platonic:investigate` skill for a spike, `platonic:no-new-wheels` for reuse). Facts about Speckle were checked on 2026-10-10 against docs.speckle.systems and speckle.systems and are marked **docs**; everything else is **inferred**. The only earlier mention in this repository is one row in `docs/CONTRIBUTIONS.md`: "Speckle could feed it".

## What Speckle is, in the terms this repository uses

- **Server and data model.** An open-source server with a GraphQL API and an object store. Data is organised as projects, models, and versions; a version is immutable and identified by id. **docs** The 2026.9 release replaces the tree-of-objects graph with "a columnar property store for fast querying and aggregation, and an explicit relational layer describing how elements relate to one another: containment, connectivity, systems, materials". The SDK entry point is `operations.receive3`, returning a `Model` with columnar properties and typed relations. Compatibility mode for the old format ends 2026-11-01. This is close to BIM Open Schema (BOS), which is entities, parameters, and relations as tables.
- **Connectors.** Publish and receive from Revit, Rhino, Grasshopper, Archicad, SketchUp, Blender, Navisworks, Tekla, Civil 3D, QGIS, Excel, and others; a read-only Power BI connector that loads model data as rows; a server-side IFC importer (IFC2x3 to IFC4x3). **docs**
- **SDKs.** .NET (`speckle-sharp-sdk`), Python (`specklepy`), and a JavaScript object loader. A three.js viewer with filtering, colouring, and URL-encoded state. **inferred** from the repositories' names and earlier releases.
- **Automate.** Runs a function when a new version is published; the only trigger is version creation; available only on Speckle Enterprise Server. **docs**
- **Intelligence.** An AI assistant in the web app and viewer that answers questions about properties, containment, connectivity, versions, and changes; makes charts and colours the viewer; saves "Reports"; has reusable "skills" (playbooks for colour themes, cost, carbon) and standing "AI Rules". Works only on versions in the new format, and only on workspace plans that include it. **docs**
- **OpenAEC Foundation** publishes a `speckle-claude-skill-package` of 25 Claude skills (core API, data validator, model coordinator, Power BI, Automate). **docs** (skills.sh listing)

## Brainstorm

Goal: find where Speckle and the toolkit fit together so that a Speckle user gets something they cannot get today, and the toolkit gets live, versioned, multi-tool model data and a distribution channel, without giving up its principles (one edit path, nothing writes until Run, runs as evidence, tables as the currency).

Ideas, grouped by where the data moves. Tags name the prompt that produced the idea.

### Speckle as a source

1. A `speckle.load` node: project, model, and version in, the three BOS tables (entities, parameters, relations) out. Pure, cached by version id. (extends `bos.load` in `src/flow/BimOpenFlow.Nodes.Bos`, which already turns one file into three tables keyed by content hash; the version id is the key here, and the `ModelRef` parameter kind already names a model)
2. The version id is the content hash. A run record that pins a Speckle version id satisfies "runs are the evidence" with no extra hashing, and anyone with the id replays it. (what if it were a convention instead of a tool)
3. A BOS-to-Speckle mapping specification: columns of the 2026.9 property store to BOS parameters, the relational layer to BOS relations, element to entity. If both are columnar, the conversion may be column renames plus unit harmonisation. (what if it already existed as a format)
4. Live data from Revit, Rhino, Archicad, and Tekla without writing an add-in: the connectors publish, the toolkit receives. The brief rules out a direct link to any authoring tool; Speckle is that link, built by someone else. (what if the problem moved to someone else)
5. A `speckle.diff` node: two versions in, a table of added, removed, and changed elements with the changed property names out. Versions are the time axis the toolkit lacks. (invert: one model becomes a series)
6. A `speckle.projects` node and a run-over-every-model loop: the same graph over a whole workspace, one row per model. This is the multi-building question of TKT-21 with Speckle supplying the corpus. (extreme: a thousand models)
7. Speckle comments and issues as a table with their 3D anchor, then a spatial join: "which rooms have open comments", "which discipline's elements collect the most issues". (recombine: comments plus `spatial.*` nodes)
8. Speckle's federated-model view as the input to the Snowdon-style merge: several discipline models loaded as one, identity resolved by the toolkit's correspondence table (`docs/proposals/snowdon-federation.md`). (recombine)
9. Geometry from Speckle meshes into `view3d.instances`, or the toolkit's viewer reading the Speckle object loader directly, so a coloured 3D view needs no IFC. (what if the obvious approach, IFC, were forbidden)
10. Speckle as the identity service across versions: element ids that survive a re-publish answer the "same storey in seven files" problem for the connector sources. (borrow from databases: stable keys)
11. Time-series analytics over project history: embodied carbon per design iteration, element count per week, when a discipline's model last moved. (extreme: a million versions)
12. The first empty version's property schema pre-wires a graph before the data exists: column names from Speckle, warnings not errors, "warn, never block". (extreme: an empty model)

### Speckle as a sink

13. A `sink.speckle` effect node: a table becomes a new version, or new properties on existing elements. "Nothing writes until Run" maps onto "a version is a publish". (invert: source becomes sink)
14. Rule-check verdicts pushed as properties, then coloured in the Speckle viewer and read by the Power BI connector: distribution to colleagues for free, the toolkit's workflow 3 without a host. (what if nobody opened the toolkit)
15. Verdicts to Speckle, then the Revit connector receives them and sets parameters in Revit. The toolkit writes to Revit without touching Revit. (recombine 13 and 4)
16. A report or notebook attached to a version, or posted as a comment with the graph that made it, so the evidence travels with the model. (library: a review filed against an edition)
17. The graph itself published as a Speckle object in a "workflows" model: graphs get Speckle's versioning, sharing, and diff. (what if it were data instead of code)
18. A toolkit result as a Speckle viewer URL: filters and colours encoded in the link, the picture of the model (workflow 3) as a shareable page nobody installs. (what if it had to be a URL)
19. BOS files stored as blobs on a Speckle version: publish a BOS once, everyone downloads it from the server instead of from a private path. (what if a file format were the integration)
20. Byte-exact IFC write-back for Speckle users: Speckle imports IFC but a re-export is a new file. The toolkit's write-back could apply changes made in Speckle to the original IFC bytes. This is something nobody else in Speckle's ecosystem does. (what if we kept the one thing we are uniquely good at)

### Where the computation runs

21. An Automate function that wraps the toolkit host: a new version runs a named graph and posts results with object annotations. Enterprise-only today, so it reaches the paying customers. (manufacturing: an inspection station on the conveyor)
22. The inverse: the toolkit watches for new versions by polling or webhook and runs locally. Works on the free tier, keeps compute and data on the user's machine. (invert: push for pull)
23. The toolkit as a function runtime: a graph is a function, the catalog is the function library, and a Speckle user who cannot write Python wires one instead. (what if a person who writes no code had to author an Automate function)
24. Speckle's server as the toolkit's store: analyses, runs, and results as Speckle objects, replacing `BimOpenFlow.Host.Store`. (deliberately far: swap the whole store)
25. No host at all: DuckDB-wasm in the browser over data pulled by the object loader, a toolkit pane embedded in the Speckle web app. (extreme: zero install)
26. Incremental re-evaluation: `speckle.diff` tells the engine which elements changed, and only the nodes whose inputs touch them re-run. (compilers: incremental recomputation)
27. Public checks: toolkit rule graphs published as community Automate functions, each with its catalog entry. (economics: a marketplace of checks)

### Claude and the AI story

28. A `bimopen-speckle` MCP server beside `bimopen-ifc` and `bimopenflow-duckdb`: list projects, load a version as BOS, diff, publish. Same shape as the existing servers, so the cost is low. (extends the two MCP servers in `.mcp.json`)
29. Positioning against Speckle Intelligence: Intelligence is in-app, plan-gated, new-format-only, and its reasoning is not a replayable graph; the toolkit is local, in Claude Code, and keeps the workflow as evidence. "Intelligence for any model, with the graph kept." (what if we did nothing: Intelligence covers the easy questions and the toolkit looks redundant)
30. A third benchmark arm: the committed question set run through Speckle Intelligence, scored on correctness, time, and tokens next to the toolkit arm and the bare arm (workflow 5). (what if a competitor did it by hand)
31. Speckle "skills" and "AI Rules" are playbooks; toolkit templates are graphs. Export a graph as a Speckle skill, or import a skill as a graph scaffold. (recombine)
32. Bundle or cite the OpenAEC `speckle-claude-skill-package` so Claude Code users get Speckle's API and the toolkit's nodes in one install (workflow 1). (what if it already existed)
33. Claude writes the Automate function from the open graph: script node (workflow 4) plus Speckle's function template. (recombine 23 and workflow 4)
34. A silent validator: nobody reads output; the toolkit posts only failures, as comments on the offending elements. (extreme: nobody reads it)

### Ecosystem and customers

35. Power BI users keep Power BI; the toolkit writes the DuckDB or Parquet they read, with the derivation recorded. Users without Power BI get the chart pane instead. (what if the requirement, a dashboard tool, were dropped)
36. QGIS and Civil 3D users: Speckle brings site and terrain, the toolkit's `spatial.*` nodes do the geometry. (recombine)
37. Excel users: `sink.exportXlsx` exists; a Speckle version to Excel to a checked Excel back to a version. (what if a person did it)
38. Grasshopper and Dynamo users already think in graphs; the toolkit graph exported as a Grasshopper definition, or Grasshopper feeding a toolkit graph through Speckle. (far-fetched)
39. Public benchmark models (Duplex, Schependomlaan, IFC-Bench) published to a public Speckle project, so anyone tries the toolkit on them with no file download. (workflow 1: look, then install one thing)
40. Teaching: Speckle's free tier plus the toolkit's public pages as course material; students are Speckle's largest free audience. (outside software: education)
41. Speckle's IFC importer as the toolkit's IFC parser for users who already upload there, and the toolkit's parser as a check on the importer: two parsers, one diff table. (biology: redundancy)
42. Remembered failures: rule checks that keep a per-project history of what failed before and flag regressions first. Speckle's AI Rules are standing instructions; this is standing memory. (biology: immune memory)
43. A price on a run: Speckle credits per Automate run, the toolkit reporting its own token and time cost per answer, so a customer compares. (economics: prices as signals)

### Minimal and deliberately bad

44. Ten lines: a script that calls specklepy, dumps the property store to Parquet, and a graph that starts with `parquet.read`. Almost no code, no SDK dependency in the host. (extreme: ten lines)
45. Deliberately bad: move the toolkit into Speckle's monorepo as a plugin and adopt their object model everywhere. Its inversion: zero Speckle code in the toolkit; integrate only through files (Parquet, BOS blobs) and URLs, so the 2026-11 migration and every later one costs nothing. (bad idea, then inverted)
46. Do nothing: a Speckle user exports IFC (or Parquet via Power BI's extraction) and opens it in the toolkit by hand. Document that path and measure how many steps it is. (what if we did nothing)

## Tensions

- **Coupling depth against value.** The SDK gives versions, diffs, and live connectors; it also brings a data model that is changing this quarter (compatibility ends 2026-11-01) and a .NET dependency in the host. A file bridge costs nothing to maintain and gives none of the live features.
- **Where compute runs.** Automate reaches paying Enterprise customers and runs on publish; local polling works for everyone, keeps data on the machine, and keeps the evidence package under the toolkit's control.
- **Complement or compete with Intelligence.** Speckle now answers questions in its own app. The toolkit's claim has to be something Intelligence does not do: any model from any source, a replayable graph, byte-exact write-back, a benchmark number.
- **Which workflow it serves.** Ideas 39 and 32 serve workflow 1 (look, then install one thing); 1, 5, 28 serve workflow 2; 14, 18, 16 serve workflow 3; 30 serves workflow 5. The brief's principle 9 says work starts by naming one.

## Approaches

1. **File bridge** (ideas 44, 45 inverted, 46, 19): a script dumps a version to Parquet or BOS; graphs start from `parquet.read` or `bos.load`. Good for proving the mapping in a day and surviving Speckle's migration untouched; fails when a user wants versions, diffs, or anything live.
2. **Source nodes and an MCP server** (1, 2, 3, 5, 6, 28, 12): `speckle.load`, `speckle.diff`, `speckle.projects`, and `bimopen-speckle` for Claude Code. Good for workflow 2 and the Claude story, and the version id as evidence hash is a clean fit; fails if the 2026.9 property store does not map onto BOS without loss, or if the SDK churns.
3. **Round trip** (13, 14, 15, 18, 20, 16): results published back as properties, comments, attachments, and viewer links; byte-exact IFC write-back for Speckle's IFC users. Good for workflow 3, the thing Speckle customers would notice first (their viewer and Power BI light up with the toolkit's verdicts); fails when "nothing writes until Run" meets a Speckle workflow that expects every evaluation to publish.
4. **Automate runtime** (21, 23, 27, 33, 34): the toolkit host as an Automate function, graphs as functions. Good for Enterprise customers and automatic runs on every publish; fails for everyone else, and the host would have to run in Speckle's container with no local store.
5. **Speckle-hosted toolkit** (24, 25, 26, 9): no local host; DuckDB-wasm in the browser over the object loader, embedded in the Speckle web app. Good for zero install; fails on Snowdon-size models in a browser tab and would fork the host.

## Recommendation (soft; the user asked for evaluation afterwards)

Approach 2 built on top of approach 1: start with the file bridge to test idea 3, the BOS-to-2026.9 mapping, because that one fact decides whether every other idea is cheap or expensive. If the property store and relational layer map onto BOS tables, `speckle.load` is a thin node and the MCP server follows the existing two. The tension that decides it is coupling depth: the migration deadline of 2026-11-01 means any SDK work started now targets the new model only, and the file bridge is the fallback if the SDK is not stable by then. Approach 3's viewer-link idea (18) and the verdicts-as-properties idea (14) are the cheapest way to show a Speckle customer value and should be the second investigation.

## Decisions for the user

- Which workflow does the first Speckle work serve? Default: workflow 2 (a Speckle version as the model Claude asks about), with workflow 3 (share through the Speckle viewer) second.
- Free tier or Enterprise first? Default: free tier (local polling and source nodes), since Automate and Intelligence are plan-gated and the toolkit's audience today is not Enterprise.
- Does a Speckle account go into the benchmark (idea 30)? Default: yes, as a third arm, once the committed question set exists (TKT-8).
- Is a .NET dependency on `speckle-sharp-sdk` in the host acceptable, or should the bridge stay a Python script until the 2026.9 SDK settles? Default: script until 2026-11, then decide.

## Sources checked on 2026-10-10

- https://docs.speckle.systems/developers/migration/data-model-migration (new data model, `receive3`, dates)
- https://docs.speckle.systems/next/analytics/intelligence (Intelligence entry points, skills, AI Rules, limits)
- https://docs.speckle.systems/next/developers/automate/introduction (Automate 2026.9, Enterprise-only, version trigger)
- https://speckle.systems/integrations/power-bi/ and https://speckle.systems/integrations/ifc/ (Power BI connector, IFC importer)
- https://skills.sh/openaec-foundation (the Speckle Claude skill package)
