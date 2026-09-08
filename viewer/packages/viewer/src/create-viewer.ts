// The default composition, and the three lines it exists for.
//
//   const viewer = createViewer(canvas);
//   await viewer.open('/models/building.bfast');
//   viewer.run('view.fit', {});
//
// Everything the end-to-end slice had to write by hand is here: the renderer, the size and its
// observer, the frame loop, navigation, picking, the scene binding, the base appearances a model was
// loaded with, the environment, statistics, and disposal in the order that leaves nothing behind.
//
// This is not a place features go. It installs `defaultFeatures()` - which models are open, where
// each view looks, what colour everything is - and a host that wants more, or different, passes its
// own list. The only thing a feature gets here that a plain session does not is `viewerAccess`,
// which is how a command reaches the bound scene and the live views.

import {
  defaultAppearance,
  diagnostic,
  didChange,
  emptyBounds,
  failure,
  objectKey,
  resolveStyles,
  setOf,
  styleComposition,
  success,
  transformBounds,
  unionBounds,
  type AnyFeature,
  type Appearance,
  type Bounds,
  type CommandDescriptor,
  type Diagnostic,
  type Disposable,
  type Listener,
  type Matrix4,
  type ModelRef,
  type ObjectKey,
  type ObjectSet,
  type Result,
  type SceneDocument,
  type StyleRule,
  type ViewState,
} from '@bim-open-toolkit/model';
import {
  loadModel,
  type LoadOptions as FormatOptions,
  type LoadedModel,
  type ModelSource,
} from '@bim-open-toolkit/formats';
import { ViewerScene } from '@ara3d/viewer-core';
import {
  DurationLog,
  SceneBinding,
  captureImage,
  defaultEnvironment,
  geometryMeshAt,
  groupOf,
  hudData,
  noClipping,
  readGpuTimer,
  transformOfRow,
  type CaptureImage,
  type CaptureOptions,
  type ClipRegion,
  type EnvironmentSettings,
  type HudData,
  type ModelRaycastHit,
  type ObjectHit,
  type Ray,
  type SceneStatistics,
} from '@bim-open-toolkit/render';
import type { FrameScheduler, NavElement, NavMode } from '@bim-open-toolkit/interact';
import { viewerAccess, type SceneAccess, type ViewerAccess, type ViewsAccess } from './access.js';
import { blendableMaterial, webglRenderer } from './adapters/index.js';
import { appearanceSlice, defaultFeatures, modelsSlice, viewSlice } from './core-features.js';
import { loadScene, saveScene, type LoadOptions, type SceneLoad } from './document.js';
import { featureHost, type FeatureHost } from './features.js';
import { viewSet, type ViewSet } from './multi-view.js';
import type { ViewRenderer } from './renderer.js';
import { createSession, type ViewerSession } from './session.js';
import { createView, type View } from './view.js';

// Sixteen numbers as the model package's transform. `transformOfRow` hands back a plain array and
// `noUncheckedIndexedAccess` makes every element optional, so each one is defaulted.
const matrixFrom = (values: readonly number[]): Matrix4 => [
  values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 0,
  values[4] ?? 0, values[5] ?? 0, values[6] ?? 0, values[7] ?? 0,
  values[8] ?? 0, values[9] ?? 0, values[10] ?? 0, values[11] ?? 0,
  values[12] ?? 0, values[13] ?? 0, values[14] ?? 0, values[15] ?? 0,
];

// How far a pointer may travel between press and release and still count as a click, in pixels.
const defaultClickSlop = 4;

// How a viewer is made. A canvas on its own is the whole of the beginner path.
export type ViewerOptions = {
  readonly canvas?: HTMLCanvasElement | undefined;
  // The element navigation listens on. Defaults to the canvas.
  readonly element?: NavElement | undefined;
  // How a view's renderer is built. Defaults to viewer-core and three over the canvas.
  readonly renderer?: ((canvas: HTMLCanvasElement | undefined, id: string) => ViewRenderer) | undefined;
  // What to install. Defaults to `defaultFeatures()`; pass `[]` for a viewer with no commands.
  readonly features?: readonly AnyFeature[] | undefined;
  // The environment applied when a model opens. `null` leaves the renderer's own background alone.
  readonly environment?: EnvironmentSettings | null | undefined;
  readonly schedule?: FrameScheduler | undefined;
  readonly viewId?: string | undefined;
  readonly maxPixelRatio?: number | undefined;
  // Whether a click selects what is under it. On by default.
  readonly selectOnClick?: boolean | undefined;
  readonly clickSlop?: number | undefined;
  // Whether the camera frames the model when one opens. On by default.
  readonly fitOnOpen?: boolean | undefined;
};

// What `open` gives back besides the model itself.
export type OpenedModel = {
  readonly ref: ModelRef;
  readonly loaded: LoadedModel;
  readonly keys: readonly ObjectKey[];
};

// How an extra view is made.
export type AddViewOptions = {
  readonly id?: string | undefined;
  readonly element?: NavElement | undefined;
  readonly renderer?: ((canvas: HTMLCanvasElement | undefined, id: string) => ViewRenderer) | undefined;
  readonly view?: ViewState | undefined;
  readonly mode?: NavMode | undefined;
};

// The default composition.
export type Viewer = {
  readonly session: ViewerSession;
  readonly features: FeatureHost;
  readonly views: ViewSet;
  readonly binding: SceneBinding;

  // Loads a model from anywhere `@bim-open-toolkit/formats` reads, binds it and shows it.
  readonly open: (source: ModelSource, options?: FormatOptions) => Promise<Result<OpenedModel>>;
  // Binds a model already in memory, which is what a synthetic fixture needs.
  readonly show: (loaded: LoadedModel) => Result<OpenedModel>;
  readonly close: (modelId: string) => boolean;
  readonly models: () => readonly ModelRef[];

  // Runs a command by name. This is the only way state changes.
  readonly run: (name: string, input?: unknown) => Result<unknown>;
  readonly describe: () => readonly CommandDescriptor[];
  readonly subscribe: (listener: Listener) => Disposable;

  // Colour rules in one call: the same thing as running `appearance.rules`.
  readonly apply: (...rules: readonly StyleRule[]) => Result<unknown>;
  readonly select: (keys: readonly ObjectKey[]) => Result<unknown>;
  // What is under a point in normalized device coordinates of a view.
  readonly pick: (x: number, y: number, viewId?: string) => ObjectHit | undefined;

  readonly bounds: () => Bounds;
  readonly statistics: () => SceneStatistics;
  readonly hud: (viewId?: string) => HudData;
  readonly capture: (options?: CaptureOptions, viewId?: string) => Promise<Result<CaptureImage>>;

  readonly setEnvironment: (settings: EnvironmentSettings | null) => void;
  readonly setClipping: (region: ClipRegion) => void;

  readonly save: () => Result<SceneDocument>;
  readonly load: (document: SceneDocument, options?: LoadOptions) => Result<SceneLoad>;

  // A second canvas over the same session, with its own camera unless the views are linked.
  readonly addView: (canvas?: HTMLCanvasElement, options?: AddViewOptions) => Result<View>;

  // What could not be done and had nowhere else to be reported: a canvas with no WebGL, a feature
  // that would not install.
  readonly diagnostics: () => readonly Diagnostic[];
  readonly disposed: () => boolean;
  readonly dispose: () => void;
};

const isCanvas = (value: HTMLCanvasElement | ViewerOptions | undefined): value is HTMLCanvasElement =>
  typeof HTMLCanvasElement === 'function' && value instanceof HTMLCanvasElement;

const describeCause = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

// A viewer on a canvas, or on nothing at all.
//
// A canvas that cannot make a WebGL context does not throw: the viewer comes back with no view and
// says why in `diagnostics()`, so a page can show the reason instead of a blank rectangle. Every
// other part - the session, the commands, the document - works without a view.
export const createViewer = (input?: HTMLCanvasElement | ViewerOptions): Viewer => {
  const options: ViewerOptions = isCanvas(input) ? { canvas: input } : (input ?? {});
  const observed: Diagnostic[] = [];
  const views = viewSet();
  const held: Disposable[] = [];
  let closed = false;

  const made = createSession();
  if (!made.ok) throw new Error(made.diagnostics.map((one) => one.message).join('; '));
  const session = made.value;

  // The binding's scene is the viewer's own, not a view's: the groups it builds go into every
  // view's scene, so no view owns the model and disposing one leaves the others drawing.
  const hostScene = new ViewerScene();
  const binding = new SceneBinding(hostScene, () => {
    views.requestRender();
  });

  // What is open, in the order it was opened. Keys and base appearances are accumulated once,
  // because `resolveStyles` needs every key and repainting from the records is a per-model cost.
  const opened: { readonly ref: ModelRef; readonly keys: readonly ObjectKey[] }[] = [];
  const keys: ObjectKey[] = [];
  const base = new Map<ObjectKey, Appearance>();
  let environment: EnvironmentSettings | null = options.environment ?? defaultEnvironment;
  let section: ClipRegion = noClipping;

  const raycasts = new WeakMap<View, (ray: Ray) => readonly ModelRaycastHit[]>();

  const restyle = (): void => {
    if (opened.length === 0) return;
    const state = session.read(appearanceSlice);
    const composition = styleComposition(
      base,
      [],
      state.rules,
      setOf(state.selection),
      state.filter === null ? undefined : setOf(state.filter),
    );
    const resolved = resolveStyles(composition, keys);
    for (const model of binding.models) binding.applyStyles(model.modelId, resolved);
  };

  // The world bounds of a set of objects: every row of every key, its mesh box moved by its own
  // transform. Nothing else knows how to do this, because only the table maps a key to its rows.
  const boundsOfSet = (set: ObjectSet): Bounds => {
    let total = emptyBounds;
    for (const model of binding.models) {
      const table = model.table;
      for (const key of set) {
        const object = table.objectOfKey.get(key);
        if (object === undefined) continue;
        const start = table.objectStart[object] ?? 0;
        const end = table.objectStart[object + 1] ?? start;
        for (let at = start; at < end; at++) {
          const row = table.objectRows[at];
          if (row === undefined) continue;
          const mesh = table.meshOfGroup[groupOf(table, row)];
          const source = mesh === undefined ? undefined : geometryMeshAt(model.geometry, mesh);
          if (source === undefined) continue;
          total = unionBounds(total, transformBounds(matrixFrom(transformOfRow(table, row)), source.bounds));
        }
      }
    }
    return total;
  };

  const applyEnvironmentToViews = (): void => {
    const bounds = binding.bounds();
    for (const view of views.all()) view.setEnvironment(environment ?? undefined, bounds);
  };

  const scene: SceneAccess = {
    binding,
    keys: () => keys,
    base: () => base,
    bounds: () => binding.bounds(),
    boundsOf: boundsOfSet,
    restyle,
  };

  const viewsAccess: ViewsAccess = {
    ids: () => views.ids(),
    camera: (id) => views.get(id)?.camera(),
    setCamera: (id, view, flightMs) => {
      const found = views.get(id);
      if (found === undefined) return false;
      found.setCamera(view, flightMs);
      return true;
    },
    setMode: (mode) => {
      for (const view of views.all()) view.setMode(mode);
    },
    aspect: (id) => views.get(id)?.aspect() ?? 1,
    ray: (id, x, y) => views.get(id)?.ray(x, y),
    pick: (id, x, y) => {
      const view = views.get(id);
      if (view === undefined) return undefined;
      const ray = view.ray(x, y);
      if (ray === undefined) return undefined;
      // One raycaster per view, kept: building one per click allocates on every pointer up.
      const held = raycasts.get(view) ?? view.renderer.raycast(binding.groupIndex());
      raycasts.set(view, held);
      return binding.pick(ray, held);
    },
  };

  const access: ViewerAccess = { scene, views: viewsAccess };
  held.push(viewerAccess.provide(session, access));

  const host = featureHost(session);
  const installed = host.install(options.features ?? defaultFeatures());
  if (!installed.ok) observed.push(...installed.diagnostics);

  // The bridges: the renderer follows the slices, and never the other way round.
  held.push(
    session.subscribe((event) => {
      if (didChange(event, appearanceSlice.id)) restyle();
      if (!didChange(event, viewSlice.id)) return;
      const state = session.read(viewSlice);
      views.setLinked(state.linked);
      for (const view of views.all()) {
        if (view.mode() !== state.mode) view.setMode(state.mode);
        const saved = state.cameras[view.id];
        if (saved !== undefined && saved !== view.camera()) view.setCamera(saved);
      }
    }),
  );

  const makeRenderer = (
    canvas: HTMLCanvasElement | undefined,
    id: string,
    factory: ((canvas: HTMLCanvasElement | undefined, id: string) => ViewRenderer) | undefined,
  ): ViewRenderer | undefined => {
    try {
      if (factory !== undefined) return factory(canvas, id);
      if (canvas === undefined) {
        observed.push(
          diagnostic('viewer/no-renderer', `View ${id} has neither a canvas nor a renderer.`, ['canvas']),
        );
        return undefined;
      }
      return webglRenderer(canvas);
    } catch (cause) {
      observed.push(
        diagnostic('viewer/no-renderer', `View ${id} could not start: ${describeCause(cause)}`, ['canvas']),
      );
      return undefined;
    }
  };

  const attachSelection = (view: View, canvas: HTMLCanvasElement): Disposable => {
    const listeners = new AbortController();
    const slop = options.clickSlop ?? defaultClickSlop;
    let pressed: { readonly x: number; readonly y: number; readonly id: number } | undefined;
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        pressed =
          event.isPrimary && event.button === 0
            ? { x: event.clientX, y: event.clientY, id: event.pointerId }
            : undefined;
      },
      { signal: listeners.signal },
    );
    canvas.addEventListener(
      'pointerup',
      (event) => {
        const down = pressed;
        pressed = undefined;
        if (down === undefined || down.id !== event.pointerId) return;
        if (Math.hypot(down.x - event.clientX, down.y - event.clientY) > slop) return;
        const at = view.ndc(event.clientX, event.clientY);
        const hit = at === undefined ? undefined : viewsAccess.pick(view.id, at.x, at.y);
        session.dispatch('appearance.select', { keys: hit === undefined ? [] : [hit.key] });
      },
      { signal: listeners.signal },
    );
    return { dispose: () => listeners.abort() };
  };

  const addView = (canvas?: HTMLCanvasElement, viewOptions: AddViewOptions = {}): Result<View> => {
    if (closed) return failure([diagnostic('viewer/disposed', 'The viewer is disposed.', ['view'])]);
    const id = viewOptions.id ?? `view${String(views.ids().length)}`;
    const renderer = makeRenderer(canvas, id, viewOptions.renderer ?? options.renderer);
    if (renderer === undefined)
      return failure([diagnostic('viewer/no-renderer', `View ${id} could not start.`, ['canvas'])]);
    const element: NavElement | undefined = viewOptions.element ?? canvas;
    const view = createView({
      id,
      renderer,
      ...(canvas === undefined ? {} : { canvas }),
      ...(element === undefined ? {} : { element }),
      ...(viewOptions.view === undefined ? {} : { view: viewOptions.view }),
      ...(viewOptions.mode === undefined ? {} : { mode: viewOptions.mode }),
      ...(options.schedule === undefined ? {} : { schedule: options.schedule }),
      ...(options.maxPixelRatio === undefined ? {} : { maxPixelRatio: options.maxPixelRatio }),
      onCamera: (fromId, state) => views.follow(fromId, state),
    });
    const added = views.add(view);
    if (!added.ok) {
      view.dispose();
      return added;
    }
    for (const model of binding.models) view.addGroups(model.table.groups);
    view.setEnvironment(environment ?? undefined, binding.bounds());
    view.setClipping(section);
    if (options.selectOnClick !== false && canvas !== undefined) held.push(attachSelection(view, canvas));
    return added;
  };

  if (options.canvas !== undefined || options.renderer !== undefined) {
    const first = addView(options.canvas, {
      id: options.viewId ?? 'main',
      ...(options.element === undefined ? {} : { element: options.element }),
    });
    if (!first.ok) observed.push(...first.diagnostics);
  }

  const show = (loaded: LoadedModel): Result<OpenedModel> => {
    if (closed) return failure([diagnostic('viewer/disposed', 'The viewer is disposed.', ['model'])]);
    const ref = loaded.data.ref;
    const modelKeys = loaded.data.objects.map((record) => objectKey(record.ref));
    const bound = binding.addModel(ref.id, loaded.geometry, modelKeys, { material: blendableMaterial });
    if (!bound.ok) return failure(bound.diagnostics);

    for (let at = 0; at < loaded.data.objects.length; at++) {
      const record = loaded.data.objects[at];
      const key = modelKeys[at];
      if (record === undefined || key === undefined) continue;
      keys.push(key);
      base.set(key, record.appearance ?? defaultAppearance);
    }
    opened.push({ ref, keys: modelKeys });
    session.write(modelsSlice, { open: opened.map((one) => one.ref) });

    views.addGroups(bound.value.groups);
    applyEnvironmentToViews();
    for (const view of views.all()) view.setClipping(section);
    restyle();
    if (options.fitOnOpen !== false) for (const view of views.all()) session.dispatch('view.fit', { view: view.id });
    return success({ ref, loaded, keys: modelKeys }, loaded.diagnostics);
  };

  const close = (modelId: string): boolean => {
    const table = binding.tableOf(modelId);
    if (table === undefined) return false;
    views.removeGroups(table.groups);
    binding.removeModel(modelId);
    const gone = opened.findIndex((one) => one.ref.id === modelId);
    if (gone !== -1) {
      for (const key of opened[gone]?.keys ?? []) {
        base.delete(key);
        const at = keys.indexOf(key);
        if (at !== -1) keys.splice(at, 1);
      }
      opened.splice(gone, 1);
      session.write(modelsSlice, { open: opened.map((one) => one.ref) });
    }
    applyEnvironmentToViews();
    return true;
  };

  const firstView = (viewId: string | undefined): View | undefined =>
    viewId === undefined ? views.all()[0] : views.get(viewId);

  // The live camera of every view, written into the slice, so a saved scene carries where the
  // views actually are rather than where they last happened to be recorded.
  const syncViews = (): void => {
    const state = session.read(viewSlice);
    const cameras: Record<string, ViewState> = { ...state.cameras };
    for (const view of views.all()) cameras[view.id] = view.camera();
    const mode = views.all()[0]?.mode() ?? state.mode;
    session.write(viewSlice, { cameras, mode, linked: views.linked() });
  };

  return {
    session,
    features: host,
    views,
    binding,

    open: async (source, formatOptions) => {
      const loaded = await loadModel(source, formatOptions ?? {});
      if (!loaded.ok) return failure(loaded.diagnostics);
      const shown = show(loaded.value);
      return shown.ok ? success(shown.value, [...loaded.diagnostics, ...shown.diagnostics]) : shown;
    },
    show,
    close,
    models: () => opened.map((one) => one.ref),

    run: (name, commandInput) => session.dispatch(name, commandInput ?? {}),
    describe: () => session.commands.describe(),
    subscribe: (listener) => session.subscribe(listener),

    apply: (...rules) => session.dispatch('appearance.rules', { rules }),
    select: (selected) => session.dispatch('appearance.select', { keys: selected }),
    pick: (x, y, viewId) => {
      const view = firstView(viewId);
      return view === undefined ? undefined : viewsAccess.pick(view.id, x, y);
    },

    bounds: () => binding.bounds(),
    statistics: () => binding.statistics(),
    hud: (viewId) => {
      const view = firstView(viewId);
      const gpu = view === undefined ? undefined : readGpuTimer(view.renderer.gpu, new DurationLog(1));
      return hudData(
        view?.frames() ?? new DurationLog(1).stats(),
        gpu ?? { state: 'unavailable', reason: 'this viewer has no view' },
        binding.statistics(),
        view?.camera().projection.kind ?? 'perspective',
      );
    },
    capture: async (captureOptions, viewId) => {
      const view = firstView(viewId);
      if (view === undefined)
        return failure([diagnostic('viewer/no-view', 'There is no view to capture.', ['view'])]);
      view.renderNow();
      return captureImage(view.renderer.capture, captureOptions ?? {});
    },

    setEnvironment: (settings) => {
      environment = settings;
      applyEnvironmentToViews();
    },
    setClipping: (region) => {
      section = region;
      for (const view of views.all()) view.setClipping(region);
    },

    save: () => {
      syncViews();
      return saveScene(session, opened.map((one) => one.ref));
    },
    load: (document, loadOptions) =>
      loadScene(session, document, {
        models: opened.map((one) => one.ref),
        ...loadOptions,
      }),

    addView,

    diagnostics: () => [...observed, ...session.diagnostics()],
    disposed: () => closed,
    dispose: () => {
      if (closed) return;
      closed = true;
      for (const one of [...held].reverse()) one.dispose();
      held.length = 0;
      views.dispose();
      host.dispose();
      binding.dispose();
      hostScene.clear();
      session.dispose();
      opened.length = 0;
      keys.length = 0;
      base.clear();
    },
  };
};
