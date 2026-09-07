# BIM Open Toolkit Visualization

Product description and prioritized capability brief

**Package:** `@bim-open-toolkit/visualization`  
**Project:** BIM Open Toolkit  
**Language and platform:** TypeScript, browser, WebGL 2  
**Status:** Proposed product scope for architecture and implementation planning  
**Date:** September 7, 2026

This document defines the intended product, its benefits, feature priorities, dependencies and acceptance outcomes. It is an input to a software architect or planning agent. It does not prescribe final source-file boundaries, estimate delivery dates or claim that the proposed capabilities already work. The architect should convert it into small, independently verifiable implementation tasks using Parallel Wave and Platonic Coder.

## 1. Product purpose

BIM Open Toolkit Visualization is a TypeScript library of composable components and tools for loading, exploring, presenting and interactively modifying BIM models in a browser. Its primary format is BIM Open Schema (BOS). It also supports GLB, GLTF, OBJ and STL so applications can combine building information with conventional 3D assets.

Developers can use a complete default viewer, select a few capabilities for an existing application, or supply their own interface around the same typed operations. A schedule application might need only selection, coloring and a small 3D view. A coordination application might combine multiple models, clipping, clearance overlays and saved review views. A simulation application might supply its own changing data and use only rendering, animation and legends.

The product makes these combinations possible without requiring developers to understand renderer internals or fork demonstration code. A feature has a useful data/API layer before it gains a UI. Default UI is a consumer of those APIs, with no privileged access unavailable to other applications.

### Who benefits

| Audience | Benefit |
|---|---|
| Developers new to 3D | A short path from a model file to a useful viewer, documented defaults and focused examples. |
| Application developers | Features that fit into existing layouts, state management and React applications. |
| BIM workflow developers | Reliable links between objects, tables, analysis results, spatial views and evidence. |
| Advanced graphics developers | Explicit geometry, rendering and resource boundaries that can be extended without changing the product's workflow semantics. |
| Architects and coding agents | Small typed contracts, clear ownership and quick verification of independent components. |
| End users | Responsive navigation, understandable visual encodings and reproducible views of model information. |

### Product commitments

- WebGL 2 is the minimum rendering platform. WebGPU and experimental browser flags are not required for V1.
- BOS is the first integration and performance priority. All five requested formats belong in the proposed V1 scope, with their supported subsets documented.
- Most V1 demonstrations and the default viewer use Gratify for canvas UI, HUD controls and sidebars.
- Core functionality is usable without Gratify, React or the default viewer shell.
- A non-trivial React demonstration must exercise the same public APIs and meet the relevant performance checks.
- Performance and responsiveness are part of feature acceptance from the first increment.
- Existing Ara 3D and BIM Open Toolkit code may be reused when it fits these goals. Compatibility with Ara's internal architecture is not a product requirement.

## 2. Scope, priorities and interpretation

**P0 — V1 foundation and release requirement.** The first useful, composable product depends on this behavior. Some P0 items occur late in the sequence because their prerequisites come first.

**P1 — V1 enhancement candidate.** Valuable follow-on increments after the relevant P0 behavior is verified. These should be planned explicitly; they do not silently become V1 release requirements.

**P2 — advanced extension.** Preserve room for the capability, then investigate and implement it separately. A P2 label defers work rather than removes the requested feature.

The staged scope below is a recommendation. It gives the architect a defensible implementation order while retaining the full requested feature set.

Two interpretations are made explicit:

- “Basked lighting” is interpreted as **baked lighting**, such as imported lightmaps or precomputed lighting data.
- “Open Map context” is interpreted as an open map integration, initially using an OpenStreetMap-based context or equivalent provider. Final map renderer and tile/data provider remain architectural choices.

V1 is a visualization and review toolkit. Local geometry and presentation edits are supported through explicit overlays. Full BIM authoring, source-file round-trip export, simultaneous collaborative editing, production engineering simulation and automatic compliance certification are separate products or extensions. Persistence in this brief means serializable state and a storage adapter; it does not require a hosted account service.

## 3. Separation of concerns

These boundaries are product requirements. They describe responsibilities, not a mandatory package count.

| Boundary | Owns | Must not own |
|---|---|---|
| Typed contracts and pure operations | Identity, units, coordinate frames, selection, styles, edit operations, view state, diagnostics and deterministic transformations. | DOM elements, renderer resources, network connections or UI widgets. |
| Format adapters | File/resource resolution, parsing, normalization, format diagnostics and source-to-object mappings. | Camera behavior, viewer panels or application workflow rules. |
| Geometry and render resources | Meshes, instances, resource lifetime, derived representations and efficient buffer updates. | BIM property interpretation, rate calculations or UI state. |
| Rendering | Drawing the supplied scene, material effects, clipping and quality controls. | Fetching source files, inferring domain relationships or saving application documents. |
| Interaction | Camera input, picking, manipulators and translation of input into typed commands. | Private copies of application selection or business decisions. |
| Visualization features | Color mapping, overlays, navigation aids, edit composition, animation and presentation layouts. | Dependence on a particular UI framework. |
| UI adapters | Gratify controls, optional React bindings, themes and accessible interaction surfaces. | Alternative implementations of selection, undo or geometry logic. |
| Host integrations | Storage, resource access, map providers, MCP transport, application permissions and workflow data. | Direct uncontrolled mutation of renderer internals. |
| Demos and workflow recipes | Composition of public capabilities into complete experiences. | Essential functionality that can only be reused by copying the demo. |

### Public API experience

Offer a convenient default composition and smaller opt-in imports under the published package. The architect should choose exports that keep unused UI and expensive effects out of a minimal consumer bundle. Package-internal subdivision must not force beginners to assemble a dependency graph before loading a model.

Use a consistent vocabulary for creation, updates, subscriptions and disposal. Operations identify their target model/view explicitly. Expected failures return useful typed diagnostics. Long operations expose progress and cancellation. Subscription and resource ownership are documented. Importing the non-UI API must not access `window` or create a WebGL context.

Typed boundaries should be plain data where practical. Large geometry buffers need explicit ownership and sharing rules; an immutable public model must not cause full copies of millions of vertices for every visual change. GPU, DOM and worker mutation belongs behind small, controlled adapters.

### Gratify integration

The project already declares `submodules/gratify`. Continue consuming and pinning Gratify through that submodule during development so improvements remain reviewable and can move upstream.

Generic touch routing, layout, focus behavior, themes, text scaling, reusable controls and performance improvements belong in Gratify. BIM object identities, storey navigation, BOS loading, clipping commands, analysis legends and workflow-specific panels belong in this toolkit or its Gratify adapter. Gratify must never import BIM Open Toolkit.

A published package must install without requiring users to initialize Git submodules. The release plan must define whether the UI adapter depends on an appropriate Gratify release or includes permitted build artifacts, while preserving license information and avoiding duplicate runtime copies.

The current Gratify README describes a desktop-first canvas interface, untested mobile/touch behavior and limited screen-reader exposure. Touch, focus and accessible alternatives are therefore implementation work to validate, not assumed inherited capabilities. Essential actions must also be available through keyboard and host-accessible controls.

## 4. Shared data concepts

The architect should establish these contracts before assigning dependent feature work. Names below describe concepts; they are not final exported type names.

| Concept | Required meaning |
|---|---|
| Model reference | A loaded source or model version, with a stable reference distinct from its runtime handle. |
| Object reference | Model/snapshot scope plus object identity. Never rely on a bare source row index across models or revisions. |
| Representation reference | Geometry or another representation of an object. One object may have many representations or none. |
| Coordinate context | Units, axis conventions and transforms between source, model, project and map coordinates. Unknown registration stays explicit. |
| Scene description | Referenced geometry, instances, transforms and effective appearance, independent of the renderer. |
| Object set | A typed, reusable scope for selection, filtering, styling and edits; distinguishes stored membership from a query definition. |
| Visual rule | A mapping from object data or set membership to color, opacity, visibility, outline or representation. |
| Edit set | An ordered, identifiable group of operations with base references and an explicit undo/replay policy. |
| View state | Camera, sectioning, selection references, appearance rules, environment, quality settings and enabled overlays. |
| Annotation/overlay | A graphic or text item anchored to a coordinate frame, object, surface or screen location. |
| Task status | Progress stage, completion/cancellation/failure and diagnostics for expensive work. |
| Observation/coverage | Known versus unavailable or conflicting values, evidence references, units and completeness. |

All formats share the visual contracts. Geometry-only formats must not fabricate BIM classifications, rooms, units or persistent source identity. Provide explicit user/host overrides when source units or location are unknown.

BuildingModel identities and facts are adapted into these contracts. The visualization core does not need to import the entire BuildingModel domain or load every property to render an object.

## 5. Feature catalog

Each feature below identifies its purpose, incremental deliverables, dependencies and a focused demonstration. Every stage also inherits the documentation, composability and validation requirements in Sections 8–10.

### F01. Model identity and scene foundation — P0

**Benefit:** Every later feature can refer to the same objects reliably across tables, render instances, edits and saved scenes.

**First deliverable:** Typed identity and coordinate contracts; one model with shared mesh resources and instances; add/remove/dispose lifecycle; source-object lookup in both directions. Represent records without geometry.

**Next deliverable:** Multiple model references and independent transforms; explicit mapping to snapshots and alternate representations. Preserve original source identity when filtering, reordering or regrouping instances.

**Dependencies:** None. This is the first contract milestone.

**Demo and acceptance:** Two models reuse the same local object IDs without selection collisions. Disposing one model leaves the other usable. A geometry-free record remains addressable.

### F02. File loading and fast opening — P0

**Benefit:** Developers can use a familiar loading flow across BIM and ordinary 3D formats while users receive early feedback.

**First deliverable:** BOS from a local file, URL or supplied bytes; staged progress, cancellation and useful parse diagnostics; geometry-first opening with optional property loading. Measure first useful frame and fully ready state separately.

**Next deliverable:** GLB and GLTF, including an explicit resource resolver for external buffers and textures; OBJ with a documented material/MTL subset; ASCII and binary STL. Document supported materials, missing resources, axis/unit handling and identity limitations. Host-provided resources support local multi-file assets.

**Follow-on P1:** Worker parsing, chunked population, prepared geometry, cache reuse and selective loading where measurement shows value. Do not describe a full-file parse as streaming merely because progress callbacks exist.

**Dependencies:** F01 and a minimal F03 rendering path. Format parsing tests can precede the renderer.

**Demo and acceptance:** A format gallery opens each supported format, including an external-resource GLTF case. The Snowdon demo opens BOS with progress and remains cancelable. An interrupted load releases its resources and cannot populate a subsequently opened model.

### F03. Rendering and bulk object updates — P0

**Benefit:** Large models remain useful when applications change many objects at once.

**First deliverable:** WebGL 2 rendering, shared/instanced geometry, on-demand drawing, resize handling, deterministic disposal and a batch update API for visibility, color, opacity and transforms.

**Next deliverable:** Replace a selected object's representation with a box or supplied mesh without rebuilding unrelated geometry. Apply 10,000-object updates as one logical operation, with completion meaning the result is visible. Keep source geometry shared until an edit requires a private replacement.

**Follow-on P1:** Changed-range GPU updates, spatial acceleration, quality adaptation and resource reuse informed by profiling. Context loss must have a documented recovery path or explicit recoverable error.

**Dependencies:** F01; generated geometry allows development independently of BOS parsing.

**Demo and acceptance:** A repeatable bulk-update panel changes 10,000 objects in a scene of up to 10 million displayed triangles and reports end-to-end update latency. Test visibility, colors, transforms and replacement separately. Section 8 defines the performance target and workload boundaries.

### F04. Cameras and configurable navigation — P0

**Benefit:** The same model supports inspection, floor planning and immersive exploration.

**First deliverable:** Perspective and orthographic cameras, orbit navigation, fit-to-model/selection and stable camera state. Switching projection preserves a sensible target and approximate framing.

**Next deliverable:** First-person navigation, fixed overhead mode, adjustable speed/sensitivity, configurable input bindings and optional movement/rotation constraints. Camera animation is interruptible by user input.

**Follow-on P1:** Collision-aware walking or gravity where suitable geometry is available. Basic first-person mode does not imply these behaviors.

**Dependencies:** F01, F03. Camera mathematics and input mapping are tested without a rendered scene.

**Demo and acceptance:** A camera laboratory uses the same model to switch modes, save/restore a pose and alter controls. Overhead navigation remains fixed in orientation. Independent viewers do not capture each other's keyboard input.

### F05. Mobile, touch and input coexistence — P0

**Benefit:** Core viewing works on touch devices and within applications that also need scrolling and gestures.

**First deliverable:** Touch orbit, pan and pinch zoom; tap selection; pointer cancellation; touch-sized controls; responsive sidebars and orientation/resize handling. Resolve gesture ownership between model navigation, manipulators, Gratify widgets and the host page.

**Next deliverable:** Usable touch first-person controls, a documented mobile quality preset and validation on named physical mobile devices. No essential action depends on hover.

**Follow-on P1:** Pen-specific interaction and richer multi-touch editing.

**Dependencies:** F04, F06 and F09. Validate generic Gratify input changes early, using non-BIM fixtures.

**Demo and acceptance:** A mobile viewer demonstrates navigation, selecting an object, opening its details and changing a setting without accidental camera movement. Test page scrolling outside the viewer and interruption of a gesture.

### F06. Hit testing and pointed-at objects — P0

**Benefit:** Applications can inspect and select what users point to without learning mesh batching details.

**First deliverable:** The simplest correct picking implementation, returning object/representation identity and a world-space hit point. Show the pointed-at object's name with a documented fallback when a name is absent.

**Next deliverable:** Define behavior for invisible, clipped, ghosted and replacement geometry. Throttle hover queries if needed. Avoid stale hit results after model changes or disposal.

**Follow-on P1:** Faster picking only when profiling requires it; face and sub-element references for geometry editing and surface markup.

**Dependencies:** F01, F03, F04. Later clipping and geometry-edit stages extend the same picking contract.

**Demo and acceptance:** Point at, click, hide, clip and replace objects while preserving correct names and IDs. Picking need not run at frame rate, but must not cause prolonged navigation stalls.

### F07. Selection sets and linked data — P0

**Benefit:** Users work on meaningful groups and move between spatial and tabular views.

**First deliverable:** Single/multiple selection, replace/add/remove/toggle operations, named sets, selection change events and basic union/intersection/difference operations.

**Next deliverable:** Link selections to host tables, charts and trees; isolate/fit a set; distinguish current selection from persistent named sets. Support geometry-free records and unresolved members.

**Follow-on P1:** Query-defined sets with explicit refresh semantics and large result handling.

**Dependencies:** F01; interactive selection uses F06. Serialization integrates with F17.

**Demo and acceptance:** A sorted/filtered door table and viewer share selection. Selecting a set updates both once without an event loop. Two different application controls can compose set operations.

### F08. Appearance, ghosting and heat maps — P0

**Benefit:** Data becomes spatially understandable while users keep surrounding context.

**First deliverable:** Color by category or numeric value, palettes and legends; constant style overrides; partial transparency and hidden state; selected versus context appearance. Preserve original materials for reset.

**Next deliverable:** Composable rules with deterministic precedence; fixed scales for comparison; thresholds; explicit visual treatment of unavailable/conflicting values; interactive legend filtering. Include wireframe/edge ghosting as a separately selectable mode.

**Follow-on P1:** Surface or sampled-field heat maps and more sophisticated transparency. Document blending artifacts in the initial implementation rather than implying physically exact transparency.

**Dependencies:** F01, F03 and F07. Legend UI uses F09 but color mapping does not.

**Demo and acceptance:** Switch a door model between category, dimension and data-coverage modes. Selection remains legible and reset restores the original appearance. A second demo ghosts context around a selected room.

### F09. Default UI, theming and developer composition — P0

**Benefit:** Beginners get a useful viewer and experienced developers retain control of their interface.

**First deliverable:** Gratify viewer shell with independently mountable toolbar, sidebar, legend and status components; light/dark themes; big-text mode; keyboard focus and documented shortcuts.

**Next deliverable:** Optional panels, configurable tools, theme tokens and responsive layouts. Define accessible labels/host alternatives, contrast and reduced-motion behavior. Big-text mode must reflow controls without hiding essential actions.

**Follow-on P1:** Additional reusable layouts and richer personalization.

**Dependencies:** F01 command/state contracts. Each control also depends on the feature it presents. Early Gratify integration can use synthetic data.

**Demo and acceptance:** The same view operates with the default shell, a minimal canvas-only host and a custom React layout. Theme changes affect UI without silently changing analytical color meanings.

### F10. Environment and basic lighting — P0; enhanced effects P1

**Benefit:** Models have useful depth cues and can be presented clearly with sensible defaults.

**First deliverable:** Toggleable ground plane, scale-aware grid, background/sky image and a simple configurable light setup. Environment does not enter object inventories or fit-to-selection bounds.

**P1 increments:** Shadows and ambient occlusion, each independently switchable with documented quality and performance cost. Support imported baked lighting after defining supported material/texture inputs.

**Dependencies:** F03, F04, F09 for controls; imported textures use F02 resource resolution.

**Demo and acceptance:** A lighting comparison shows the same camera and model under individual effects, with a performance baseline. Analytical coloring remains readable when presentation lighting is enabled.

### F11. HUD and spatial navigation aids — P0 basics; P1 spatial navigation

**Benefit:** Users understand both viewer performance and their location in a building.

**P0 deliverable:** FPS, CPU frame work, GPU timing when supported, camera type, axis indicator, scene statistics and pointed-at object name. Distinguish source objects, visible instances and rendered triangles; unavailable GPU timing displays as unavailable.

**P1 increments:** A 2D local mini-map; fixed 3D overview with level navigation; current-room display; clickable adjacent rooms that teleport the camera; object labels; a ground or spatial arrow toward a selected destination, optionally clickable.

**Dependencies:** F03–F06 and F09 for basics; F01 spatial context, F14 overview viewports and F18 overlays for spatial navigation. Room location and adjacency require supplied spaces/relationships or a separately validated derivation.

**Demo and acceptance:** Navigate Snowdon by level. Use a controlled room fixture where adjacency is unavailable in source data. Unknown current room is explicit. Teleport and directional guidance do not claim a walkable route or collision-free destination without supporting data.

### F12. Slicing and see-through inspection — P0 planes/box; P1 advanced regions

**Benefit:** Users reveal interior information without editing the source model.

**P0 deliverable:** Horizontal, vertical and arbitrary angled planes; clipping enable/reset; a box region; simple manipulators for position and orientation. Store clipping as view state.

**P1 increments:** Spherical regions with position/radius, conical regions with direction/width/range and composable region rules. Define inside/outside, union/intersection and boundary behavior before implementation.

**P1 see-through stages:** First hide or ghost the whole wall under the pointer temporarily. Then provide a circular reveal area with a declared screen-space or world-space definition. Restore the prior appearance when the tool ends.

**Dependencies:** F03, F04, F06, F08 and F09; persistence uses F17. Whole-wall reveal requires a host-supplied classification or wall set; arbitrary meshes must not be silently treated as walls.

**Demo and acceptance:** A section laboratory demonstrates all supported regions and manipulator controls. Hidden/clipped surfaces do not incorrectly block picking. Circular wall reveal affects the intended wall rather than indiscriminately clipping every object behind it. Initial slicing need not produce capped solids or exportable cut geometry.

### F13. Exploded and arranged object layouts — P0 basic; P1 richer layouts

**Benefit:** Assemblies, levels and categories can be inspected without visual overlap.

**First deliverable:** Explode by level or elevation; arrange selected objects/groups in a line or 2D grid; reset to original placement. Compose offsets without altering the original coordinate frame.

**P1 increments:** 3D layouts, configurable spacing, grouping rules and transitions.

**Dependencies:** F01, F03 and F07; F08 for independent color rules. Undoable presentation changes can use F15 without becoming permanent model edits.

**Demo and acceptance:** Separate floors, inspect a selection and restore the source layout. Spatial measurements, map placement and BuildingModel findings continue to refer to original coordinates unless the user explicitly chooses displayed coordinates.

### F14. One, two and four views — P0 two-view; P1 four-view

**Benefit:** Users compare models, revisions, scenarios and orientations without losing context.

**First deliverable:** One or two resizable viewports with independent cameras and explicit options for linked camera, selection, clipping and appearance. Share immutable geometry where practical.

**P1 increment:** Four views and reusable fixed-overview navigation. Define whether comparison means different snapshots, different scenarios or different views of one scene.

**Dependencies:** F01, F03, F04, F07 and F09. Revision correspondence is supplied through F26, not inferred by the viewport system.

**Demo and acceptance:** Compare perspective and plan, then before/after data. Linked updates do not echo indefinitely. Resizing and closing a pane releases its view resources without destroying shared model data. Benchmark each viewport count separately.

### F15. Layered edit sets and undo/redo — P0 basic

**Benefit:** Applications can explore changes safely and reproduce or remove them as a group.

**First deliverable:** Ordered edit sets for adding, hiding/deleting, transforming and restyling objects; enable/disable layers; undo/redo at a documented transaction boundary. Source objects remain unchanged beneath the layers.

**Next deliverable:** Deterministic composition, object references for additions and tombstones for deletions; explicit conflict handling; inspectable edit history. Replaying the same edit set against the same base produces the same effective scene.

**P1 increment:** Independent alternative edit branches and migration/reconciliation when the base model changes.

**Dependencies:** F01, F03, F07 and defined F08 precedence. Saving uses F17. Keep transient hover/selection state separate from model edits.

**Demo and acceptance:** Move, hide, add and recolor objects across two layers; toggle the layers and undo/redo. Undo of one edited instance does not alter another instance of the same mesh. Deletion is a local overlay operation, not a write back to BOS.

### F16. Editable geometry chains and level of detail — P0 replacement; P1 editing/LOD

**Benefit:** A single object can change quickly inside a large model without rebuilding the rest.

**P0 deliverable:** Replace one object's geometry with supplied editable geometry; record the replacement in F15 and retain its base reference. Recompute affected bounds, normals and picking information as appropriate. Preserve the original shared prototype for unedited objects.

**P1 increments:** A small geometry editing tool, followed by a chain of named geometry operations with undo and cached intermediate results. Add explicit high-detail, simplified and box representations, then automatic LOD selection if justified by measurements. Chain dependencies and cache invalidation must be local and inspectable.

**Dependencies:** F01, F03, F06 and F15. Advanced sub-element editing extends the hit-testing contract.

**Demo and acceptance:** Edit one repeated object in Snowdon while navigating the surrounding model. Undo restores it. A deterministic fixture proves that other instances remain unchanged. A heavy mesh replacement reports generation time separately from scene update time.

### F17. Scene saving and saved views — P0

**Benefit:** Applications can resume a review and share a reproducible visualization configuration.

**First deliverable:** Versioned serialization of model references, camera, selection/named sets, coloring modes, saved views, environment and render settings. Restore through a host-provided model/resource resolver.

**Next deliverable:** Include clipping, layout, edits, overlay/markup references and active scenario. Distinguish saved view state from the larger scene document and from binary geometry payloads. Supply a simple local storage/file adapter and a generic host adapter contract.

**P1 increment:** Migration between saved schema versions and richer packaged scene exchange.

**Dependencies:** F01 and the serializable contracts of each included feature. F15 is required when saving edits.

**Demo and acceptance:** Save, dispose, reopen and restore a scene in a fresh page. Missing models, changed versions, unresolved IDs and unavailable external assets generate explicit diagnostics. Screenshots alone do not count as saved scenes.

### F18. Analytical overlays and clickable points of interest — P0

**Benefit:** Workflow results can be explained spatially without being baked into model geometry.

**First deliverable:** Independent layers of points, lines, arrows, labels, boxes, paths and simple transparent volumes; visibility/style controls; typed click actions; anchors to objects or coordinates.

**Next deliverable:** Links to tables and evidence, label density controls and declared occlusion/depth behavior. Provide reusable clearance-envelope and service-trace examples.

**P1 increment:** Surface overlays, richer field data and interactive route guidance.

**Dependencies:** F01, F03, F06 and F08; UI uses F09. Specialist result calculation remains outside this feature.

**Demo and acceptance:** Click a point of interest to select equipment and open its result. Render an access region as a candidate finding with its supplied basis. Hidden overlays neither draw nor intercept unintended clicks.

### F19. Persistent markup — P0 text; P1 drawing

**Benefit:** Review notes stay attached to the relevant place and can be reopened later.

**First deliverable:** Add/edit/remove text annotations with object or world anchors and saved-view references. Persist through F17. Clearly distinguish screen-fixed UI from model-anchored notes.

**P1 increment:** 2D drawing strokes, callouts and shapes on a saved view or declared plane; author/time metadata supplied by the host; reattachment diagnostics when geometry changes.

**Dependencies:** F06, F17 and F18; editing controls use F09. Annotations have their own history and need not alter model geometry.

**Demo and acceptance:** Place a note, move the camera, save/reopen and return to its view. A missing/deleted anchor remains an unresolved annotation rather than silently moving to a different object.

### F20. Screenshots and thumbnails — P0

**Benefit:** Applications can generate useful previews and include model views in reports.

**First deliverable:** Capture the active view to an image, with configurable resolution, background and inclusion of legends/overlays. Generate a thumbnail from a saved view without disturbing the user's active camera.

**P1 increment:** Batch thumbnails, multi-view composites and report-oriented capture presets.

**Dependencies:** F03, F04 and F17; UI/overlay inclusion uses F09/F18. Separate WebGL and Gratify canvases require an explicit capture composition step.

**Demo and acceptance:** Export a view with a legend and create thumbnails for saved cameras. The operation waits for the intended resources/frame and reports external-image origin restrictions rather than returning an unexplained blank result.

### F21. Basic animation and timelines — P0 examples; P1 richer authoring

**Benefit:** Applications explain movement, delivery and installation sequences with reusable time-based controls.

**First deliverable:** A supplied clock/time value drives transforms, visibility and appearance. Support play, pause, seek, rate and reset. Animation remains separate from permanent model placement and edit history.

**Required examples:** A person/avatar or clearly labeled proxy walks in a circle around a room; a simulated delivery timeline reveals and colors scheduled objects. The timeline is explicitly synthetic unless backed by supplied events.

**P1 increment:** Authored paths, richer avatar animation and multiple synchronized tracks.

**Dependencies:** F03, F04, F08 and F13; overlays use F18. Do not make skeletal animation or navigation mesh generation prerequisites for the first simple demonstration.

**Demo and acceptance:** Seeking directly to a time produces the same state as playback to that time. Reset restores the baseline. Delivered, accepted and installed states remain distinct when connected to real workflow data.

### F22. Snowdon in an open map context — P1

**Benefit:** Building visualization gains geographic context while retaining local model precision.

**First deliverable:** A map adapter places Snowdon using an explicit geographic anchor, heading, scale and height convention. Synchronize map and model cameras as required by the chosen integration.

**Next deliverable:** Correct local-to-map coordinate transforms, visible attribution, provider/resource configuration and a performance profile for map-plus-model rendering.

**Dependencies:** F01 coordinate contracts, F02, F03 and F04. Confirm geographic registration; if unavailable, use a declared demonstration placement instead of claiming the building's actual location.

**Demo and acceptance:** Show Snowdon with an open map context, navigate around it and select an object. Explain the placement basis. Handle missing tiles or network access gracefully. Map integration remains optional and does not add a map dependency to core consumers.

### F23. MCP integration — P0 bounded integration and compelling demo

**Benefit:** An assistant or other MCP client can operate the same visual capabilities available to a user or application.

**First deliverable:** A host-side bridge exposes a small typed command set: inspect loaded models/views, query a bounded object/property scope through a supplied data adapter, select/isolate objects, set colors, move a camera, save a view and capture an image. UI and MCP operations share commands and events.

**Next deliverable:** Explicit session/view targeting, task progress, cancellation, meaningful results and stale-model checks. The host owns connection setup, authentication and access scope. No arbitrary script execution API is needed.

**Dependencies:** F01, F07, F08, F17, F20 and F26's BuildingModel adapter. A command contract can be developed before the transport; transport and client setup remain a bounded architectural choice.

**Required demo:** An MCP client asks to find doors with missing or conflicting fire-rating information, colors those groups distinctly, selects one, shows source evidence, frames the selection and saves a labeled screenshot/view. Demonstrate one refinement, such as restricting the result to a storey. Use actual data where supported and identify any fixture data.

**Acceptance:** The demonstration uses a real MCP request/response path, not a text box that directly calls viewer functions. It does not invent ratings or treat missing data as a failed compliance assessment. Ordinary library consumers do not need to run an MCP server.

### F24. Advanced lighting, ray/path tracing and light simulation — P2

**Benefit:** Presentation and specialist applications can trade interactive speed for higher-quality lighting or inspect externally calculated light results.

**First investigation:** Compare the simplest feasible optional ray tracer or path tracer against the WebGL 2 baseline. A path tracer may replace a ray tracer if it is easier to integrate and validate. Define supported materials, geometry scale, memory requirements and image convergence behavior.

**Staged deliverables:** Progressive still-image rendering; restart/invalidation on camera or scene changes; denoising only if justified; imported/precomputed global illumination; then more demanding dynamic illumination techniques where feasible. Keep the interactive WebGL view available during expensive work.

**Light simulation:** First display supplied illuminance or other light-result samples with units, scale and provenance. Quantitative simulation is a separate adapter with explicit physical inputs and validation fixtures. A visually convincing image is not a verified lighting calculation.

**Dependencies:** F03 material/resource contracts, F10 environment, F18 result overlays and F20 capture. Quantitative work also needs geometry/material quality and a declared solver boundary.

**Demo and acceptance:** Compare raster and progressive rendering from the same saved camera and disclose unsupported effects. A separate light-results fixture shows units and a legend. This feature does not introduce a WebGPU requirement or a 30 FPS promise for converging path-traced images.

### F25. Voxelized representation — P1 bounds preview; P2 mesh-derived occupancy

**Benefit:** Applications can inspect density, simplify a complex model or visualize analysis on a regular spatial grid.

**First deliverable:** A bounded, cancellable voxel-grid representation generated from supplied occupancy data or bounding boxes. Expose cell size, grid origin/frame, bounds and a maximum cell/memory budget.

**Next deliverable:** Occupancy/count coloring, legend and mapping from cells to contributing object IDs. A bounds approximation is explicitly labeled.

**P2 increment:** Triangle/surface voxelization and, separately, solid occupancy with documented assumptions and validation. Use sparse storage when appropriate. Do not allocate an unbounded dense grid from arbitrary model extents.

**Dependencies:** F01, F03, F08 and F18; replacement display can use F16. Existing BIM Open Toolkit voxel nodes are potential reusable inputs.

**Demo and acceptance:** Toggle between original geometry and voxel density at two resolutions, inspect contributing objects and show memory/processing cost. A tiny independent fixture verifies known occupied cells.

### F26. BuildingModel workflow adapters and recipes — P0 first recipe; P1 expansion

**Benefit:** Domain results become useful applications without embedding BuildingModel calculations in the renderer.

**First deliverable:** A bounded typed result adapter that preserves object/snapshot identities, units, coverage, missing reasons and evidence links. Build the room/door schedule and exceptions recipe with selection, colors and saved views.

**Next increments:** Revision comparison with supplied correspondences; roof/finish quantity coverage; estimate/carbon scenarios; procurement/installation states; valve traces; access coordination; asset maintenance; portfolio drill-through.

**Dependencies:** F01, F07, F08, F17 and F18. Comparison uses F14; dated results use F21; specialist overlays depend on their supplied data.

**Demo and acceptance:** Each recipe identifies its input contract and whether the demonstration is source-backed, controlled or mixed. Incomplete quantities never appear as zero; uncertain matches are not forced into additions/deletions; bounding-box candidates are not presented as verified clashes. Views work when some records have no geometry.

### F27. Documentation, standalone demos and verification tools — P0 from the start

**Benefit:** Features remain discoverable, easy to adopt and quick for independent agents to verify.

**First deliverable:** Generated API reference from documented TypeScript exports, a beginner quick start and a minimal no-UI example. Every feature has a named standalone demo using public APIs and a small deterministic fixture.

**Next deliverable:** A demo gallery with feature/dependency labels, reusable validation harness, performance reports and a non-trivial React integration. Documentation states defaults, units, ownership, limitations and failure behavior.

**Dependencies:** Starts with F01. Generation tooling is shared infrastructure, not duplicated by individual feature authors.

**Acceptance:** Examples compile against the public package. Generated documentation is checked for freshness. A feature has focused checks and a documented command; full Snowdon loading is not required for every unit test.

## 6. BuildingModel workflow coverage

The library presents domain results and preserves their meaning. Source interpretation, cost/carbon arithmetic, network traversal, compliance assessment and engineering calculations remain in their respective model/workflow services.

| Workflow | Visual capabilities | Required input or important limit |
|---|---|---|
| Building, room and door schedules | F07 selection, F08 exceptions/heat maps, F11 level navigation, F26 linked tables. | Stable object identities, locations and facts; schedules still work without geometry. |
| Revision review | F14 linked views, F08 change colors, F17 saved comparison. | Two comparable snapshots and correspondence/coverage evidence; disputed matches stay unresolved. |
| Roof and room-finish takeoff | F18 surface scopes, F08 coverage colors, F07 result selection. | Supplied measurement basis and distinct finish faces; rendered triangles are not automatically authoritative quantities. |
| Pricing alternatives | F08 cost/unpriced scope, F14 scenarios, F17 reproducibility. | Rates, currency, quantities and scenario policy supplied by the workflow. |
| Delivery and installation | F21 timeline, F08 state colors, F18 location markers. | Dated observations; delivered, accepted and installed remain separate. |
| Valve isolation | F18 directed lines/arrows, F07 affected object sets, F11 navigation. | Accepted topology and trace coverage; nearby pipes are not assumed connected. |
| Shared penetrations and equipment access | F12 sections, F18 envelopes, F14 discipline views. | Registered coordinates, participants and finding basis; candidate bounds overlap is distinct from exact intersection. |
| Asset handover and maintenance | F18 points of interest, F19 notes, F11 location aids. | Asset records and service history; load geometry only when useful. |
| Material carbon | F08 heat maps, F14 scenario comparison, F17 saved context. | Compatible factor units/lifecycle scope and explicit unresolved contributions. |
| Portfolio comparison | F26 linked results and drill-through, F17 chosen snapshots. | Comparable metrics and physical-building identities; source documents do not automatically equal buildings. |

Current BuildingModel work provides real-source architectural schedules and fixture-tested operational calculations. Its validation report identifies missing real-source mappings and supplemental input needs. The first product demos should reflect those limits rather than filling gaps with plausible-looking values.

## 7. Dependency sequence and incremental delivery

This is a product dependency sequence, not a final agent assignment or a promise that every feature in a row can be built concurrently. Shared contracts must be agreed before dependent writers start.

| Milestone | Deliverable | Capabilities and readiness condition |
|---|---|---|
| M0 — Contracts and baseline | A tiny scene, package skeleton, identity/coordinate definitions, disposal rules and a repeatable measurement harness. | F01 and F27 foundations. Record what can be reused and establish named reference devices. Probe Gratify touch/focus early. |
| M1 — Useful model viewer | Snowdon opens and can be navigated. All five formats have bounded loading support and fixtures. | F02/F03/F04 and F10 basic environment; F11 basic telemetry. Parsing and scene contracts are stable. |
| M2 — Composable review | Selection, data colors, ghosting, linked table, default Gratify shell and touch navigation. | F05–F09, F26 first recipe. Core operations demonstrably work without UI. Start the React host here. |
| M3 — Spatial inspection | Sections, box clipping, layouts, two views and analytical points/paths/envelopes. | P0 stages of F12–F14 and F18. Picking, style and coordinate contracts cover these combinations. |
| M4 — Reproducible changes | Layered edits, one-object geometry replacement, scene/view saving, text markup, screenshots and thumbnails. | P0 stages of F15–F20. Define serializable contracts earlier; prove integrated restore now. |
| M5 — V1 integration gate | Simple animations, complete React app, real MCP demonstration, documentation and performance qualification. | P0 stages of F21/F23/F27 plus the existing milestones. Verify feature combinations and resource lifecycle. |
| M6 — Focused extensions | Advanced region slicing, room/minimap navigation, four views, richer edits, maps, enhanced lighting and voxels. | P1 increments selected in their dependency order, each with its own cost/benefit and regression evidence. |
| M7 — Specialist experiments | Progressive tracing, quantitative light adapters, stronger voxelization and other expensive analyses. | P2 work only after feasibility and capability boundaries are documented. |

### Critical ordering constraints

- **Identity precedes selection, persistence and comparison.** Render instance indices are an implementation detail, not a durable application key.
- **Coordinate meaning precedes maps, spatial findings and measurements.** Presentation offsets cannot silently become physical placement.
- **Style composition precedes feature combinations.** Selection, heat maps, ghosting, clipping and edit layers must agree on effective appearance.
- **Edit semantics precede geometry chains.** Replacement identity, transactions and undo must be settled before advanced mesh tools.
- **Serializable contracts precede saved scene UI.** Do not accumulate feature state as opaque renderer or widget objects and retrofit persistence afterward.
- **Overlay anchors precede persistent markup.** Camera movement, object transforms and source replacement must have defined effects on annotations.
- **Typed commands precede MCP transport.** Integration must reuse application commands rather than introduce a second behavior path.
- **A measured baseline precedes feature optimization.** Begin with the simplest correct picking, rendering and geometry operation; specialize when evidence supports it.

### V1 release boundary

The proposed V1 includes all P0 stages: BOS/GLB/GLTF/OBJ/STL loading; rendering and bulk updates; all basic camera modes; touch and themes; selection/heat maps/ghosting; basic environment and diagnostics; plane/box slicing; basic object arrangements; two views; basic edit layers and geometry replacement; saved scenes/views; analytical overlays and points of interest; text markup; images/thumbnails; basic animation examples; an initial BuildingModel recipe; actual MCP and React integrations; public documentation and verified performance profiles.

P1 and P2 features are not required to make a P0 module reusable. Their future requirements should influence small shared contracts where necessary, without introducing speculative systems into the first implementation.

## 8. Performance and responsiveness requirements

### Primary model and workload

The key real test file is:

`C:\Users\cdigg\Documents\BIM Open Schema\Snowdon Towers Sample Architectural.bos`

The file was confirmed present while preparing this brief, at **9,362,255 bytes**. File size is not a rendering workload measurement. At baseline time, record its hash, source/object/instance counts, triangle count and resource footprint. Keep the source file unchanged; do not assume it is licensed for inclusion in a public demo distribution.

Snowdon is the primary integration case. It is supplemented by tiny deterministic fixtures, format-specific fixtures and a declared stress scene when Snowdon does not naturally contain 10,000 independently addressable render instances or the desired triangle workload. Synthetic replication must be labeled and preserve realistic material/instance diversity.

### Targets and proposed measurement gates

The user's two explicit goals are approximately **30 FPS for most operations** and **under one second to update 10,000 objects in a scene of up to 10 million triangles**. The detailed gates below operationalize those goals and must be confirmed against named baseline hardware. They are proposed targets, not measurements or existing guarantees.

| Area | Target and measurement |
|---|---|
| Interactive navigation | Aim for at least 30 FPS in the declared standard profile; report median and 95th-percentile frame time, with 33.3 ms as the target frame budget. Define the camera path and feature combination. |
| Bulk appearance/visibility/transform update | Target 95th-percentile completion below 1,000 ms for 10,000 objects in the declared ≤10-million-triangle scene, from command submission to the frame showing the complete result. Measure each operation separately. |
| Bulk representation replacement | Use the same target for switching to ready/shared representations such as boxes. Report generation, decoding and upload separately when new heavy meshes must be created. Do not imply arbitrary remeshing completes within one second. |
| Input response | Proposed target: visible acknowledgement within 100 ms at the 95th percentile. Long work exposes progress/cancel without monopolizing the UI thread. Record long tasks and missed input. |
| Initial load | Measure file/resource access, decoding, normalization, upload, first useful frame and fully ready state separately. Establish a baseline before setting an absolute loading budget; first useful geometry should not wait for unrelated properties. |
| Feature regressions | Compare identical scene/camera/device/profile with a feature disabled and enabled. A proposed review trigger is more than 10% deterioration in frame time, load time or memory; investigate repeatability and explain justified costs. It is not a universal pass/fail threshold for every effect. |
| Memory and lifecycle | Record CPU memory where measurable and estimated/observable GPU allocations. Repeated load/unload, view resize and disposal must not show unbounded resource growth. Declare limits for generated geometry, voxels and caches. |
| Multiple views | Record one-, two- and four-view profiles separately. Measure shared-resource benefits and total workload; avoid promising identical frame rates as viewport count increases. |
| Mobile | Name devices, browser versions, viewport/device-pixel ratio and quality preset. Aim for 30 FPS within the declared supported mobile profile; identify model/effect limits explicitly. |
| Expensive effects | Shadows, ambient occlusion, maps and tracing have individual profiles. Progressive path tracing is measured by time, memory and convergence, not the interactive raster FPS gate. |

Record browser, OS, CPU, GPU, RAM, viewport, device-pixel ratio, build version, settings, warm-up, sample count and cache/network conditions. Run enough repeated observations to calculate the reported percentile honestly. Distinguish CPU submission time from GPU execution and end-to-end display latency. GPU timers may be unavailable or invalid; report that state without substituting a misleading number.

Benchmark pure operations separately from rendering and UI. Test useful combinations as well: selection plus heat map plus clipping, two-view comparison, active markup, touch with a sidebar and React table updates. The HUD itself must not materially distort measurements; support measurements with it disabled.

Features should be inexpensive when disabled. Render on demand while idle, schedule only active animations, avoid per-frame scans of all metadata and prefer bulk notifications over one event per object. Implement the straightforward version first, then use these measurements to justify acceleration, workers, caching or changed-range uploads.

## 9. Demonstrations and developer adoption

### Standalone feature demonstrations

Every feature and substantial advanced stage has a small runnable demo with:

- A clear question or operation, such as “change the appearance of this object set.”
- Only the relevant capabilities enabled and visible public-API source code.
- A deterministic small fixture and an optional real-model path when applicable.
- Reset behavior, known limitations and a documented verification command.
- A performance comparison when the feature can affect model-scale responsiveness.

A gallery can host multiple standalone demo routes. “Standalone” means the feature can be understood and exercised independently; it does not require duplicating infrastructure or installing a separate application for each example.

### Default Gratify demonstration

Provide a polished model-review shell with camera controls, theme/text-size choices, selection, properties, legend, visibility controls, slicing, saved views, markup and performance diagnostics. Most demos should use Gratify. The shell demonstrates composition rather than defining a second API.

### Non-trivial React application

Provide a BuildingModel review application with a sortable/filterable or virtualized room/door table, object details, a visualization pane, configurable color rules, saved views and a comparison mode. The React application owns its application state and layout. It consumes public toolkit operations and subscriptions; it must not copy viewer internals.

Demonstrate bidirectional selection, bulk styling, opening/replacing a model, resizing a sidebar, changing routes or mounting/unmounting the viewer, and switching between one and two views. Include React-only controls for a useful subset to prove Gratify is optional. Optional Gratify overlays may coexist without competing for input ownership.

Verify that camera movement does not force a React render per object or per frame, table updates do not reconstruct the scene, and repeated mounting does not leak contexts/listeners. Compare the same scene and feature subset with the plain host baseline. A canvas embedded in an otherwise empty React page does not satisfy this requirement.

### MCP demonstration

Publish reproducible setup instructions for a supported MCP client and the host bridge. Show the bounded door-review sequence in F23, actual commands/results and visual effects. Include meaningful failure behavior for an unloaded model or unknown view ID. Keep credentials and arbitrary network access outside the browser visualization core.

### Documentation deliverables

Provide generated API reference for each feature; a quick start; typed data/coordinate conventions; lifecycle and cancellation guidance; composition examples; a format support table; performance recipes; demo source links; and an extension guide. Explain which functions are pure and which allocate resources. Use the same names and examples across reference docs, demos and tests.

## 10. Architecture and multi-agent planning handoff

Implementation uses the **Parallel Wave** skill with **Platonic Coder**, informed by the **platonic-ts** guidelines. Adopt data-first contracts, strict typing, named exports, small modules, inward-pointing dependencies, explicit expected failures and fast focused gates. Keep rendering and I/O mutation in controlled boundaries. The architect should adapt these principles to graphics workloads rather than mechanically import unrelated repository conventions or require immutable copies of GPU-sized buffers.

### Decisions the architect must make before feature dispatch

1. Select and document reusable parts of the existing Ara viewer, the modular `viewer/` workspace and visualization node code. Inspect licenses and preserve notices for reused code.
2. Choose internal module boundaries and public exports for `@bim-open-toolkit/visualization`. Decide renderer dependency and version ownership; avoid accidental duplicate rendering libraries.
3. Specify object/model/representation identity, coordinate frames and the normalized scene/resource contract.
4. Define command/event semantics, cancellation, subscriptions and lifecycle ownership.
5. Define composition order for base state, edit layers, workflow appearance, view filters and transient interaction styling. Selection must not silently resurrect a deleted or explicitly hidden object.
6. Establish saved-state schema/versioning and resource resolution without embedding runtime objects or credentials.
7. Define Gratify submodule/release consumption, generic upstream improvements and toolkit-specific adapter ownership.
8. Set named hardware/browser profiles, initial performance baselines and a small shared fixture set.
9. Select bounded MCP transport/client and map integration approaches when those milestones become ready.

These decisions should yield concrete typed contracts and short decision records. They do not require a generalized plugin runtime, a new rendering engine or a complete engineering data model.

### Candidate independent tracks

| Track | Natural ownership | Start only when |
|---|---|---|
| Loading | Format adapters, resource resolution and format fixtures. | Identity/scene output contracts and diagnostic conventions are stable. |
| Rendering | Scene mirroring, materials, GPU resources and bulk updates. | Scene, edit application and resource ownership contracts are stable for the assigned stage. |
| Interaction | Camera controls, picking and input tools. | View/camera/hit contracts and input ownership are defined. |
| Data visualization | Sets, styles, legends, analytical primitives and pure operations. | Identity, field-value and appearance composition contracts are stable. |
| Persistence and edits | Edit composition, undo/replay and saved document serialization. | Base identity and operation semantics are agreed; geometry operations are bounded. |
| UI and host integrations | Gratify adapter, React demo and later MCP/map adapters. | Public commands/events for the relevant feature subset are available and verified. |

These are ownership families, not instructions to launch six agents at once. Schedule only genuinely independent ready tasks within available agent and machine capacity. Separate generic Gratify changes from toolkit adapter changes with an explicit dependency and integration owner.

### Required task packet

Each implementation task must identify feature ID/stage, user-visible outcome, typed contract revision, exact owned files/subtrees, read-only dependencies, generated outputs, shared resources, acceptance cases, focused check commands and performance impact. Include its standalone demo and documentation work in the same ownership plan.

The supervisor owns shared contracts, manifests, lockfiles, common fixtures, gallery registration and integration changes. Assign exclusive owners for ports, browser sessions and mutable test/build resources. Serialize staging/commit turns and record checkpoints. Contract changes pause affected writers and invalidate dependent checks. Integrate only after inputs are stable and the combined behavior has been verified.

### Feature completion criteria

An implemented feature is complete when:

- Its promised typed behavior works through the public API without mandatory UI.
- The smallest independent fixture verifies meaningful correctness cases.
- Its UI, where included, uses that API and has a standalone demonstration.
- Relevant feature combinations preserve identity, state and resource lifetime.
- Applicable browser/render checks pass; data-only tests are not presented as visual validation.
- Performance cost is measured against the relevant baseline, or explicitly marked inapplicable.
- Documentation and generated reference are current.
- Integrated checks run against stable inputs and the result is recorded separately from local feature checks.

The final implementation plan should include a contract dependency graph, milestone acceptance matrix, candidate track ownership, benchmark protocol and unresolved decisions. It should leave each increment runnable and useful, with advanced stages able to follow without rewriting the base feature.

## 11. Existing assets, gaps and reuse guidance

This section records the source context used to prepare the brief. It is a starting point for a fresh implementation audit, not certification of current behavior.

| Asset | Potential reuse | Boundary or gap |
|---|---|---|
| Ara 3D WebGL | BOS loading, camera controls, geometry batching, examples and rendering investigations. | Some example interaction/style changes rebuild geometry. The experimental WebGPU path does not set this product's platform requirement. |
| BIM Open Toolkit `viewer/` | Existing separation of core, loaders and controls; instanced updates, basic picking and sectioning. | Audit code and integration behavior. Some README statements lag implemented alpha and scene-access APIs. Do not assume a documented limitation still exists or a low-level primitive already meets the product contract. |
| `submodules/gratify` | Canvas UI primitives, state-driven UI, controls and theming. | Touch/accessibility maturity and performance need explicit validation. Upstream only generic improvements. |
| `BimOpenFlow.Nodes.Geometry` | Data-driven colors, isolation, opacity, layouts, boxes, voxels and camera tables. | Reuse concepts/adapters without forcing graph evaluation or a C# runtime into a browser consumer. |
| BuildingModel workflows | Typed facts, identity/evidence, schedules and operational result examples. | Supplemental inputs and some real-source mappings remain incomplete. Keep coverage visible. |
| Prepared BFAST data | Potential acceleration and selective data access. | BuildingModel's source cache and Ara's render model have different payloads. A shared container format does not establish interchange compatibility. |

### Reference material

- [Ara 3D WebGL source](C:/Users/cdigg/git/ara3d-webgl/src/index.ts) and [repository](https://github.com/ara3d/ara3d-webgl).
- [BIM Open Toolkit modular viewer](C:/Users/cdigg/git/bim-open-toolkit/viewer/README.md).
- [Gratify submodule README](C:/Users/cdigg/git/bim-open-toolkit/submodules/gratify/README.md) and [submodule declaration](C:/Users/cdigg/git/bim-open-toolkit/.gitmodules).
- [BuildingModel design-proving workflows](C:/Users/cdigg/git/bim-open-toolkit/src/Ara3D.BimOpenSchema.BuildingModel/DESIGN-PROVING-WORKFLOWS.md).
- [BuildingModel workflow implementation](C:/Users/cdigg/git/bim-open-toolkit/src/Ara3D.BimOpenSchema.BuildingModel.Workflows/README.md) and [validation findings](C:/Users/cdigg/git/bim-open-toolkit/tools/building-model-workflows/VALIDATION.md).
- [Existing visualization nodes](C:/Users/cdigg/git/bim-open-toolkit/src/BimOpenFlow.Nodes.Geometry/README.md).
- [Platonic TypeScript principles](C:/Users/cdigg/git/platonic-ts/README.md) and [style guide](C:/Users/cdigg/git/platonic-ts/docs/style-guide.md).
- [Parallel Wave skill](C:/Users/cdigg/.codex/skills/parallel-wave/SKILL.md) and [Platonic Coder skill](C:/Users/cdigg/.codex/skills/platonic-coder/SKILL.md).

Local links identify the reviewed checkout locations. An architect preparing repository documentation should replace them with appropriate repository-relative or pinned source links. No performance benchmark, rendering test or new implementation was performed as part of writing this product brief.
