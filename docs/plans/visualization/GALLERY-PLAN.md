# V2 gallery and demo plan

Date: 2026-09-08. Status: planned, tracks not launched. Part of [V2-PLAN.md](V2-PLAN.md); it replaces that plan's Track D (port the 23 alpha demos) and regroups the wave 2 feature tracks and wave 3 workflow-demo tracks around a new gallery. Rolling status goes to [V2-STATUS.md](V2-STATUS.md). Requirements stay in [PRODUCT-BRIEF.md](PRODUCT-BRIEF.md) (F09 shell, F27 demos, section 6 workflows, section 9 demonstrations).

User basis (2026-09-08): plan a brand-new set of demos and a new gallery from scratch; useful and interesting; leverage Gratify for in-canvas widgets or a sidebar property inspector; a brand-new look and feel, the current gallery stays and is not deleted; move quickly and do not let gates slow the work; improve code that is touched so it is more future-proof.

## 1. What exists to build on

Surveyed 2026-09-08 (two read-only agents; paths are exact).

| Piece | State | What the gallery uses |
|---|---|---|
| `model` | M1 plus M1.1, M1.2; `Session`, `Feature`, `Command`, `StateSlice`, `SceneDocument`, `ChangeEvent`, style rules, sets, facts, `Table` | Every contract below is expressed with these types |
| `synthetic` | twelve fixtures in `src/fixtures.ts`, all under 500 ms, deliberate gaps and conflicts | Every demo's default data; `summaryOf(name)` feeds the fixture picker |
| `formats` | `loadModel` for BFAST, BOS, glTF, OBJ, STL; Snowdon BFAST in 353 to 455 ms | The load-a-file demo and the Snowdon path |
| `render` | `SceneBinding` onto viewer-core, bulk column updates, picking, clipping, representations, overlays with click actions, environment, capture, timing | Everything visual |
| `interact` | camera math, three modes, `attachNavigation` DOM adapter with a `FrameScheduler` | Navigation in every demo |
| `workflows` | all ten adapters, each `run*(input): Result<WorkflowResult>` with rules, sets, overlays and views; `test/expected/*.md` explain each case | The ten workflow demos; the expected-result prose is demo copy |
| `testing` | headless scene, `runInBrowser` (playwright-core, Edge or Chrome channel, software WebGL flags), `dataUrlPage`, benchmark protocol, fake clock; not yet re-exported from `src/index.ts` (Track T request) | Browser smoke and captured images per demo |
| `demos` | fixture server on port 5175 only; `src/index.ts` is empty; the E2E slice fence is reserved but has no files | The gallery grows here |
| `viewer`, `features`, `ui-gratify`, `ui-react`, `mcp` | empty skeletons | `viewer`, `features` and `ui-gratify` are built in this wave |
| Gratify 0.2.0 | submodule `submodules/gratify` at `f8764ca`, built `dist`, linked as `file:` | See section 2 |

What Gratify is: a Canvas2D model-view-update framework. One immutable document, typed intents, a pure `update`, a pure `view` returning an element tree, channels for animation, ten theme tokens with cross-fading `setTheme`. Built-in parts are `Stack`, `Row`, `Free`, `Layers`, `Flow` and `Label` only. The example widgets (button, toggle, slider, segmented, card, labelled row, number scrub, colour wheel, split pane, dropdown, adornments) are in `examples/` and not published. There is no text input except a DOM island pinned over the canvas, no scrolling part, no clip primitive on the painter, no tree or table. `mount()` does not detach its listeners on `stop()` (alpha finding), and its runtime captures every pointer on its canvas, so a full-viewport HUD canvas would swallow orbit and zoom. The alpha's `viewer/packages/visualization/src/gratify.ts` avoids both problems by driving a headless `Runtime` with its own `CanvasPainter`, listeners and disposal on a canvas sized to the panel.

## 2. Decisions

1. **Gratify draws every widget the demos add; the gallery chrome is DOM.** In-canvas widgets are Gratify panels, each on its own transparent canvas sized to its content and positioned by the host (corner, edge, or a world point projected each frame). The sidebar property inspector is one Gratify runtime on the sidebar canvas. The DOM shell owns what a canvas cannot do well: page navigation, fixture picker, theme and text size, source and verification links, and a visually hidden mirror of every canvas control for keyboards and screen readers, generated once from Gratify's `SemanticsNode` tree rather than hand-written per demo as the alpha did.
2. **Pattern for hosting a Gratify runtime:** the alpha's headless-runtime-plus-owned-listeners pattern, re-implemented in `ui-gratify` with idempotent disposal. No upstream Gratify change is required for this wave. Upstream requests (public hit test on the runtime, listener teardown in `stop()`, the extensionless `dist/core` import) are recorded as findings for a later submodule bump, not blockers.
3. **Inspector scrolling by virtualization, not clipping.** Rows have fixed height; `view(doc)` emits only the rows in the visible range, and the header is painted last with an opaque fill. This needs no clip primitive and scales to Snowdon's property counts. Editing a value uses a DOM island input. If the inspector part is not usable after Track UG's second chunk, the fallback is a DOM inspector with the same `PropertySheet` contract; the decision is recorded in UG's checkpoint.
4. **Composition comes from the `viewer` package, not from the demos.** Track V delivers `createViewer` now (pulled forward from wave 2) so no demo hand-wires render, interact and formats. Until V's first chunk lands, GAL and the demo tracks build against the contract in section 4 with a fake session.
5. **Feature modules are owned by the demo track that demonstrates them.** A feature and its demo have one owner (brief section 10, task packet). Cross-track feature use is through the package import once the owning chunk is committed; each brief lists what it waits on.
6. **Look and feel is new and deliberately the inverse of the alpha.** Light chrome, dark viewport (the alpha is dark chrome, light viewport); serif display type and a real type scale (the alpha is Inter with uppercase eyebrows); one warm accent (the alpha is mint); readable multi-file CSS with custom properties (the alpha is one minified line); horizontal and in-canvas control surfaces (the alpha is a 300 px rail of left-aligned buttons). Details in section 3. The alpha gallery on port 5173 is untouched.
7. **Analytical colours are never theme tokens.** Coverage states, change types, timeline states and the workflow heat maps use fixed palettes from `workflows` and `features`; switching theme or text size changes chrome only (F09 acceptance).
8. **Gates are fast.** Per chunk: `tsc --noEmit -p packages/<name>/tsconfig.json` and `npm test -w @bim-open-toolkit/<name>`. Lint and the type-aware set only at integration by the supervisor. No performance assertions in this wave; timings are measured and reported, never gated. Browser smoke is one software-WebGL run per demo that captures the demo's thumbnail; it runs when the demo is implemented, not on every chunk.
9. **Demos are honest.** No demo fabricates BIM meaning; gaps, conflicts and unverified connections are shown as such. A demo states whether it is synthetic, source-backed or mixed. Snowdon is an opt-in path through the fixture server where a projection exists (door schedule), never required.

## 3. Look and feel

Theme tokens live in one CSS file and one Gratify `extendTheme` call so both surfaces read the same values.

| Token | Light (default) | Dark |
|---|---|---|
| paper (page) | `#f4f1ea` | `#141519` |
| panel | `#fbfaf7` | `#1c1e24` |
| ink (text) | `#17181c` | `#ebe8e0` |
| ink muted | `#6b6a66` | `#9a978f` |
| rule (borders) | `#d9d4c8` | `#2c2f37` |
| accent | `#d1461f` vermilion | `#e8623a` |
| link and selection | `#1f5bd1` cobalt | `#6b93ff` |
| viewport clear | `#1b1d22` | `#0e0f12` |

Type: headings `"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif`; body `system-ui, "Segoe UI", sans-serif` at 15 px; values `ui-monospace, "Cascadia Mono", Consolas, monospace`. Scale 13, 15, 18, 24, 34 px. No uppercase eyebrows, no letter-spacing effects, no external fonts (no network in the browser gate). Big-text mode multiplies the root size by 1.25 and the Gratify size token by the same factor; controls reflow, nothing is hidden.

Gallery index: a 220 px chapter rail on the left (Inspect, Cut and arrange, Workflows, Scale and proof); the main area lists demos two per row, each with its captured thumbnail, the question it answers, its fixture, and labels for the features and brief IDs it exercises (F27 "feature/dependency labels").

Demo page: the viewport fills the page; the inspector is docked right at 360 px and collapses with the `i` key; Gratify panels sit at the viewport's top-left (tools) and bottom edge (legend, timeline, scenario switcher); a one-line status strip under the inspector; a 48 px top bar with breadcrumb, fixture picker, theme, text size, source link and the verification command. Under 750 px the inspector becomes a bottom sheet.

Motion: Gratify channels animate hover, press and value changes; camera flights use `interact`'s interruptible animation; reduced-motion preference disables both.

## 4. Contracts, revision G1

The supervisor lands these as code before writers start (section 6, chunk 0). Types are sketches; the code is the contract.

### 4.1 Demo registration (`demos/src/gallery/contracts.ts`, owned by GAL after chunk 0)

```ts
type DemoChapter = 'inspect' | 'cut-and-arrange' | 'workflows' | 'scale-and-proof';
type DataBasis = 'synthetic' | 'source-backed' | 'mixed';
type DemoFixture = { readonly id: string; readonly title: string; readonly basis: DataBasis;
  readonly load: (viewer: Viewer) => Promise<Result<ModelRef>> };
type Demo = {
  readonly id: string; readonly chapter: DemoChapter; readonly title: string;
  readonly question: string;                       // one sentence, shown on the card
  readonly features: readonly AnyFeature[];        // installed by createViewer for this demo
  readonly briefIds: readonly string[];            // F-IDs and section 6 rows
  readonly fixtures: readonly DemoFixture[];       // first is the default
  readonly panels: readonly HudPanel<unknown, unknown>[];
  readonly inspector?: (session: Session) => PropertySheet;   // pure; re-run on changed slices
  readonly start: (viewer: Viewer) => Promise<Disposable>;    // dispatches the opening commands
  readonly ready: (session: Session) => boolean;   // browser smoke waits for this
  readonly source: string; readonly verify: string;            // repo path and command
};
```

Demos register by exporting `demo` from `demos/src/demos/<id>/index.ts`; the gallery discovers them with `import.meta.glob`, so adding a demo touches no central file.

### 4.2 Gratify layer (`ui-gratify/src/contracts.ts`, owned by UG after chunk 0)

```ts
type HudPlace =
  | { readonly kind: 'corner'; readonly corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }
  | { readonly kind: 'edge'; readonly edge: 'bottom' | 'top' }
  | { readonly kind: 'world'; readonly point: (session: Session) => Vec3 | undefined };
type HudPanel<D, I> = {
  readonly id: string; readonly place: HudPlace;
  readonly spec: AppSpec<D, I>;                                 // gratify init, update, view
  readonly sync?: (session: Session, doc: D) => D;              // state to doc after a change event
  readonly onCommit?: (doc: D, previous: D, session: Session) => void;   // doc to commands
};
type ValueState = 'known' | 'missing' | 'conflicting';
type PropertyValue = { readonly kind: 'text' | 'number' | 'flag' | 'reference';
  readonly text: string; readonly unit?: string; readonly state: ValueState;
  readonly missingReason?: string; readonly evidence?: readonly string[] };
type PropertyRow = { readonly key: string; readonly label: string; readonly value: PropertyValue;
  readonly action?: OverlayAction;                              // click runs a command (render's shape)
  readonly edit?: { readonly command: string; readonly inputKey: string } };
type PropertyGroup = { readonly id: string; readonly title: string; readonly rows: readonly PropertyRow[] };
type SheetTable = { readonly id: string; readonly title: string; readonly table: Table;
  readonly rowAction?: (row: number) => OverlayAction };
type PropertySheet = { readonly title: string; readonly subtitle?: string;
  readonly groups: readonly PropertyGroup[]; readonly tables?: readonly SheetTable[] };
type Hosted = Disposable & { readonly canvas: HTMLCanvasElement; readonly semantics: () => SemanticsNode };
hostPanel(container: HTMLElement, panel: HudPanel<D, I>, session: Session): Hosted
hostInspector(container: HTMLElement, sheet: () => PropertySheet, session: Session): Hosted
applyGalleryTheme(name: 'light' | 'dark', textScale: number): void
```

UG also exports the widget kit the panels are built from: `Button`, `Toggle`, `Segmented`, `Slider`, `NumberScrub`, `Card`, `Labeled`, `Legend`, `Sparkline`, `Timeline`, `Chip`, `Tag` (a world-anchored label with a leader line) and `List` (virtualized rows). These are new parts written in `ui-gratify`, informed by the Gratify examples, not copied from them.

### 4.3 Viewer composition (`viewer/src/contracts.ts`, owned by V after chunk 0)

```ts
type ViewerOptions = { readonly canvas: HTMLCanvasElement; readonly features: readonly AnyFeature[];
  readonly document?: SceneDocument; readonly frames?: FrameScheduler; readonly views?: 1 | 2 | 4 };
type ModelSource = { readonly kind: 'geometry'; readonly id: string; readonly geometry: Geometry; readonly keys: ObjectKeys }
  | { readonly kind: 'url'; readonly url: string } | { readonly kind: 'file'; readonly file: Blob; readonly name: string };
type Viewer = Session & Disposable & {
  readonly openModel: (source: ModelSource) => Promise<Result<ModelRef>>;
  readonly binding: SceneBinding; readonly navigation: NavController;
  readonly document: () => SceneDocument; readonly restore: (document: SceneDocument) => Result<void>;
  readonly capture: (options?: CaptureOptions) => Promise<Result<Uint8Array>>;
  readonly project: (point: Vec3, view?: number) => Vec2 | undefined;   // world to canvas pixels
};
createViewer(options: ViewerOptions): Result<Viewer>
```

Built-in slices in V: `models`, `views` (one `ViewState` per view, linked flag), and the command bus. Commands: `viewer/open`, `viewer/fit`, `viewer/fly-to`, `viewer/set-projection`, `viewer/link-views`, `viewer/save`, `viewer/restore`, `viewer/capture`. Every other capability is a feature from `features`. A `fakeSession(features)` test helper lives in `viewer/src/testing.ts` so GAL and the demo tracks test commands without a canvas.

## 5. The demos

Twenty-one demos in four chapters. "Widget" is the Gratify in-canvas panel; "Inspector" is what the sidebar shows. Fixture is the default; every demo also accepts any fixture that has the columns it needs.

| # | Id | Chapter | Question it answers | Fixture | Widget | Inspector | Features (owner) | Brief |
|---|---|---|---|---|---|---|---|---|
| 1 | `point-and-read` | Inspect | What is this object and what do we actually know about it? | building | hover tag with leader line; click pins it | category, name, storey, every fact with its coverage state and evidence | selection (D1) | F06, F07 |
| 2 | `colour-by` | Inspect | Which column explains the building? | building | legend with counts, colour ramp for numbers | column picker, missing and conflicting counts | appearance (D1) | F08 |
| 3 | `ghost-and-isolate` | Inspect | Show me only these, keep the rest for context | building | set chips: isolate, ghost, hide, x-ray | the set stack with member counts | sets (D1) | F07, F08 |
| 4 | `storey-navigator` | Inspect | Take me to level 2 | building | vertical storey strip | storey summary: rooms, doors, areas known versus missing | sets, selection (D1) | F11 |
| 5 | `section-studio` | Cut and arrange | What is behind this wall? | building | plane and box handles drawn in-canvas, drag to cut | numeric offsets, flip, reset | clipping (D2) | F12 |
| 6 | `explode-and-grid` | Cut and arrange | Pull it apart so I can see every part | building | explode slider, storey spacing | layout kind and parameters | layouts (D2) | F13 |
| 7 | `environment` | Cut and arrange | Make it readable: light, ground, grid | building | preset row | light rig values, background | environment (D2) | F10 |
| 8 | `saved-views` | Cut and arrange | Come back to exactly this later | building | thumbnail strip of saved views | the scene document as a tree, one node per slice | storage (D2), every installed slice | F17 |
| 9 | `capture` | Cut and arrange | Give me a picture for the report | building | capture button with size choice, HUD shown or hidden | last capture's size and time | capture (D2) | F20 |
| 10 | `load-a-file` | Scale and proof | Open my own model | fixture server BFAST or a picked file | progress ring, cancel | format, diagnostics, object and instance counts, load time | none; `formats` (D2) | F02 |
| 11 | `ten-thousand` | Scale and proof | Does it keep up when everything changes at once? | stress | frame-time sparkline, recolour and move buttons | timing percentiles, rows changed, publish cost | hud (D2) | F03, section 8 |
| 12 | `door-schedule` | Workflows | Which doors have no fire rating, and where are they? | building; Snowdon opt-in | exception count badge; click to fly | door table with coverage, exceptions first | overlays (D3), appearance (D1) | section 6 row 1, F26 |
| 13 | `revision-comparison` | Workflows | What changed between the two issues? | revisions | change legend, view link toggle | correspondence list; disputed matches marked unresolved | comparison (D3), appearance (D1) | row 2, F14 |
| 14 | `takeoff` | Workflows | How much roof and finish, and which numbers can we trust? | quantities | support-state legend | subtotals with withheld ones shown as withheld | appearance (D1), overlays (D3) | row 3, F18 |
| 15 | `pricing-alternatives` | Workflows | What does each scenario cost, and what is unpriced? | costs | scenario segmented switch | totals per scenario, unpriced scopes listed | appearance (D1) | row 4 |
| 16 | `delivery-timeline` | Workflows | Where were we on the fifth of March? | schedule on building | date scrubber timeline with delivered, accepted, installed | event list for the selected object | timeline (D3), overlays (D3) | row 5, F21 |
| 17 | `valve-isolation` | Workflows | Close this valve; what stops flowing? | services | arrows along the trace; unverified links dashed | affected set, unverified connections | overlays (D3), sets (D1) | row 6 |
| 18 | `access-coordination` | Workflows | Does this equipment have room to be serviced? | clearances | envelope boxes, candidate overlaps highlighted; section through the chosen penetration | findings with their basis: candidate overlap versus exact | overlays (D3), clipping (D2) | row 7 |
| 19 | `asset-handover` | Workflows | What is the service history of this pump, and can I leave a note? | assets | points of interest; note editor (island input) | asset record, maintenance events, notes | annotations (D4), overlays (D3) | row 8, F19 |
| 20 | `material-carbon` | Workflows | Where is the carbon, and which contributions are unresolved? | carbon | scenario compare, heat-map legend | contributions with unit or scope mismatches flagged | appearance (D1), comparison (D3) | row 9 |
| 21 | `portfolio` | Workflows | Which building in the estate is the outlier, and can I drill in? | city | building cards in-canvas at each anchor | metrics table; a document naming a building nobody holds stays visible | overlays (D3) | row 10, F26 |

The MCP door-review demo (workflow 11) stays with Track C and is not in this plan.

Each demo directory holds `index.ts` (the `Demo`), `panels.ts`, `inspector.ts`, `README.md` (question, basis, limitations, reset behaviour, verification command) and `demo.test.ts` (commands through the fake session; inspector sheet from a known state). The browser smoke for a demo captures `demos/thumbnails/<id>.png` at 480 by 300 and is committed with the demo.

## 6. Tracks and fences

Wave name `gallery`. Seven tracks; all Opus leads; Sonnet sub-agents inside a lead's fence for mechanical work (thumbnails, README tables, widget variants). Every brief carries the parallel-wave and platonic-coder skill paths, this plan, revision G1, and the fast-gate rule. Paths not listed stay supervisor-owned as in `.claude/wave.json` (manifests, lockfile, tsconfigs, `features/src/index.ts`, `testing/src/index.ts`, plan documents).

| Track | Fence | Delivers | Ready when |
|---|---|---|---|
| **V** viewer | `viewer/packages/viewer/**` including `src/index.ts` | `createViewer` per 4.3, command bus, feature host, slices, multi-view, `fakeSession`, disposal; render binding via `SceneBinding`, navigation via `attachNavigation`, loading via `loadModel` | chunk 0 |
| **UG** gratify layer | `viewer/packages/ui-gratify/**` including `src/index.ts` | 4.2: `hostPanel`, `hostInspector`, the widget kit, theme bridge, semantics mirror; tests through the headless runtime | chunk 0 |
| **GAL** gallery host | `viewer/packages/demos/src/gallery/**`, `demos/src/demos/_shared/**`, `demos/src/index.ts`, `demos/gallery.html`, `demos/vite.gallery.config.mjs`, `demos/thumbnails/README.md`, `demos/test/gallery/**`, `demos/docs/gallery.md`, `demos/docs/CHECKPOINT-GAL.md` | shell, index, routes, fixture picker, theme and text size, DOM mirror wiring, `gallery`, `gallery:check` and `gallery:smoke` scripts (scripts themselves are a supervisor edit to `viewer/package.json`), the smoke runner that captures thumbnails | chunk 0 |
| **D1** inspect | `features/src/{selection,appearance,sets}*`, `features/test/{selection,appearance,sets}*`, `demos/src/demos/{point-and-read,colour-by,ghost-and-isolate,storey-navigator}/**`, `demos/thumbnails/{those ids}.png`, `demos/docs/CHECKPOINT-D1.md` | features selection, appearance with legend, sets; demos 1 to 4 | chunk 0; demos run in the browser once V and UG chunk 1 land |
| **D2** cut, arrange, scale | `features/src/{clipping,layouts,environment,storage,capture,hud}*`, matching tests, `demos/src/demos/{section-studio,explode-and-grid,environment,saved-views,capture,load-a-file,ten-thousand}/**`, thumbnails, `CHECKPOINT-D2.md` | those six features; demos 5 to 11 | chunk 0; same browser condition |
| **D3** workflows A | `features/src/{overlays,comparison,timeline,workflow-result}*`, tests, `demos/src/demos/{door-schedule,revision-comparison,takeoff,pricing-alternatives,delivery-timeline}/**`, thumbnails, `CHECKPOINT-D3.md` | overlays feature with click actions, two linked views, timeline, and `applyWorkflowResult` (rules, sets, overlays, views from a `WorkflowResult`); demos 12 to 16 | chunk 0; door-schedule and takeoff colouring wait on D1's appearance chunk |
| **D4** workflows B | `features/src/annotations*`, tests, `demos/src/demos/{valve-isolation,access-coordination,asset-handover,material-carbon,portfolio}/**`, thumbnails, `CHECKPOINT-D4.md` | annotations with island text input; demos 17 to 21 | D1 appearance and sets, D3 overlays and `applyWorkflowResult` committed; starts last from the ready queue |

Chunk 0 (supervisor, one commit): the three contract files with their tests, `features/src/index.ts` exporting the planned modules as they land (a re-export per track, added by the supervisor when a track's first chunk commits), `testing/src/index.ts` re-exporting headless, browser, bench and fixtures (Track T's open request; T is another session's track, so this is done only if T's checkpoint still lists it), `gallery*` scripts in `viewer/package.json`, `demos/package.json` dependency on `gratify`, the wave entries in `.claude/wave.json`, and the status section in V2-STATUS.md.

Suggested first chunks, so the browser path exists early: V chunk 1 is `createViewer` with `openModel({kind:'geometry'})`, fit and one view; UG chunk 1 is `hostPanel` with `Button` and `Tag`; GAL chunk 1 is the shell with one placeholder demo that draws the synthetic building through V and pins a `Tag`; that placeholder is the E2E slice the review asked for, and D1 replaces it with `point-and-read`.

## 7. Gates, resources and rules

- Per chunk: `npx tsc --noEmit -p packages/<name>/tsconfig.json` and `npm test -w @bim-open-toolkit/<name>` from `viewer/`. Nothing else. Lint, the type-aware set and the combined `tools/platonic-check.mts` run once at integration by the supervisor.
- Browser: `npm run gallery:smoke -- --demo <id> --port <n>` starts a Vite dev server on the track's port, runs the demo in software WebGL through `testing`'s runner, waits for `ready`, captures the thumbnail and reports the renderer string. Ports: GAL 5176, D1 5181, D2 5182, D3 5183, D4 5184; fixture server 5175 shared and read-only, started by the supervisor; alpha 5173 and MCP 5174 untouched. One browser process per track.
- Zero escape hatches in V2 code. `document.getElementById(...) as HTMLCanvasElement` is not allowed; narrow with `instanceof HTMLCanvasElement` and return a `Result`.
- Improve what you touch (user instruction 2026-09-08): if a package you depend on needs a small addition to avoid a workaround, add it in your checkpoint's requests the same hour and use a local shim until it lands; do not build around it silently.
- Commit by pathspec only, message from a file, never amend, never push (supervisor pushes). On `index.lock`, retry.
- Checkpoints under 80 lines with the standard sections plus "Tooling".
- Alpha packages and `submodules/gratify` are read-only. Gratify improvements are written as findings with the exact function and reason.

## 8. Acceptance

The wave is done when:

1. `npm run gallery` serves the index on 5176 with all four chapters, and every demo in section 5 opens, draws its fixture, shows its widget and inspector, and resets.
2. Every demo has a committed thumbnail captured by the smoke run, a README, and a test through the fake session.
3. Theme and text-size changes never change an analytical colour (a test compares the legend palette before and after `applyGalleryTheme`).
4. Every canvas control is reachable through the DOM mirror by keyboard (one test walks the mirror of each demo).
5. `createViewer` restores a saved document with every installed slice (F17 round-trip test in V).
6. The ten workflow demos show at least one gap, conflict or unverified item each, taken from the fixture, and name the data basis.
7. Load, frame-time and bulk-update numbers from `ten-thousand` and `load-a-file` are reported in V2-STATUS.md with device and renderer, not asserted.
8. Combined gate green at integration against stable inputs; alpha suites unchanged.

## 9. Risks and fallbacks

| Risk | Signal | Fallback |
|---|---|---|
| Gratify inspector too costly (scroll, text, hit testing) | UG chunk 2 not verified within a day | DOM inspector behind the same `PropertySheet` contract; Gratify keeps the in-canvas panels |
| Seven tracks on one machine slow compiles | tsc over 60 s per track | Stagger D4 (already last); tracks run tests scoped to their package only |
| V's contract changes under the demo tracks | a demo cannot express an opening sequence with 4.3 | Contract change protocol: pause, revise G1 to G2, resume; V owns the change |
| Multi-view (comparison, carbon compare) needs viewer-core work | V finds the alpha core cannot host two views on one scene | Two `createViewer` instances sharing geometry, linked by a `viewer/link-views` command across sessions; recorded as a decision |
| Software WebGL cannot draw the stress fixture in time | smoke timeout at 30 s | `ten-thousand` smoke uses 2,000 instances; the full run is reported from a hardware run |
| Another session's tracks (T, M3, W, E2E) still writing | their files appear in `git status` | Never staged by this wave; E2E's fence is disjoint and its slice is superseded by GAL chunk 1 if it has not landed |

## 10. Improvements to make in passing

- `testing/src/index.ts`: export headless, browser, bench and fixtures (open request from T).
- `demos/package.json`: `serve:fixtures` points at an absolute path into the sibling `platonic-ts`; replace with a workspace `tsx` dev dependency or a compiled entry.
- `demos/src/server/main.ts`: default fixture directories are two absolute paths; read them from `V2_FIXTURES_DIRS` with a documented default relative to the repository.
- Gratify upstream (findings only): public `hitAt(x, y)` on `Runtime`; detach listeners and the resize observer in `stop()`; emit `dist/core/index.js` imports with extensions; publish the widget set.
- `model`: a bounds-valued `FactValue` (S2's request) would let `access-coordination` show envelopes from facts rather than columns.

## 11. Manifest additions

Added to `.claude/wave.json` at chunk 0 under the same schema.

```json
"V":   { "paths": ["viewer/packages/viewer/**"] },
"UG":  { "paths": ["viewer/packages/ui-gratify/**"] },
"GAL": { "paths": ["viewer/packages/demos/src/gallery/**", "viewer/packages/demos/src/demos/_shared/**",
                   "viewer/packages/demos/src/index.ts", "viewer/packages/demos/gallery.html",
                   "viewer/packages/demos/vite.gallery.config.mjs", "viewer/packages/demos/thumbnails/README.md",
                   "viewer/packages/demos/test/gallery/**", "viewer/packages/demos/docs/gallery.md",
                   "viewer/packages/demos/docs/CHECKPOINT-GAL.md"] },
"D1":  { "paths": ["viewer/packages/features/src/selection*", "viewer/packages/features/src/appearance*", "viewer/packages/features/src/sets*",
                   "viewer/packages/features/test/selection*", "viewer/packages/features/test/appearance*", "viewer/packages/features/test/sets*",
                   "viewer/packages/demos/src/demos/point-and-read/**", "viewer/packages/demos/src/demos/colour-by/**",
                   "viewer/packages/demos/src/demos/ghost-and-isolate/**", "viewer/packages/demos/src/demos/storey-navigator/**",
                   "viewer/packages/demos/thumbnails/point-and-read.png", "viewer/packages/demos/thumbnails/colour-by.png",
                   "viewer/packages/demos/thumbnails/ghost-and-isolate.png", "viewer/packages/demos/thumbnails/storey-navigator.png",
                   "viewer/packages/demos/docs/CHECKPOINT-D1.md"] },
"D2":  { "paths": ["viewer/packages/features/src/clipping*", "viewer/packages/features/src/layouts*", "viewer/packages/features/src/environment*",
                   "viewer/packages/features/src/storage*", "viewer/packages/features/src/capture*", "viewer/packages/features/src/hud*",
                   "viewer/packages/features/test/clipping*", "viewer/packages/features/test/layouts*", "viewer/packages/features/test/environment*",
                   "viewer/packages/features/test/storage*", "viewer/packages/features/test/capture*", "viewer/packages/features/test/hud*",
                   "viewer/packages/demos/src/demos/section-studio/**", "viewer/packages/demos/src/demos/explode-and-grid/**",
                   "viewer/packages/demos/src/demos/environment/**", "viewer/packages/demos/src/demos/saved-views/**",
                   "viewer/packages/demos/src/demos/capture/**", "viewer/packages/demos/src/demos/load-a-file/**",
                   "viewer/packages/demos/src/demos/ten-thousand/**",
                   "viewer/packages/demos/thumbnails/section-studio.png", "viewer/packages/demos/thumbnails/explode-and-grid.png",
                   "viewer/packages/demos/thumbnails/environment.png", "viewer/packages/demos/thumbnails/saved-views.png",
                   "viewer/packages/demos/thumbnails/capture.png", "viewer/packages/demos/thumbnails/load-a-file.png",
                   "viewer/packages/demos/thumbnails/ten-thousand.png", "viewer/packages/demos/docs/CHECKPOINT-D2.md"] },
"D3":  { "paths": ["viewer/packages/features/src/overlays*", "viewer/packages/features/src/comparison*", "viewer/packages/features/src/timeline*",
                   "viewer/packages/features/src/workflow-result*",
                   "viewer/packages/features/test/overlays*", "viewer/packages/features/test/comparison*", "viewer/packages/features/test/timeline*",
                   "viewer/packages/features/test/workflow-result*",
                   "viewer/packages/demos/src/demos/door-schedule/**", "viewer/packages/demos/src/demos/revision-comparison/**",
                   "viewer/packages/demos/src/demos/takeoff/**", "viewer/packages/demos/src/demos/pricing-alternatives/**",
                   "viewer/packages/demos/src/demos/delivery-timeline/**",
                   "viewer/packages/demos/thumbnails/door-schedule.png", "viewer/packages/demos/thumbnails/revision-comparison.png",
                   "viewer/packages/demos/thumbnails/takeoff.png", "viewer/packages/demos/thumbnails/pricing-alternatives.png",
                   "viewer/packages/demos/thumbnails/delivery-timeline.png", "viewer/packages/demos/docs/CHECKPOINT-D3.md"] },
"D4":  { "paths": ["viewer/packages/features/src/annotations*", "viewer/packages/features/test/annotations*",
                   "viewer/packages/demos/src/demos/valve-isolation/**", "viewer/packages/demos/src/demos/access-coordination/**",
                   "viewer/packages/demos/src/demos/asset-handover/**", "viewer/packages/demos/src/demos/material-carbon/**",
                   "viewer/packages/demos/src/demos/portfolio/**",
                   "viewer/packages/demos/thumbnails/valve-isolation.png", "viewer/packages/demos/thumbnails/access-coordination.png",
                   "viewer/packages/demos/thumbnails/asset-handover.png", "viewer/packages/demos/thumbnails/material-carbon.png",
                   "viewer/packages/demos/thumbnails/portfolio.png", "viewer/packages/demos/docs/CHECKPOINT-D4.md"] }
```

## Maintaining this plan

Dated decisions go to [README.md](README.md); status to [V2-STATUS.md](V2-STATUS.md). Run `node docs/plans/visualization/check-baselines.mjs` after edits.
