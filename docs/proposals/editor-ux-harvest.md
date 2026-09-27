# Editor UX harvest: what the earlier graph editors did, and what other tools do

> Proposal, 2026-09-27. Nothing here is built. Sources: the four graph editors
> on the owner's machine (Kea, Studio Graph, PlatoFlow code-flip, and the
> Gratify samples), their design notes in `studio/docs/`, the current editor
> under `bimopenflow/web/packages/app/src/`, and general knowledge of about
> twenty node-based tools. Extends [bimopenflow-ux-proposal.md](bimopenflow-ux-proposal.md)
> (2026-08-31), which set the direction as a linear-pipeline editor rather than
> a general node-graph instrument; this document keeps that direction and adds
> concrete prior code to build from. Serves workflows 2 (ask and get a graph
> you can inspect) and 1 (answer a question about Snowdon) most directly, and
> 3 to 5 through the run and export ideas.

## How to read the links

Links resolve from a checkout layout where `bim-open-toolkit` and `studio`
(`github.com/ara3d/studio`) are sibling folders under `C:\Users\cdigg\git`.
Line numbers are in the link text, and were read on 2026-09-27.

| Short name | Folder | What it is |
|---|---|---|
| **Studio Graph** | [studio/ara3d-sdk/wip/platoflow-poc/web](../../../studio/ara3d-sdk/wip/platoflow-poc/web) | The PlatoFlow proof of concept from August 2026: TypeScript on Gratify, a C# host with DuckDB and MCP. The most complete editor of the four. Moved here from `studio/labs/platoflow-poc`, which is now empty. |
| **Kea** | [studio/labs/kea](../../../studio/labs/kea) | Raw Canvas 2D with springs, no dependencies, July 2026. The most inventive on structure: grouping, merging, frames, bundles. |
| **PlatoFlow** | [studio/labs/platoflow](../../../studio/labs/platoflow) | A trimmed Kea with a code view that converts a selection to a Plato function and back. |
| **Gratify samples** | [submodules/gratify/examples](../../submodules/gratify/examples) | Samples of the canvas library BimOpenFlow already uses. `schema-graph` and `workbench` exist only in this repository's submodule copy (commit a2d1723), not in `C:\Users\cdigg\git\gratify`. |

A C# WPF prototype, Emu (`ara3d/labs/Emu`), and a stub, `studio/labs-legacy/Ara3D.NodeEditor`, were also found; neither has anything the others lack.

## The two features the owner remembered

### Documentation that expands inside the node (Studio Graph)

A "?" chip on the node header toggles a help section between the header and the sockets. The card grows to hold it.

- The chip is placed at [cards.ts:349-374](../../../studio/ara3d-sdk/wip/platoflow-poc/web/src/editor/cards.ts) and dispatches `toggleHelp` at `cards.ts:468`.
- The reducer keeps open or closed per node in view state, not in the saved graph ([doc.ts:73, 223-230](../../../studio/ara3d-sdk/wip/platoflow-poc/web/src/editor/doc.ts)).
- `helpLines()` ([geom.ts:87](../../../studio/ara3d-sdk/wip/platoflow-poc/web/src/editor/geom.ts)) builds up to 16 wrapped lines: the kind's description, then the status detail (for `sql.query`, the generated SQL), then warnings in amber and errors in red.
- `nodeLayout` adds the help height at `geom.ts:216-218`. Drawing (`cards.ts:226-235`) and hit-testing read the same layout, so the two cannot drift apart.
- A menu item, Help ▸ Show all / Hide all ([chrome.ts:284-299](../../../studio/ara3d-sdk/wip/platoflow-poc/web/src/editor/chrome.ts)), opens every node at once. A hover tooltip after 500 ms covers headers and sockets ([help.ts:38-177](../../../studio/ara3d-sdk/wip/platoflow-poc/web/src/editor/help.ts)).

**For BimOpenFlow.** The catalog already carries a description for every node kind and every port; `docs/nodes.md` is generated from it (principle 6). Today that text shows only as a tooltip in the sidebar ([sidebar.ts:94-96](../../bimopenflow/web/packages/app/src/sidebar.ts)). On the canvas it would answer the question an analyst has after an agent builds a graph: what does this node do? Proposed content, in order:

1. the kind's description from the catalog;
2. the node's live reason for its state, which `nodeBadge.ts` already computes (TKT-10);
3. for SQL-bearing nodes, the SQL the host will run;
4. warnings from live suggestions (an unknown column, a parse error with the parser's message);
5. a link to the kind's entry in `docs/nodes.md`, and, once samples are indexed by kind, "used in: `snowdon-door-schedule`, `nrc-dc-w1-verdicts`".

Item 5 borrows from TouchDesigner's and Max's per-operator example patches: the best documentation for a node is a working graph that uses it. Keeping open or closed out of the saved graph, as Studio Graph did, is right: it is view state and must not change the graph hash that runs pin (principle 4).

### Grouping and merging nodes (Kea, then Studio Graph)

Kea has three separate structural gestures. They are easy to conflate.

| Gesture | What it does | Code |
|---|---|---|
| **G / U: group and ungroup** | The selection becomes one group node. Every wire crossing the boundary becomes a promoted port named `slot · node`, with a map back to the inner socket. Groups nest. U puts the nodes back relative to where the group was dragged. | [document.ts:362-438](../../../studio/labs/kea/src/app/document.ts) |
| **Double-click: enter a group** | Opens the group as its own canvas. Each promoted port appears as a portal pseudo-node that can be rewired; a frame shows the depth. | `buildSubDoc` / `writeBackSub` at `document.ts:624-701`; [editor-runtime.ts:73-100](../../../studio/labs/kea/src/app/editor-runtime.ts); [input.ts:282](../../../studio/labs/kea/src/app/input.ts) |
| **Absorb and extract: merge nodes** | Dropping one node onto another merges its slots into the target at the insertion line shown. Dragging a slot clear of its node tears it out into a new node. Socket ids survive, so wires stay connected both ways. | `absorbNode` at `document.ts:460-470`, `extractSlot` at `448-459`; hover detection `input.ts:417-435`; preview line [render.ts:227-236](../../../studio/labs/kea/src/app/render.ts) |
| **L: lambda frame** | Wraps the selection in a frame drawn behind it. Nodes drag in and out; ring marks show where wires cross the border; parameters can be promoted to the frame. | `document.ts:471-543`, `render.ts:269-367`; plan in [kea-lambda-regions-plan-2026-07-12.md](../../../studio/docs/kea-lambda-regions-plan-2026-07-12.md) |

Studio Graph copied G, U and double-click with a cleaner implementation. The code is `collapseSelection`, `expandNode` and `enterDoc` in [subgraph.ts:54-186](../../../studio/ara3d-sdk/wip/platoflow-poc/web/src/editor/subgraph.ts). It adds a breadcrumb ("root ▸ a — editing subgraph · Esc exits", `subgraph.ts:203-234`), makes collapse and expand each one undo step, and keeps undo history per level.

**For BimOpenFlow.** None of the three is free. Neither the engine specification (`submodules/ara3d-dataflow`) nor the graph format has a subgraph, and principle 1 says every edit is one of `addNode`, `connect`, `setParam`, `removeNode`. The options, from cheapest:

1. **Frames only.** A titled, coloured rectangle stored as layout metadata beside node positions, moving its contents when dragged (Blender frames, Unreal comment boxes, Dynamo groups, Houdini network boxes). The engine never sees it and the graph hash does not change. This covers the actual need of a 4-to-8-node pipeline: labelling its stages ("select doors", "check width", "report").
2. **Collapse as a view.** The same frame can be folded into a single card showing only the boundary ports. It is still a display state, as in Houdini's minimised network boxes: the graph the engine runs is unchanged, and an agent reading it over MCP sees every node.
3. **A real subgraph kind.** A `graph.sub` node whose parameter is a graph, as in Studio Graph, Kea, KNIME components, Houdini digital assets and Unreal functions. This is the route to reusable user-made blocks, but it changes the specification, the conformance vectors, the catalog, the hash, and every MCP tool that walks nodes. It should wait until a workflow needs a block reused across analyses.

Absorb and extract (merging nodes' slots) do not transfer. BimOpenFlow nodes are typed operations from a catalog, not bags of slots, so two nodes cannot be merged into one without a new kind. The equivalent here is **fusing a chain into one query**: select `duck.query → table.filter → table.groupBy` and turn it into one `sql.query` whose SQL the host generates. That is PlatoFlow's code-flip applied to SQL, and it is described under "Code and graph" below.

**Recommendation:** build option 1 now, option 2 when a graph first exceeds a screen, and file option 3 as a question ticket.

## Other ideas from the earlier editors

Grouped by the workflow they help. "Have" means BimOpenFlow already does it (from the survey of `bimopenflow/web/packages/app/src/`); every other row is missing today.

### Inspecting a graph (workflow 2)

| Idea | Where it was built | Notes for BimOpenFlow |
|---|---|---|
| **Value badges at the wire midpoint** showing the source's summary; fade in on hover; errors always shown; hidden below 0.6 zoom or on wires under 90 px | Studio Graph [wires.ts:82-135](../../../studio/ara3d-sdk/wip/platoflow-poc/web/src/editor/wires.ts) | TKT-11 (peek at any wire). The controller, card and hover code already exist here (`portResults.ts:85`, `peekCard.ts:114`, `portHover.ts:12`) but are not connected: `canvasEditor.ts:37` calls `buildCanvasModel` without results, and nothing calls `installPortHover`. Studio Graph's rules for when to hide a badge are the missing piece. |
| **Wire hover highlights the elements in 3D**, and picking in 3D highlights the wire | Studio Graph `wires.ts:136-211` | Cross-probing, P1 in the earlier proposal. Needs the 3D pane in the studio (TKT-28). |
| **Mini data grid inside a node**; clicking a row highlights it in 3D | Studio Graph [widgets.ts:428-622](../../../studio/ara3d-sdk/wip/platoflow-poc/web/src/editor/widgets.ts) | Only for answer nodes (`defaultShown.ts`); a grid on every node would crowd a pipeline. |
| **Bar chart drawn in the node** | Studio Graph `geom.ts:269-291`, `cards.ts:271-289` | A 60 px sparkline of the value distribution on column-producing nodes, like Power Query's column profile. |
| **Colour ramp drawn as the actual gradient**, with a range slider | Studio Graph `colormap.ts` | TKT-16 (one colour domain with a legend across panes): the node shows the same ramp the legend does. |
| **Status footer that pulses while pending** | Studio Graph `cards.ts:297-330` | TKT-33 (an Evaluating state from the host). |
| **Sparkles on every compatible socket** when one is clicked | Kea [render.ts:586-620](../../../studio/labs/kea/src/app/render.ts) | Cheap and teaches the five value kinds. |
| **Energised wires**: dots flow along wires feeding a viewport | Kea `render.ts:76-110` | Have a version: selecting a node animates its upstream wires (TKT-24). |
| **Hidden-wire count badge** on a collapsed slot | Kea `render.ts:546-572` | Needed once frames can fold (option 2 above). |

### Building a graph (workflows 1 and 2)

| Idea | Where it was built | Notes |
|---|---|---|
| **Drop a wire on empty canvas → palette filtered to compatible kinds**, picked node added and connected as one undo step | Studio Graph `wires.ts:308-368`, [palette.ts:40-155](../../../studio/ara3d-sdk/wip/platoflow-poc/web/src/editor/palette.ts) | P0 in the earlier proposal, not ticketed. The one-undo-step part also fixes the TODO at `app.ts:331` (adding a node takes three undo steps). |
| **Right-click canvas → palette at the cursor** | Studio Graph `index.ts:596-600` | Today the only way to add a node is the sidebar, and it lands "at a free spot". |
| **Drop a node on a wire to splice it in** (one disconnect, two connects) | Studio Graph `wires.ts:75-80, 386-447` | Maps directly onto principle 1's operations. |
| **Shift-drag to slice wires** | Gratify [node-editor/slice.ts:70-108](../../submodules/gratify/examples/node-editor/slice.ts) | Blender's knife; already in the library BimOpenFlow uses. |
| **Copy, paste, duplicate**, with edges between copied nodes remapped | Studio Graph `doc.ts:275-336`, `index.ts:401-429` | Listed as a harvest item in `CANDIDATE-WORK.md`. Copying as graph text would also let a person paste a graph into Claude Code and back. |
| **Marquee select, snap-to-align guides, Alt-drag duplicate** | Studio Graph [surface.ts:37-70, 220-227](../../../studio/ara3d-sdk/wip/platoflow-poc/web/src/editor/surface.ts); Gratify [shared/marquee.ts:29-42](../../submodules/gratify/examples/shared/marquee.ts) | The editor selects one node at a time today. |
| **Tidy (T) and Fit (F) with an animated view** | Studio Graph [layout.ts:86-185](../../../studio/ara3d-sdk/wip/platoflow-poc/web/src/editor/layout.ts), `index.ts:503-557`; Gratify [shared/graph-layout.ts:46-88](../../submodules/gratify/examples/shared/graph-layout.ts) with spring animation | Have the layout (`autoLayout.ts:5`) and fit (`canvasEditor.ts:99-117`), but only in demo mode. An agent-built graph should arrive tidied. |
| **Scrub numbers, toggle booleans, chips for enums of 5 or fewer** | Studio Graph `geom.ts:111-136`, `widgets.ts:60-115, 333-424` | TKT-23 (node cards carry real controls). Studio Graph's rule for choosing chips over a dropdown is worth copying. |
| **Searchable picker with counts**, "Walls (216)" | Studio Graph `picker.ts` | Extends live suggestions (`suggestInput.ts`): the host already knows the counts. |
| **Docked focus editor for SQL**: click a schema name to insert it, result preview below, a slot for an AI assist button | Studio Graph [focus.ts:107-260](../../../studio/ara3d-sdk/wip/platoflow-poc/web/src/editor/focus.ts) | Replaces `longValueEditor.ts`'s plain textarea for `sql.query` and `duck.query`. |
| **Drag, resize and scrub merge into one undo step; an agent's batch undoes as one** | Studio Graph `doc.ts:122-156` (`graphBatchKey`); Kea [history.ts:25-96](../../../studio/labs/kea/src/app/history.ts) | TKT-17 (agent edits arrive undoable). |
| **DOM input pinned over the canvas through pan and zoom** | Gratify `src/gratify/island.ts`, `examples/island/main.ts:76` | Have: `canvasControls.ts` does this. |

### Moving around (larger graphs, later)

| Idea | Where | Notes |
|---|---|---|
| **Minimap** showing each node in its colour and the view as a frame | Gratify [shared/minimap.ts:35-63](../../submodules/gratify/examples/shared/minimap.ts) | Display-only; clicking to jump is not built. P2. |
| **Box zoom**: drag a rectangle, the view animates to fit it | vim-web `src/vim-webgl-viewer/inputs/mouse.ts:208-293` | A 3D viewer pattern that carries over. |
| **Semantic zoom**: below 0.5 cards shrink to title and status chip | Studio Graph `geom.ts:40, 201-215` | Out of scope per `PROJECT.md`. The minimal version (hide parameter rows when zoomed out) may still be worth it for the 11-node 3D recipe. |
| **Wire bundles**: B ties parallel wires into one ribbon | Kea `document.ts:346-361`, `render.ts:111-169` | No workflow needs it. |

### Code and graph

| Idea | Where | Notes |
|---|---|---|
| **Flip a selection to code and back**: incoming wires become parameters, the outgoing wire the return value; a reconcile pass keeps surviving nodes' ids and positions | PlatoFlow [src/flow/panel.ts:14-40](../../../studio/labs/platoflow/src/flow/panel.ts), `src/flow/astify.ts`, `codegen.ts` | Two targets fit BimOpenFlow. **Graph as text:** `BimOpenFlow.GraphText` already renders graphs as text, so a text view of the open graph costs little and gives the agent and the person the same view. **Chain to SQL:** fuse a run of table nodes into one `sql.query` (Dynamo's "Node to Code"), or expand one into its steps. The reconcile pass is what keeps a round trip from scrambling the layout. |

## What other tools do

A brainstorm, grouped by the question the feature answers. Each row names the tools where it is best known and says whether it fits BimOpenFlow's brief. "Fits" means it serves a named workflow and respects the principles in `PROJECT.md`. "Conflicts" names the principle or scope line it breaks.

### Is my data right at this step?

| Feature | Known from | Fit |
|---|---|---|
| Traffic-light status on every node (not configured, configured, executed, failed) | KNIME | Have, as the status dot (TKT-10). |
| View the output table of any port, from a right-click | KNIME, Alteryx ("browse anywhere") | TKT-11. |
| A preview bubble under a node, pinnable so it stays open | Dynamo | Pinned peeks on one or two wires are the natural extension of TKT-11. Fits. |
| A probe placed on a wire that keeps showing its value | LabVIEW probes, Unreal watch values | Same as a pinned peek. |
| Column profile in the preview: distinct count, nulls, distribution | Power Query, Alteryx | Fits principle 3: a null count per column makes honest absence visible before a report hides it. |
| Input, output and schema views side by side for the selected node | n8n | The inspector pane could show input and output schemas together; relates to TKT-74 (show a node's schema before it is clicked). |
| A live thumbnail of each node's output | TouchDesigner, Nuke postage stamps | For `view3d` nodes only; costly elsewhere. |
| Execution time per node, as an overlay | Grasshopper profiler, Blender geometry nodes timings, Houdini performance monitor | Fits: the host times each evaluation; slow SQL is the first thing an analyst will hit on Snowdon's 456,598 instances. |
| Execution highlighted as it flows | LabVIEW highlight execution, Unreal during play | TKT-33. |

### Why is this node not ready?

| Feature | Known from | Fit |
|---|---|---|
| An error list window; clicking an entry selects the node | LabVIEW (broken run arrow), Visual Studio | Fits: one list of every warning and error in the graph, sorted upstream first. |
| Middle-click info popup: cook time, row count, memory, last error | Houdini, TouchDesigner | Fits; the same data as the help expando's status section. |
| Trace precedents and dependents as arrows | Excel | Have for upstream (TKT-24); downstream is the missing half ("what breaks if I change this?"). |

### How do I build this faster?

| Feature | Known from | Fit |
|---|---|---|
| Tab or double-click search anywhere on the canvas | Houdini, Blender, ComfyUI, Unreal | Fits; see "Right-click canvas → palette" above. |
| Context-sensitive palette from a dragged wire | Unreal, Blender, Enso | P0; see above. |
| Recommended next node from usage statistics | KNIME Workflow Coach | Fits better here than anywhere: the sample graphs are a corpus of 4-to-8-node pipelines. "After `duck.query` people usually add `table.filter`." Could also come from the agent. |
| Drag a field from the input table into a parameter | n8n expression mapping | Fits: drag a column header from the table pane onto a `columnSelect` parameter. |
| Shake a node to disconnect it | Houdini | Low value. |
| Detach a node from its wires, healing the chain | Blender | Fits: the inverse of splice-on-wire, and one `removeNode` plus one `connect`. |
| Code block node: type an expression, ports appear from its variables | Dynamo Code Block, Enso | `sql.query` is this already. |
| Favourites and recent nodes at the top of the palette | Unreal, Houdini | Small; fits. |
| Snippets: insert a saved group of nodes | Houdini, Node-RED library, Blender asset library | Templates at node scale; TKT-14 (template gallery) covers graph scale first. |

### How do I keep a graph readable?

| Feature | Known from | Fit |
|---|---|---|
| Frames or comment boxes that move their contents | Blender, Unreal, Dynamo, Houdini, ComfyUI | Option 1 above. Fits. |
| Sticky notes with Markdown | n8n, Houdini, Node-RED | Fits, as layout metadata. `platoflow-v1-nodes.md:346` proposed a `graph.note` node, which would change the hash; metadata would not. |
| Reroute dots | Blender, Unreal, Houdini, Nuke, Grasshopper relay | Low need for linear graphs. |
| Straighten and align selected nodes | Unreal (Q), Grasshopper | Small; fits once marquee selection exists. |
| Wire display modes: normal, faint, hidden | Grasshopper | No need at 4 to 8 nodes. |
| Bookmarks: saved view positions | Houdini quick marks, Unreal | Out: graphs fit on one screen. |

### Can I trust and reproduce this?

| Feature | Known from | Fit |
|---|---|---|
| A design mode where writes are disabled until you switch to live | Enso execution environments | This is principle 2 ("nothing writes until Run"). Enso is prior art worth citing, and its visual cue (write nodes greyed with a label) is a design reference for "will write on Run" on sinks. |
| Pin a node's output so upstream does not re-run | n8n pinned data | Partly conflicts with principle 4: a pinned value is an input the run must hash. Fits if a pin becomes a content-hashed input. |
| The graph embedded in the output file, so dropping the output restores the graph | ComfyUI (PNG metadata) | Fits workflow 5: the evidence package already pins the graph hash; dropping `manifest.json` on the editor could open the exact graph. |
| Graph diff between two versions | Unreal Blueprint diff, dbt | TKT-17 (agent edits as a reviewable diff) and run-versus-run diff. |
| Run history as a grid, one column per run, one row per node | Airflow grid view | Fits the run history panel in the earlier proposal. |
| Freeze or bypass a node | Dynamo freeze, Houdini bypass, Blender mute, ComfyUI bypass | Bypass on a pure filter fits (what does the table look like without this step?), if bypass is a parameter and so part of the hash. Freeze is n8n's pin. |

### How do I hand this to someone who does not wire nodes?

| Feature | Known from | Fit |
|---|---|---|
| A player that runs the graph with only its exposed inputs showing | Dynamo Player, Max presentation mode, Grasshopper Remote Control Panel | Fits the analyst directly: a template shows a strip of promoted parameters and a Run button, with the canvas hidden. The earlier proposal's control strip. |
| Masked subgraph: a block with its own parameter dialog | Simulink masks, KNIME components, Houdini digital assets | Needs option 3; later. |
| Step list view of a linear pipeline | Power Query applied steps | Strong fit: nearly every BimOpenFlow graph is linear, so a step list beside the canvas is a second way to read and edit the same graph, and the form an analyst already knows from Excel. |

### Declined

These are real features that `PROJECT.md` puts out of scope or that break a principle: multiplayer cursors and comments pinned to the canvas (Figma, Miro; no multi-user service), a graph drawn in 3D, new wire types for loops or events (Unreal execution pins, vvvv regions; principle 5), per-wire lacing modes (Dynamo, Grasshopper data trees; tables already are the list), and ComfyUI's "convert widget to input", which makes a scalar parameter a socket (principle 5 keeps scalars on the node).

## Recommended order

Each item names what it builds from. The first five need no engine or format change.

1. **Connect wire peeking** (TKT-11): pass results into `buildCanvasModel`, call `installPortHover`, copy Studio Graph's hiding rules from `wires.ts:82-135`.
2. **Help expando on every node**: port Studio Graph's `helpLines` and layout; content from the catalog and `nodeBadge.ts`. One new ticket.
3. **Wire-drop palette, canvas palette, splice on wire, one undo step per add**: port Studio Graph `palette.ts`, `wires.ts:308-447`. One ticket; it also closes the TODO at `app.ts:331`.
4. **Marquee, copy and paste, tidy and fit outside demo mode**: Gratify `shared/marquee.ts`, Studio Graph `doc.ts:275-336`, the existing `autoLayout.ts`.
5. **Frames and notes as layout metadata** (grouping option 1).
6. **Per-node timing and an error list**: needs the host to report evaluation time.
7. **Step list view** of linear graphs, and graph as text from `BimOpenFlow.GraphText`.
8. **Chain-to-SQL fuse and expand**: needs a host endpoint that composes SQL.

Items 1, 3 and 4 were already P0 or P1 in the earlier proposal; the new part is the working code to start from.

## Questions for the owner

- Should a frame fold into one card (grouping option 2) before the specification has a subgraph kind, or is a folded view that hides nodes from the person but not from the agent confusing?
- Is a real subgraph kind (option 3) wanted this stretch? Nothing in the six workflows requires one.
- Should notes and frames live in the graph file (and so travel with it into a run) while staying out of the graph hash?
- Is the step list a second editor, or a read-only view? A second editor must follow principle 1 as strictly as the canvas does.
