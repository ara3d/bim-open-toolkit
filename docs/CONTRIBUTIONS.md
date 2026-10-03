# Contributions to the AEC industry, and related work

Written 2026-09-29 from `PROJECT.md`, `README.md`, `docs/OVERVIEW.md`, and the proposals under `docs/proposals/`. Numbers come from those documents; where a capability is partial, the text says so. The comparisons with other tools come from general knowledge of those tools and have not been re-checked against their current releases.

## The problem in one paragraph

A building model's data sits behind the authoring tool that made it. Revit's data comes out through the Revit API, inside a Revit process, on a licensed Windows machine. IFC (Industry Foundation Classes, the open ISO 16739 exchange format) frees the data from the vendor, but IFC is an object graph in a STEP text file, shaped for handing geometry and semantics from one tool to another. Asking it a question, such as "which doors are narrower than 850 mm, per storey", still means writing a program against a parser. Analysts end up with spreadsheet exports, one-off scripts, and screenshots, none of which can be replayed by the next person.

## Contributions

### 1. BIM Open Schema: a building model as plain tables

BIM Open Schema (BOS) stores a model as a set of flat lists: entities, parameters, relations, geometry, and pooled strings and numbers. Each list is one table and one Parquet file, so a model loads straight into DuckDB, pandas, Excel, or any columnar tool without a BIM library.

Three design choices set it apart:

- **Parameters are entity-attribute-value rows, one table per primitive type.** Two parameters may share a name and differ in type, which happens routinely when Revit and IFC data meet.
- **Relations use a closed vocabulary** (`PartOf`, `ContainedIn`, `HostedBy`, `BoundedBy`) chosen to cover both the Revit API and IFC, so models from mixed sources answer the same queries.
- **The schema is a specification, not a library.** Its definition is five dependency-free C# files in the `bim-open-schema` repository; this repository is the reference implementation, with converters from IFC and a Revit 2025 exporter add-in.

### 2. BimOpenFlow: a specified dataflow graph where tables are the currency

BimOpenFlow turns a question into a graph of small pure functions. Of the five value kinds that travel on a wire, the one that matters is the immutable table. ETL, SQL, charts, 3D colouring, and rule checks are therefore one kind of pipeline: a query can colour a model, and a rule check can feed a chart, with no conversion step between them.

What distinguishes it from other visual programming tools in AEC:

- **It is specified.** A versioned specification in four parts (format, semantics, expressions, runs) defines the graph, and a conformance suite of test vectors decides what counts as a correct engine. The C# engine passes every vector. A TypeScript or Python engine would be a port against the vectors, not a reverse-engineering exercise.
- **Evaluation cannot write.** Nodes that write a file or an IFC property set live in one pack and stay `EffectPending` until an explicit Run. Anyone, person or agent, can explore a graph without risk to the disk.
- **Failure is a state.** Each node reports `Ok`, `Unready`, `EffectPending`, `Unavailable`, or `Error`, so a half-wired graph is something to inspect and repair rather than a crash.
- **Runs are replayable evidence.** A run record pins the graph hash and every input by content hash, and replays. The publishing chain turns a run into a static report or an evidence package, a zip whose manifest lists a SHA-256 per file. (Today the report and package are produced under the tests' Run context; producing them from the editor's Run button is workflow 5 in `PROJECT.md`, not yet done.)
- **The vocabulary documents itself.** 98 nodes in 11 packs each declare their ports, parameter kinds, enums, and purity; `docs/nodes.md` is generated from those declarations.

### 3. One edit path for people and AI agents

Every edit, whether a mouse gesture in the web editor, an HTTP call, or an MCP (Model Context Protocol) tool call from Claude, is one of four operations: `addNode`, `connect`, `setParam`, `removeNode`. A graph an agent builds is one a person could have built, and the person can open it, read it, and change it.

This is the toolkit's main answer to the reliability problem with AI in AEC. The agent does not report a number from memory; it builds a graph, evaluates it, and reads the result back, so its answer arrives with an inspectable derivation. On a set of ten questions over the Snowdon model, a gpt-5 agent produced 8 correct graphs, 2 honest answers without a graph, and 0 wrong answers. Measuring Claude on a committed version of the same set is open work (workflow 2).

Two MCP servers expose this to Claude Code: `bimopenflow-duckdb` for graphs over a DuckDB export, and `bimopen-ifc` with about 35 tools for questions asked directly of an IFC file.

### 4. Byte-exact IFC write-back

`Ara3D.Ifc.Editing` locates each IFC entity by byte range and rewrites only the property sets it changes. Every other byte of the file comes out identical. In the NRC (National Research Council Canada) work, the `nrc-enrich-run` graph writes 2,438 values into 224 entities this way.

This matters because the IFC file usually belongs to someone else. Most IFC toolkits parse a file into objects and serialise it again, which reorders entities, renumbers them, or reformats numbers; the result may be valid but cannot be diffed against the original. Byte-exact editing makes enrichment defensible: the only difference a reviewer finds is the one that was intended.

### 5. Honest absence as a rule

The toolkit treats "information not available" as a result. A NULL stays NULL rather than becoming 0, a door width is never parsed out of a type name, and two records are never merged because they sit in the same place. The federation work for Snowdon's seven discipline files (`docs/proposals/snowdon-federation.md`) follows the same rule: only confirmed, evidenced correspondences make two records the same object, because GlobalId is not a key across files.

Much AEC tooling fills gaps to make a schedule look complete. Stating the gap is less convenient, and it keeps a wrong number out of a cost plan or a compliance report.

### 6. Rule checks with citations and evidence

The compliance pack applies a cited rule deterministically. On the Duplex sample, rule DC-W1 (door leaf width at least 850 mm) gives 8 Pass and 6 Fail and colours the failing doors in 3D. The brief states the intended split of responsibility: a model may draft SQL or a graph, but a verdict is the deterministic execution of an approved rule, and approving and issuing stay human decisions. (That principle is still marked unconfirmed in `PROJECT.md`.) Reading buildingSMART IDS (Information Delivery Specification) files as rules is in progress in `src/data/Ara3D.Ids`; see `docs/proposals/ids-reuse.md`.

### 7. A BIM-free 3D viewer and a BIM-free engine

Two parts of the repository contain no BIM at all and could stand alone:

- The dataflow engine (`submodules/ara3d-dataflow`), useful for any table pipeline.
- The `deps/bim-open-viewer/` workspace, seventeen npm packages around three.js, with a pure model layer whose unit tests run under Node without a WebGL context. It renders Snowdon's 456,598 instances from an eleven-node graph; the first frame currently takes 5.2 to 5.8 s, against a target of under 2 s.

Keeping building knowledge out of these layers is a contribution in itself. A layering test fails the build when a reference points the wrong way.

### 8. Reproducible research

`npm run nrc:walkthrough` rebuilds the host and both MCP servers and regenerates 16 figures (10 from the Duplex sample, 6 from Snowdon) with transcripts, in about 291 s. The aim, not yet met, is for CI to fail any push that changes one of the paper's eight answers.

## Relation to existing work

| Existing work | What it does | How this repository relates |
|---|---|---|
| IFC and buildingSMART standards | The open exchange schema for building data | The source of truth. BOS is a derived, analysis-shaped view of IFC, not a replacement; write-back goes into the IFC file. |
| IFC5 / IFCX (buildingSMART, in development) | A next-generation IFC with a JSON, composable layer structure | A shared motivation (make IFC data easier to consume). BOS targets columnar analysis in DuckDB and Parquet rather than exchange. The two could coexist: an IFCX file could be a BOS source. |
| IfcOpenShell, xBIM, web-ifc (That Open Company) | Libraries that parse, query, and write IFC | Used or comparable at the parsing layer: web-ifc sits under the loader. What this repository adds on top is the table schema, the graph, run records, and byte-exact partial writes. |
| Revit API, Autodesk Platform Services | Vendor access to authoring data | Avoided by design. The Revit add-in exports a BOS file once; after that nothing needs Revit. |
| Speckle | Open-source data hub that streams objects between AEC tools, with versioning | Speckle moves and versions objects between applications. This toolkit analyses one model as tables and records how each number was derived. Speckle could feed it; it has no equivalent of the spec-plus-conformance engine or effect gating. |
| Dynamo, Grasshopper | Visual programming inside Revit and Rhino | The closest in appearance. Those graphs run inside a host application, pass geometry and objects, and can change the model on every evaluation. BimOpenFlow runs headless, passes tables, forbids writes outside a Run, and has a written specification. Editor ideas borrowed from them are listed in `docs/proposals/editor-ux-harvest.md`. |
| KNIME, Alteryx | General table-workflow tools | Similar in spirit (tables on wires, a port preview anywhere, node status). They know nothing about buildings, 3D, or IFC write-back; this toolkit's packs do. |
| Solibri, and IDS checkers | Model checking against rule sets | Solibri's rules run inside a closed application. Here, a check is a graph that anyone can read, and the check produces a run record and an evidence package. IDS support is in progress. |
| DuckDB, Parquet | Embedded analytical SQL and columnar files | Adopted, not competed with. BOS is designed to land in them directly. |
| Agent tooling for BIM (LLM chat over models) | Natural-language questions answered by a model | Most answer in prose. Here the agent must build an inspectable graph with the same four operations a person uses, and numbers come from tool results. |

## What is not claimed

- No geometry authoring or editing; IFC edits are limited to property sets.
- No live link to an authoring tool, no multi-user service, and no accounts.
- The full toolkit runs on Windows only; the engine and schema libraries are portable .NET.
- The demos over a real building depend on the private Snowdon model, so outside readers cannot yet reproduce them from a clean clone (workflow 1 in `PROJECT.md`).
- Several capabilities above are measured on one or two models. They are evidence that the approach works, not a survey across the industry's files.
