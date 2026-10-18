# Bidirectional viewer: selection, comments, BCF viewpoints, write-back

Written 2026-10-18 for TKT-320 from the paper's account of the viewer: of eight
operations, colouring by value and the property panel were built; picking,
aggregates over a selection, annotation and write-back were partial; comments on
an element and model version, and viewpoints in BCF (BIM Collaboration Format)
that save camera and selection, were not built. Serves workflow 3 (the answer in
every form, handed to someone) and workflow 2 (the session kept as evidence).

## The user's story

A BIM coordinator opens a graph whose 3D pane shows the Duplex coloured by a
check's verdicts (`samples/checking-analyses`).

1. They click a door. The door is highlighted in the viewer, the property panel
   shows its sets, and the status line says `1 selected`. Shift-click adds a
   second door. A click on empty space clears the selection.
2. They switch to the **Table** tab of the same node. The two doors' rows are
   highlighted: the selection carries both the entity id and the GlobalId, so a
   table keyed by either matches.
3. They press **Use selection**. A `bim.selection` node holding the two
   GlobalIds appears beside the shown node, selected, so its table shows. They
   wire it into `table.filter`, `view3d.isolate`, or `table.aggregate`; pressing
   the button again after another pick updates the same node's ids. Undo removes
   the gesture in one step.
4. They press **Comment**. A form under the toolbar asks for a title, a comment
   and an author. **Add to graph** adds a `view3d.camera` node holding the
   current camera (position, target, field of view) wired into a `bcf.issue`
   node holding the selection, the texts and the creation time. The issue's
   table shows in the pane. They wire it into `bcf.topics` to preview and
   `bcf.write` to write; after Run the BCF opens in Solibri with the viewpoint at
   that camera, the doors selected, the comment under the topic, and the model
   file named in the header.
5. In the property panel they press **Edit property**, type a set name, a
   property name and a value, and press **Add to graph**. A `table.inline` row
   (entityId, psetName, paramName, paramValue) appears wired into a
   `sink.writePsets` whose `sourcePath` is the graph's model path when it is an
   IFC file and whose `targetPath` is that path with `-reviewed` before the
   extension. The sink says it will write on Run; Run writes the byte-exact copy.

Failure path: a pick on a GLB model (no entity mapping) selects nothing and the
status says so; **Use selection** stays disabled until something is selected and
**Comment** until a model is loaded (a comment with no selection is a
model-level topic); a form left empty does nothing; a model whose
path is not an IFC file leaves `sourcePath` blank, and the card's own warning
asks for it.

## Design

Two principles shape every piece: **one edit path** (a viewer control adds or
changes graph nodes through the same store actions a palette gesture uses, so
the graph remains one a person could have built, undoable, saved with the
analysis) and **nothing writes until Run** (the viewer never writes a file; it
plans the nodes whose Run does).

| Piece | Repository | Why there |
|---|---|---|
| `BcfIssue.Camera` and `.Comments`; camera and comment columns in `BcfColumns`; `Header/Files/File` and `Topic/Comments` in the markup; the reader returns them | bim-open-data, `Ara3D.BimOpenSchema.IO.Bcf` | the format's code lives with the format |
| `PaneContext.addNodes` and `.setParams`; `PaneInput.model.path`; the pane area pushes the current selection into a pane it activates | bim-open-flow, `panes`, `app` | the pane contract and the editor that implements it |
| `bim.selection`, `bcf.issue`, `view3d.camera.fov` | this repository, `src/flow` | BIM node packs live here |
| Selection highlight, multi-select, GlobalIds in the selection event, the three controls | bim-open-notebook, `pane-3d` | the 3D pane |

Reused: the viewer's `select(keys)` (`appearance.select`) for the highlight and
`view.camera()` for the pose; the table pane's existing `selection` input and
highlight; `addNodeActions` for placement; `table.inline` and `sink.writePsets`
for the write-back; `BcfCamera`, `BcfGuid`, the XSD-validating tests.
Retired: nothing; `BcfTopic.Plan`'s framed camera becomes the fallback.

### Contract 1: the pane context (bim-open-flow, `panes/src/pane.ts`)

```ts
/** A node a pane asks the editor to add. `inputs` wires one of its input ports
 *  to an output of a node planned in the same call ({ node: index, port }) or of
 *  an existing node ({ nodeId, port }). Params are canonical text; a List param
 *  is comma-separated. */
export interface PlannedNode {
  kind: string;
  params?: Record<string, string>;
  inputs?: Record<string, { node: number; port: string } | { nodeId: string; port: string }>;
}
export interface PaneContext {
  // ...existing members...
  /** Adds the nodes, placed free of overlap, wired as planned, the last one
   *  selected, as one undo step. Resolves to their ids in order. Optional: a
   *  pane without it offers no graph-editing control. */
  addNodes?(nodes: readonly PlannedNode[]): Promise<string[]>;
  /** Sets params on an existing node as one undo step; rejects when the node is
   *  not in the open graph, so the pane can add a new one instead. */
  setParams?(nodeId: string, params: Record<string, string>): Promise<void>;
}
// PaneInput.model gains `path?: string`: the graph's own path for the model
// (a value.path or a node's path param), for nodes that take a file path.
```

The editor implements both in `app/src/paneEdits.ts` over the store: `addNode`,
`setLayout` at `freeSpot`, `setParam` per param, `connect`, `select`, in one
`batch`. `paneArea.ts` remembers the last selection ids and pushes them into a
pane right after `activate` mounts it, so a tab switch shows the highlight.
`view3dPane.ts` (pane-3d) passes `shown.modelPath` as `path`.

### Contract 2: node kinds (this repository)

`bim.selection` (pure, `BimOpenFlow.Nodes.BimAnalysis`): params `ids` (Text,
List; GlobalIds). Output `ids`: one column `GlobalId` (Text, not null), one row
per distinct non-blank id, in order. Description names the 3D pane's **Use
selection** control and the joins it feeds.

`view3d.camera`: gains `fov` (Number, default 60, the vertical field of view in
degrees) and a `fov` column. No sample uses the node, so no relayout.

`bcf.issue` (pure, `BimOpenFlow.Nodes.Bcf`): input `camera` (Table, optional:
`view3d.camera`'s one-row table). Params `title`, `description`, `comment`,
`author`, `created` (Text, UTC ISO `yyyy-MM-ddTHH:mm:ssZ`, set by the pane; the
node is pure and reads no clock), `status` (default `Open`), `priority`, `type`
(default `Issue`), `ids` (Text, List; GlobalIds). Output `issues`: columns
`GlobalId, Title, Description, Status, Priority, Type, Comment, Author,
CreationDate`, and with a camera row `CameraX, CameraY, CameraZ, DirectionX,
DirectionY, DirectionZ, UpX, UpY, UpZ, FieldOfView, AspectRatio` (direction is
target minus position, normalised; up is z made perpendicular to the direction,
the BCF convention; aspect 1). One row per id; one row with an empty GlobalId
when there are none (a model-level comment). A blank title is an error naming
the param. Declared schema for the fixed columns.

### Contract 3: the BCF library (bim-open-data)

- `BcfComment(string Author, DateTimeOffset? Date, string Text)`.
- `BcfIssue` gains `BcfCamera? Camera = null` and
  `IReadOnlyList<BcfComment>? Comments = null`. `BcfTopic.Plan` uses the issue's
  camera when given, else the framed one; a given camera means a viewpoint even
  without geometry.
- `BcfColumns` gains `Comment`, `Author`, `CreationDate`, `CameraX, CameraY,
  CameraZ, DirectionX, DirectionY, DirectionZ, UpX, UpY, UpZ, FieldOfView,
  AspectRatio` (the names above). `ToBcfIssues`: the camera columns of a title
  must agree, as Status does; each row's non-empty `Comment` becomes a
  `BcfComment` with that row's `Author` and `CreationDate`, distinct by text.
- `BcfOptions` gains `ModelFile` (a path or file name, default "") and
  `ModelDate` (`DateTimeOffset?`). When `ModelFile` is set the markup gets
  `Header/Files/File` with `IsExternal="true"`, `Filename` (the file name),
  `Date` when given, and `Reference` (the path as given). `Topic/Comments/Comment`
  per comment: `Guid` from `BcfGuid.Comment(topicGuid, index)`, `Date` (the
  comment's, else the options' creation date), `Author` (the comment's, else the
  options' author), `Comment`, and `Viewpoint Guid=` when the topic has one.
  Element order follows markup.xsd; the tests validate every file.
- `BcfTopicRecord` gains `Camera` (the first viewpoint's perspective camera) and
  `Comments`. `BcfReader.ToTable` adds the camera columns (null without a
  viewpoint camera) and a `Comments` count; a new `CommentsTable(topics)` gives
  one row per comment: `TopicGuid, Title, Author, CreationDate, Comment`.
  `bcf.read` gains a `comments` output from it; `bcf.write` sets `ModelFile` and
  `ModelDate` from its `model` param when given; `bcf.topics` and `bcf.write`
  pass camera and comment columns through `ToBcfIssues` unchanged.

### Contract 4: the 3D pane (bim-open-notebook, `pane-3d`)

`ViewerRig` gains `select(entityIds: readonly number[]): void` (the viewer's
`appearance.select` over the object keys of those entities) and
`camera(): { position: [x,y,z]; target: [x,y,z]; up: [x,y,z]; fov: number; aspect: number } | undefined`
(the first view's pose; fov from a perspective projection, 60 for an
orthographic one with a warning in the status). `createRig`'s `onPick` gains the
modifier: `onPick(entityId, { extend: boolean })`.

The pane keeps `selected: Map<number, string | undefined>` (entity id to
GlobalId once the property fetch returns). A plain pick replaces it, an
extended one toggles membership, a null pick clears it. On every change the
pane calls `rig.select`, updates the status (`N selected`), and emits
`selection` with ids `[...entityIds as text, ...known GlobalIds]`; when a fetch
later supplies a GlobalId it emits again. The property panel shows the last
picked element.

Controls (toolbar buttons, enabled only when they can act): **Use selection**
(adds `bim.selection` or updates the one this pane added; falls back to adding
when `setParams` rejects), **Comment** (the form; on submit adds `view3d.camera`
and `bcf.issue` wired `camera -> camera`, `created` as the current UTC time to
the second, `status` Open), and in the property panel **Edit property** (the
form; on submit adds `table.inline` with one row `{entityId, psetName,
paramName, paramValue}` wired `table -> in` of `sink.writePsets` with
`sourcePath` the model path when it ends in `.ifc` and `targetPath` derived as
above). The pane never imports the toolkit (`test/seam.ts`); node kinds are
strings in one module, `src/graphNodes.ts`, with their param names.

## Chunks

| Chunk | Repository | Fence | Test | Depends on |
|---|---|---|---|---|
| A1 Camera and comments in the BCF writer and reader; header file | bim-open-data | `src/data/Ara3D.BimOpenSchema.IO.Bcf/**`, its tests | XSD-validated round trips in `Ara3D.BimOpenSchema.IO.Bcf.Tests` | — |
| B1 `PlannedNode`, `addNodes`, `setParams`, `model.path`; `paneEdits.ts`; the pane area pushes the selection on activate | bim-open-flow | `panes/src/pane.ts`, `panes/README.md`, `client/src/paneContext.ts`, `app/src/paneEdits.ts`, `app/src/app.ts`, `app/src/paneArea.ts`, `app/test/**` | app and panes vitest, typecheck | — |
| C1 `bim.selection`, `view3d.camera.fov`, `bcf.issue`; pack READMEs; `docs/nodes.md` and the catalog regenerated | toolkit | per contract 2 | `tests/flow` node tests | — |
| C2 `bcf.write` header from `model`; `bcf.read` `comments` output; a round-trip node test with a camera and a comment | toolkit | `src/flow/BimOpenFlow.Nodes.Bcf/**`, its tests | `BimOpenFlow.Nodes.Bcf.Tests` | A1 |
| D1 Highlight, multi-select, GlobalIds in the selection event, `rig.select` and `rig.camera` | bim-open-notebook | `pane-3d/**` | pane-3d vitest with the fake rig | B1 |
| D2 Use selection, Comment, Edit property; `graphNodes.ts`; README | bim-open-notebook | `pane-3d/**` | pane-3d vitest | D1, C1 names |
| E1 Pins in `deps.json`; `docs/bim-flow-3d.md` reviewing section; gates | toolkit | `deps.json`, `docs/bim-flow-3d.md` | `node gates/web-smoke.mjs`, the close gates | all |

## Considered and rejected

- **Option:** keep the element selection in the editor's store (a second
  selection beside the node selection) and let every pane read it.
  **Reason:** the pane contract already carries a `selection` input and event;
  the only gap was the id space (entity id against GlobalId) and the push on tab
  switch. A store field would be a second path for the same fact.
  **Would change if:** a pane outside the pane area (the notebook's embeds, the
  Ask box) needs the element selection; then the notebook's `SelectionBus`
  (TKT-222) is the shape to adopt.
- **Option:** one `bcf.issue` node carrying the camera as its own numeric
  params. **Reason:** `view3d.camera` already models a camera as a one-row table;
  a second copy of its params repeats it, and a camera node can later drive the
  view ("look here"). **Would change if:** two cards per comment prove too heavy
  on the canvas; then `bcf.issue` could accept the camera as one text param.
- **Option:** the viewer writes the BCF or the IFC directly from its control.
  **Reason:** principle 2, nothing writes until Run; the run record is the
  evidence (principle 4). **Would change if:** never; this is a brief principle.
- **Option:** comments as a separate `bcf.comment` node and a comments table
  convention. **Reason:** a BCF comment without a topic does not exist; a row's
  `Comment` column on the issue table keeps the one convention of TKT-182.
  **Would change if:** a workflow needs many comments per topic from several
  authors in one table; the `Comment` column already allows one per row.
- **Option:** an orthographic BCF camera when the view is orthographic.
  **Reason:** the library writes perspective cameras only; adding
  `OrthogonalCamera` is a format change no workflow asked for. **Would change
  if:** a plan view's viewpoint is wanted; then `BcfCamera` grows a kind.

## Extension points

- `bim.selection` from a table pick or a chart (the table pane emits the same
  event; a generic "Use selection" needs the editor to know the node kind).
- The viewer applying a `view3d.camera` table ("look here"), the inverse of
  **Comment**.
- Reading BCF comments back into the pane as pins on the model.
- `BcfOptions.ModelFile` could carry the model's SHA-256 (the run record has it)
  once a reader shows where it belongs; `Reference` is a URI today.

## Build log

- A1, bim-open-data `38df2e7`, `bd8c36e`, `b71b20b` (2026-10-18): `BcfComment`,
  `BcfIssue.Camera` and `.Comments`, `BcfColumnNames`, `BcfOptions.ModelFile`
  and `.ModelDate`, `BcfGuid.Comment`; the reader returns camera, comments and
  the header file, `CommentsTable` is new; 42 tests became 54, every file
  XSD-validated. Not done: BCF 2.1 comments (they sit beside the topic), the
  orthogonal camera.
- B1, bim-open-flow `da599ee`, `119719b`, `0d1918f`, `6c7c282`: `PlannedNode`,
  `addNodes`, `setParams`, the model input's `path`; `app/src/paneEdits.ts`
  reuses `addNodeActions` and `freeSpot`; the pane area pushes the remembered
  selection into a pane it activates. Node ids come from the kind's last
  segment (`selection1`), so a pane uses the returned ids. 251 app tests, 107
  panes tests.
- C1, toolkit `eae69397`, `9a79dd3c`, `d2228332`: `bim.selection`,
  `view3d.camera.fov`, `bcf.issue`. The first commit missed the node file and
  its test (untracked), fixed in the resumed session.
- D1, bim-open-notebook `958ac68`, `9d86ea4`: `rig.select` and `rig.camera`,
  the pick modifier, the selection map and the GlobalIds in the event.
- Pins: `deps.json` moved to bim-open-data `b71b20b` and bim-open-flow
  `6c7c282` before the notebook chunk landed, so the toolkit builds against the
  library the nodes need.
- C1 fix and C2, toolkit `d523bc83` (the missed files), `50efd47a` (`bcf.write`
  header from `model`, `bcf.read` `comments` output, the round trip test),
  `59badb5b` (docs), `96302647` (DeclaredSchema scenarios for the two nodes).
- D2, bim-open-notebook `7ad4ca2`, `6ac8041`, `1645474`: Use selection,
  Comment and Edit property; `graphNodes.ts`, `reviewPlans.ts`,
  `reviewForms.ts`; 96 tests. A comment with nothing selected is a
  model-level topic (the plan's story said disabled; the node defines the
  case, so the control allows it).
- Sample, toolkit `20caeed4`: `samples/checking-analyses/review-comment.json`
  (camera (12, -20, 7) framing the two narrow doors), its golden and
  `ReviewComment_TwoDoorsOneCommentAndACamera_WrittenAndReadBack` in
  `CheckingGraphTests`.
- Review (platonic:reviewer, 2026-10-18) of A1 and B1: ten defects, fourteen
  design notes. Fixed, one commit each: bim-open-data `f3ac055`..`aa7c5bb`
  (empty comment text, blank header file name, Unspecified dates as UTC,
  non-finite and partial cameras rejected, field of view and aspect ratio
  null when a file gives none, BCF 2.1 comments and header files read,
  comment columns renamed `CommentAuthor` and `CommentDate`, comments distinct
  by author and text, one date helper); bim-open-flow `e7aed4c` (planned wires
  and params validated with sentences a pane can show), `0a0de94` (the pane
  area reads the app's selection; a flow switch clears it), `6846390`
  (selection-before-table test); toolkit `6c07005f`, `edd7702a` (the nodes
  follow the rename). Design notes left as tickets: TKT-333 (`planNodes` as
  the shared edit operation), TKT-334 (a read-then-write keeps comments).
- Live check in the studio (viz-door-accessibility over the Duplex): a pick
  gave `1 selected` and the property panel; Use selection saved `selection1`
  with the GlobalId; Comment saved `camera1` (fov 50 from the viewer) wired
  into `issue1`; Edit property saved `inline1` wired into `writePsets1` with
  the IFC source path and a `-reviewed` target, `EffectPending` until Run; the
  review-comment sample opened with its topic preview. Two layout defects
  seen there (toolbar over the status line, unreadable form labels) fixed in
  bim-open-notebook `e81dd5c`. Found and filed, not this ticket's: TKT-329
  (the web smoke gate fails on nrc-rollup's layout and the nrc-web notebook
  tests before this work) and TKT-330 (the pane loads no model for a
  `$model` graph input).
- Pins: bim-open-flow `6846390`, bim-open-notebook `e81dd5c`, bim-open-data
  `aa7c5bb`. The sample goldens moved with the bim-open-data pin (entity
  counts of the Duplex changed between `77c01ce` and `b71b20b`) and with the
  new `bcf.read` output; re-approved after the rename.
