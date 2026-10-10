# iTwin integration: brainstorm

> Brainstorm, 2026-10-10. A wide, unjudged list of ways BIM Open Toolkit could connect to Bentley's iTwin platform and its open-source library iTwin.js (https://github.com/iTwin), followed by the tensions, five grouped approaches, and a soft recommendation. Nothing here is decided; the next step is to pick ideas and evaluate them (the `platonic:investigate` skill for a spike, `platonic:no-new-wheels` for reuse). Facts about iTwin were checked on 2026-10-10 against itwinjs.org, developer.bentley.com, bentley.com, the npm registry, and the GitHub API, and are marked **docs**; everything else is **inferred**. This repository had no earlier mention of iTwin or Bentley; `docs/proposals/ids-reuse.md` mentions an `IModel` type, but that is xBIM's, not Bentley's iModel.

## What iTwin is, in the terms this repository uses

- **iModel.** "A distributed relational database, based on SQLite, with a schema defined by BIS" (Base Infrastructure Schemas). Every user holds a full copy, called a briefcase, and copies are kept in step by changesets through iModelHub, a cloud service that works like git for the database. **docs** One iModel is one file: the toolkit's BOS (BIM Open Schema) export is also one file read with SQL, so both sides are "SQL over a single file", in two different SQL dialects. **inferred**
- **Local files without the cloud.** `SnapshotDb` opens a read-only iModel "used for archival and data transfer"; `StandaloneDb` opens a read/write iModel that is "not associated with an iTwin or managed by iModelHub" and "may be opened without supplying any user credentials". **docs** So a `.bim` snapshot can be read on a laptop with no Bentley account, which is the case the toolkit cares about.
- **Physical layout.** An iModel exposes BIS entities but stores them in ordinary SQLite tables; metadata tables `ec_Schema` and `ec_Class` describe the schemas and how classes map onto tables. **docs** The ECDb mapping strategy `TablePerHierarchy` with `ShareColumns` packs subclass properties into generic shared columns, up to 63 per table before an overflow table. **docs** So plain SQLite can open the file, but a raw `SELECT` sees shared columns, not property names; reading by name needs ECSQL or a decode through `ec_*` metadata. **inferred**
- **ECSQL.** The query language of iModels: SQL-92 and SQL-99 where possible, with classes for tables and properties for columns. Queries are polymorphic by default (`ONLY` turns that off); navigation properties such as `Model.Id` skip a join; relationship classes are queried by `SourceECInstanceId` and `TargetECInstanceId`; regular and recursive CTEs (common table expressions) work; `ECDbMeta` queries the schemas themselves; there are geometry functions for spatial queries and an experimental `Relations()` table-valued function. **docs** The grammar covers insert, update, and delete for ECDb files, but the ECSQL tutorial says iModel data "can only be modified via the respective APIs". **docs**
- **BIS.** "A family of modular schemas for modeling Federated Digital Twins for Infrastructure Engineering", in three layers: core domains (BisCore, Analytical, Functional, Generic, PhysicalMaterial, and others), common domains (AECUnits, ClassificationSystems, DistributionSystems, and others), and discipline domains (Building, Civil, Structural, Construction, Earthwork, Terrain). **docs** The fundamentals are Element (with a Code and a FederationGuid), Model (a container of Elements), Category, ElementAspect (unique or multi), relationships such as `ElementOwnsChildElements`, and TypeDefinition. **docs** The single-source repository is `iTwin/bis-schemas`, pushed 2026-10-09. **docs**
- **iTwin.js.** `itwinjs-core` is MIT, 733 stars, requires Node 24. **docs** Version 5.0.0 of `@itwin/core-backend` shipped 2025-06-13 and removed the 3.x deprecated APIs; the latest is 5.14.2, published 2026-10-06. **docs** The backend depends on the native module `@bentley/imodeljs-native` (5.14.46), whose source repository `iTwin/imodel-native` is Apache-2.0; the npm package says "SEE LICENSE IN LICENSE.md", which this brainstorm did not read. **docs**
- **Connectors.** A connector turns an authoring tool's file into an iModel. The Synchronization API supports IFC2x3, IFC4, and IFC4.3; Revit 2015 to 2024; Navisworks 2013 to 2024; Civil 3D and AutoCAD 2015 to 2025; MicroStation and the OpenRoads, OpenRail, OpenSite, and OpenBuildings family through the Civil connector; Shapefile, GeoJSON, and KML through a Geo connector; Rhino and SketchUp only after a save to DGN. **docs** `iTwin/connector-framework` and `iTwin/connector-samples` are MIT. **docs** None of the 84 public repositories in the iTwin GitHub organisation is an IFC connector, so the IFC connector itself is closed and runs through Bentley's service. **inferred** (Bentley said in 2019 it planned to open-source its IFC bridge.)
- **Platform APIs (need an account; some cost credits).** iModels, Synchronization, Export (IFC only: IFC4.3 ADD2, IFC2x3, IFC2x3 CV 2.0, IFC4 RV 1.2, IFC4.3 ABV), Mesh Export (OGC 3D Tiles only), Changed Elements (compare versions, colour by operation), Reporting (Mappings of Groups of elements into Reports, extracted to OData v4 for Power BI), Grouping and Mapping, Carbon Calculation (built on the open EC3 database), Clash Detection, Issues, Saved Views, Scenes, Reality Data, Sensor Data, Webhooks, and others. **docs**
- **Pricing.** Community plan free for non-commercial and educational use, 100 credits a month. Standard USD 199 a month with 200 credits; Premium USD 499 with 500; extra credits USD 1.20. Visualization costs 1 credit per access hour; iModels 1 credit per 2 GB in or out; Clash Detection 2 credits per run; Carbon Calculation, Webhooks, and Mesh Export are free. **docs**
- **Viewer.** `@itwin/viewer-react` and `@itwin/core-frontend` are MIT, but the web viewer for a hosted iModel needs a client id registered on the iTwin Platform. **docs** Bentley bought Cesium (the 3D Tiles standard's author) on 2024-09-06. **docs**
- **AI.** Bentley ships MCP (Model Context Protocol) servers for its desktop applications, not for iModels: STAAD.Pro (generally available, public on GitHub), and early-access servers for MicroStation, iTwin IoT (sensor data), AssetWise ALIM, ProjectWise, PLS-CADD, TOWER, and PLS-POLE. **docs** The iTwin GitHub organisation has no MCP repository. **docs** OpenSite+ uses generative AI for civil site design, and Bentley Copilot is coming to OpenRoads Designer and OpenRail Designer in early 2026. **docs** The STAAD.Pro and MicroStation MCP servers won a Stevie award in August 2026. **docs**
- **Customers.** Infrastructure owners and the engineering firms that design for them: roads, rail, bridges, utilities, power lines, plants, and site work; the 2026 Year in Infrastructure event (Singapore, 6 and 7 October) had over 300 nominated projects from 53 countries. **docs** Highway departments, rail operators, and large engineering firms work in MicroStation and OpenRoads more than in Revit. **inferred**

## Brainstorm

Goal: find where iTwin and the toolkit fit together so that an iTwin user gets something they cannot get today (an answer from Claude about their own iModel, kept as a replayable graph, without an account or credits), and the toolkit gets infrastructure models, Bentley's connectors as a way into tools it cannot read, and a second open file format it can read and write, without giving up its principles (one edit path, nothing writes until Run, runs as evidence, tables as the currency).

Ideas, grouped by where the data moves. Tags name the prompt that produced the idea.

### The iModel as a source

1. An `imodel.load` node: a `.bim` snapshot path in, the three BOS tables (entities, parameters, relations) out. Pure, cached by the file's content hash. (extends `bos.load` in `src/flow/BimOpenFlow.Nodes.Bos`, which already turns one file into three tables)
2. An `ecsql.query` node: an ECSQL string over a local snapshot, a table out. Same shape as `sqlite.query` and `duck.query`, so the catalog, warnings, and column suggestions carry over. (extends `sqlite.query` in `deps/bim-open-flow/src/flow/BimOpenFlow.Nodes.Tables`)
3. Zero code first: point `sqlite.query` and `sqlite.tables` at a `.bim` file today and see what comes back. The file is SQLite, the node opens read-only and allows one SELECT; the shared columns will be unnamed, which measures how much an ECSQL layer is worth. (what if it already worked)
4. Decode shared columns in plain SQL: a generated view per class from `ec_Class`, `ec_Property`, and the property map, so DuckDB's SQLite reader sees `bis.Element` with real column names and no Node process. (borrow from databases: a view over a physical layout)
5. A BIS-to-BOS mapping specification: Element to entity, ECClass and Category to entity type and category, every ECProperty and ElementAspect property to a parameter row, `ElementOwnsChildElements` to `PartOf`, spatial containment to `ContainedIn`, FederationGuid to the entity's global id. Written once in `deps/bim-open-schema` terms, it decides whether ideas 1, 14, and 20 are cheap. (what if it were a convention instead of a tool)
6. Multi-aspects become parameters with a repeat index, so "one beam has three inspection records" is not flattened into one value. "Honest absence" applies: a missing aspect stays missing. (extreme: a thousand aspects on one element)
7. Polymorphic queries as a toolkit feature: `bis.PhysicalElement` with `ONLY` off returns walls, beams, and pipes at once; BOS has a flat type column. An `entity.isA` node that walks the class hierarchy from `ec_ClassHasBaseClasses` brings that to every source, IFC included. (recombine: ECSQL polymorphism plus BOS)
8. Infrastructure models for the first time: an OpenRoads corridor, a bridge, a rail line, synchronised into an iModel by Bentley's Civil connector, then exported as a snapshot and opened by the toolkit. The toolkit never parses DGN. (what if the problem moved to someone else)
9. Revit, Navisworks, and Civil 3D models through the same door: a user with an iTwin account runs Bentley's connector, downloads a snapshot, and the toolkit reads it, which serves the brief's "no live connection to any authoring tool" without an add-in. (what if the obvious approach, IFC, were forbidden)
10. Changesets as the time axis: an `imodel.diff` node over two snapshots, or over the Changed Elements API's output, giving added, removed, and changed elements with property names. (invert: one model becomes a series)
11. Geometry: the native library's graphics export to meshes, written as BOS geometry or GLB, so `view3d.instances` and `deps/bim-open-viewer` draw an iModel with no 3D Tiles. (extends `@bim-open-viewer/loaders`, which already reads BOS geometry and GLB)
12. 3D Tiles from Mesh Export, which is free, read by a new loader in `@bim-open-viewer/loaders`. Cesium is now Bentley's, so the format will not go away. (borrow from GIS)
13. Geolocation: an iModel sits at a real place on the earth; carry its coordinate system into BOS so `spatial.*` nodes can join it with Shapefile, GeoJSON, and survey data. (extreme: a model a hundred kilometres long)
14. The iModel's schema before any data: open an empty snapshot, read `ECDbMeta`, pre-wire a graph whose column suggestions come from the classes. "Warn, never block". (extreme: an empty model)

### The iModel as a sink

15. A `sink.exportImodel` effect node: BOS tables in, a `StandaloneDb` file out, written only inside a Run. The toolkit becomes a way to make an iModel from IFC without the cloud. (extends `sink.exportSqlite` in `deps/bim-open-flow/src/flow/BimOpenFlow.Nodes.Effects`)
16. Check verdicts written back as a multi-aspect on each element of a `StandaloneDb` copy, so the user's own iTwin viewer colours failures. (invert: source becomes sink)
17. A "BOS" domain schema in EC: the three tables as EC classes, so an iModel can carry a BOS model unchanged inside it and ECSQL can query it. (what if a file format were the integration)
18. Push verdicts to iModelHub as a changeset through the iModels API: a Run produces one named changeset, the run record holds its id, and "nothing writes until Run" matches "nothing pushes until Run". (borrow from version control)
19. Toolkit reports as Reporting API inputs: the toolkit writes a table the Reporting API's OData feed exposes, and existing Power BI dashboards pick it up. (what if nobody opened the toolkit)

### IFC both ways

20. Two IFC parsers, one diff: load the same IFC through the toolkit's web-ifc loader and through Bentley's IFC connector into an iModel, map both to BOS, and publish the differences per element. Useful to both sides and a benchmark asset. (biology: redundancy)
21. Byte-exact IFC write-back after an iTwin round trip: Export API produces a new IFC file; the toolkit can instead apply changes made in iTwin to the original IFC bytes through `deps/bim-open-data`'s property-set editor. Nobody in iTwin's ecosystem does this. (what if we kept the one thing we are uniquely good at)
22. IFC4.3 infrastructure entities (alignments, roads, bridges, rail) as the shared language: Bentley exports IFC4.3 ABV and IFC4.3 ADD2; the toolkit's IFC MCP server reads them. Test `bimopen-ifc` on an Export API output before writing any iTwin code. (what if we did nothing new)
23. The toolkit as the free IFC-to-iModel path for students and small firms who cannot pay for synchronisation, through idea 15. (economics: the free tier as a market)

### Claude and the AI story

24. A `bimopen-imodel` MCP server beside `bimopen-ifc` and `bimopenflow-duckdb`: open a snapshot, list classes, run ECSQL, convert to BOS, diff two snapshots. Same tool shapes as `ifc_sql`, `ifc_type_counts`, and `ifc_to_bos`, so the cost is a port. (extends the two MCP servers in `.mcp.json`)
25. Bentley has no MCP server for iModels; its servers drive desktop applications. An open, local, read-only iModel MCP server fills that gap for every Claude Code user who has a `.bim` file. (what if a competitor did nothing here)
26. ECSQL as a target for Claude: Claude writes ECSQL against `ECDbMeta`, and the toolkit's skills teach it the BIS class names, as `.claude/skills/ifc-ask/` teaches IFC. A new guide file, not new code. (extends `.claude/skills/ifc-ask/`)
27. One question, two dialects: Claude answers through DuckDB SQL on the BOS conversion and through ECSQL on the original; the benchmark scores both and the bare arm (workflow 5). (what if the answer had to agree twice)
28. Claude composes with Bentley's own MCP servers: STAAD.Pro's server produces an analysis, the toolkit reads the resulting model as tables and checks it. Two MCP servers in one session, no integration code. (recombine)
29. Positioning against Bentley Copilot: Copilot lives inside OpenRoads and OpenSite+ and changes models; the toolkit is outside any authoring tool, reads any file, and keeps the graph as evidence. "Copilot designs, the toolkit checks and reports." (what if we did nothing: Copilot answers the easy questions)
30. A notebook (workflow 2) whose source is an iModel snapshot pinned by content hash, opened by a colleague with no Bentley account. (what if the reader had no licence)

### Ecosystem and customers

31. Highway departments and rail owners hold large iModels and few data scientists; a graph "every bridge deck with a missing inspection aspect, per county" is the toolkit's rule check applied to their asset register. (outside the building: infrastructure)
32. Carbon: Carbon Calculation is free on the platform and built on EC3; the toolkit's embodied-carbon graphs could run the same EC3 factors locally and compare numbers per element with the platform's report. (borrow from accounting: a second set of books)
33. Clash Detection costs 2 credits a run; the toolkit's `spatial.intersects` gives bounding-box candidates locally and free, as a pre-filter before a paid run. (economics: prices as signals)
34. Grouping and Mapping groups are queries over elements; import a Mapping as a toolkit graph of `table.filter` nodes, or export a graph's filters as a Mapping. (recombine)
35. Saved Views and Issues as tables with their camera and element ids, then a join with check results: "which open issues sit on failing elements". (recombine: issues plus `check.*` nodes)
36. iTwin IoT sensor readings beside model elements: Bentley's IoT MCP server returns readings, the toolkit joins them to elements by id and charts them per storey or per span. (extreme: a model that changes every second)
37. Publish the toolkit's pane as an iTwin viewer widget: the viewer is MIT and React, the toolkit's results panel is a web client of the host. (what if the user never left the iTwin viewer)
38. The `presentation` library's rules (how iTwin labels and groups elements for people) read as a naming source, so the toolkit shows "Bridge Deck 3" instead of a hex id. (borrow from user interface design)
39. Public sample iModels on the toolkit's public pages, converted once to BOS, so workflow 1 (look, then install one thing) has an infrastructure example beside the building ones. (what if it had to be a URL)

### Where the computation runs

40. Local only: everything above runs on snapshots on the user's disk with no account; the platform APIs are optional sources of snapshots and nothing more. (invert: the cloud as an import step)
41. A Webhooks listener: a new changeset triggers a local Run of a named graph against the new version, results posted as Issues. Webhooks are free. (manufacturing: an inspection station on the conveyor)
42. The toolkit host inside a Node process beside `@itwin/core-backend`, talking to the .NET host over the existing HTTP API, so the native iModel library stays in Node and out of the C# host. (borrow from operating systems: a driver in its own process)
43. Incremental re-evaluation from changesets: only elements a changeset touched invalidate cached node outputs. (compilers: incremental recomputation)

### Minimal and deliberately bad

44. Ten lines: a Node script with `SnapshotDb.openFile` and one ECSQL query per BOS table, written to Parquet; a graph that starts with `parquet.read`. (extreme: ten lines)
45. Deliberately bad: replace BOS with BIS and DuckDB with ECDb, and make the toolkit an iTwin.js app. Its inversion: zero iTwin code in the C# host; the integration is a converter that lives in its own process, plus `sqlite.query` on the raw file. (bad idea, then inverted)
46. Do nothing: an iTwin user exports IFC through the Export API and opens it with `bimopen-ifc`. Document that path and count its steps and credits. (what if we did nothing)
47. Far-fetched: a TypeScript port of the BimOpenFlow engine, which the overview says is "a port, not a rewrite", runs inside the iTwin viewer in the browser over ECSQL. (what if the host disappeared)

## Tensions

- **ECSQL or BOS as the query surface.** ECSQL is richer than BOS on the iModel: class polymorphism, relationship classes, units in the schema. Converting to BOS loses some of that but gives one vocabulary for IFC, Revit, and iModels and lets every existing node apply. Supporting both doubles what Claude must learn.
- **Local file or platform account.** A snapshot needs no account and keeps the evidence on the user's disk; the connectors, changesets, Changed Elements, and Reporting need an account and some need credits. The toolkit's users today have no Bentley account; Bentley's customers all do.
- **Who owns the native code.** Reading named properties and geometry needs `@bentley/imodeljs-native`, a Node module whose npm licence file was not read; plain SQLite needs nothing but loses the property names. That choice decides whether the C# host gains a Node dependency.
- **Which workflow it serves.** Ideas 39 and 22 serve workflow 1; 1, 2, 24, and 26 serve workflow 2; 16, 19, and 37 serve workflow 3; 27 and 20 serve workflow 5. The brief's principle 9 says work starts by naming one, and the brief's first user is a BIM professional, while iTwin's customers are mostly infrastructure owners.

## Approaches

1. **File bridge** (ideas 3, 4, 44, 45 inverted, 46): `sqlite.query` on the raw file, a Node script that writes BOS or Parquet from a snapshot, and IFC export as the fallback. Good for proving the mapping in a day with no dependency in the host; fails when a user wants versions, live data, or geometry.
2. **Source nodes and an MCP server** (1, 2, 5, 6, 7, 14, 24, 26): `imodel.load`, `ecsql.query`, and `bimopen-imodel` for Claude Code over local snapshots. Good for workflow 2 and for a gap Bentley has left open (no iModel MCP server); fails if the native module's licence forbids redistribution or if multi-aspects do not map onto BOS parameters without loss.
3. **Round trip** (15, 16, 17, 18, 21): results written back as aspects, a `StandaloneDb`, or a changeset; byte-exact IFC write-back for iTwin users. Good for workflow 3, the thing an iTwin customer would notice first (their viewer shows the toolkit's verdicts); fails on write-access rules in iModelHub and on the effort of producing valid BIS.
4. **Infrastructure through connectors** (8, 9, 13, 22, 31, 39): Bentley's connectors as the way into OpenRoads, Civil 3D, and DGN, with the toolkit reading the resulting snapshot or IFC4.3 file. Good for a new user group and a new model type at almost no parser cost; fails for users without an account, and the brief's first user is a building professional.
5. **Platform services** (10, 19, 32, 33, 35, 41): Changed Elements, Reporting, Webhooks, and Carbon Calculation as inputs and outputs. Good for paying iTwin customers and for comparisons (idea 32); fails for everyone else and ties each feature to an API that can change.

## Recommendation (soft; the user asked for evaluation afterwards)

Approach 2 built on top of approach 1. Start with idea 3, `sqlite.query` on a public `.bim` snapshot, and idea 5, the BIS-to-BOS mapping, because those two facts decide whether every other idea is cheap: if the shared columns decode through `ec_*` metadata in plain SQL (idea 4), the C# host can read an iModel with no native code and `imodel.load` is a thin node; if not, the converter lives in a Node process (ideas 42 and 44). Either way the `bimopen-imodel` MCP server (idea 24) is the piece with the clearest value, because Bentley ships MCP servers for its applications but none for the iModel file. The tension that decides it is who owns the native code; the licence of `@bentley/imodeljs-native` should be read before any design. Approach 4's IFC4.3 check (idea 22) costs nothing and should run in the same spike.

## Decisions for the user

- Which workflow does the first iTwin work serve? Default: workflow 2 (Claude answers a question about a local iModel snapshot), with workflow 5 (two dialects in the benchmark, idea 27) second.
- Account or no account? Default: no account; local snapshots only, platform APIs deferred.
- Is a Node process with `@itwin/core-backend` beside the C# host acceptable, or must the reader stay in C# over plain SQLite? Default: try plain SQLite first, decide after the spike.
- Does infrastructure (roads, rail, bridges) enter the brief's users, given that the first user is a BIM professional working on buildings? Default: not yet; record it as a `kind: question` ticket after the spike.

## Sources checked on 2026-10-10

- https://www.itwinjs.org/learning/imodels/ (iModel definition, briefcases, changesets)
- https://www.itwinjs.org/reference/core-backend/imodels/snapshotdb and https://itwinjs.org/reference/core-backend/imodels/standalonedb (local files, no credentials)
- https://www.itwinjs.org/learning/ecsql/ and https://www.itwinjs.org/learning/ecsqltutorial (ECSQL features; data modified only through APIs)
- https://www.itwinjs.org/learning/ecsqltutorial/metaqueries (`ec_Schema`, `ec_Class`)
- https://www.itwinjs.org/bis/domains/ecdbmap.ecschema (TablePerHierarchy, ShareColumns, 63-column overflow)
- https://www.itwinjs.org/bis/guide/intro/overview/ (BIS layers and fundamentals)
- https://www.itwinjs.org/changehistory/roadmap/ (roadmap, updated 2025-06-11)
- https://github.com/iTwin/itwinjs-core and the GitHub API for the iTwin organisation (licence, stars, Node 24, 84 repositories, no MCP or IFC repository; `imodel-native` Apache-2.0)
- https://registry.npmjs.org/@itwin/core-backend and https://registry.npmjs.org/@bentley/imodeljs-native (versions, dates, licence fields)
- https://unpkg.com/@itwin/core-backend@5.0.1/CHANGELOG.md (5.0.0 on 2025-06-13)
- https://developer.bentley.com/apis/ (API list)
- https://developer.bentley.com/apis/synchronization/supported-formats/ (connector formats and versions)
- https://developer.bentley.com/apis/export/overview/ (IFC export versions)
- https://developer.bentley.com/apis/mesh-export/overview/ (3D Tiles only)
- https://developer.bentley.com/apis/insights/overview/ (Reporting, Mappings, OData v4)
- https://developer.bentley.com/pricing/ (plans, credits, free APIs)
- https://npmjs.com/package/@itwin/viewer-react and https://developer.bentley.com/tutorials/get-started-with-itwin-platform/ (viewer licence, client id)
- https://www.bentley.com/en/infrastructure-ai/mcp-servers/ (Bentley MCP servers and their status)
- https://www.bentley.com/en/news/bentley-systems-advances-infrastructure-ai-with-new-applications-and-industry-collaboration/ (OpenSite+, Bentley Copilot)
- https://www.bentley.com/en/news/bentley-systems-announces-winners-of-the-2026-year-in-infrastructure-awards/ (2026 event, 300 projects, 53 countries)
- https://www.bentley.com/news/bentley-systems-acquires-3d-geospatial-company-cesium-2/ (Cesium, 2024-09-06)
- https://investors.bentley.com/news-releases/news-release-details/bentley-systems-joins-multinational-member-announces-support-ifc (2019 plan to open-source the IFC bridge)
