// Hosting one in-canvas panel over the viewport (contract G1, `hostPanel`). Each panel gets its own
// transparent canvas sized to what it drew, placed at a corner, an edge, or over a world point the
// caller projects. Nothing here reaches into the viewer: the caller supplies the projection, which
// is how the same code serves the gallery, a demo and a test.
import type { Session, Vec3 } from '@bim-open-toolkit/model';
import { failure, success, type Result } from '@bim-open-toolkit/model';
import type { AppSpec } from 'gratify';
import type { AnyHudPanel, Hosted, HudPanel, HudPlace, PanelMount } from './contracts.js';
import { hostSurface } from './host.js';
import type { FrameScheduler } from './surface.js';

// Where a projected world point landed on the viewport, in the container's own pixels.
export type ScreenPoint = { readonly x: number; readonly y: number };

// How a world-placed panel finds its spot, and when it is asked again. Feed `project` the gallery's
// own projection; feed `onFrame` its after-frame hook so the panel follows a moving camera.
export type WorldPlacement = {
  readonly project: (point: Vec3) => ScreenPoint | undefined;
  readonly onFrame?: ((run: () => void) => { readonly dispose: () => void }) | undefined;
};

export type PanelOptions = {
  readonly world?: WorldPlacement | undefined;
  // Distance from the viewport edge, in pixels. 12 by default.
  readonly margin?: number | undefined;
  // The widest a panel may draw before its content is clipped by the canvas.
  readonly maxWidth?: number | undefined;
  readonly frames?: FrameScheduler | undefined;
};

// The intent the host uses to put viewer state into a panel's document. A panel never emits one, so
// its own `update` never sees it.
const syncField = '@ui-gratify/sync';

type SyncIntent<D> = { readonly '@ui-gratify/sync': D };

type HostIntent<D, I> = I | SyncIntent<D>;

const isSyncIntent = <D, I>(intent: HostIntent<D, I>): intent is SyncIntent<D> =>
  typeof intent === 'object' && intent !== null && syncField in intent;

const placeCanvas = (canvas: HTMLCanvasElement, place: HudPlace, margin: number): void => {
  const style = canvas.style;
  style.position = 'absolute';
  style.pointerEvents = 'auto';
  if (place.kind === 'corner') {
    if (place.corner === 'top-left' || place.corner === 'top-right') style.top = `${margin}px`;
    else style.bottom = `${margin}px`;
    if (place.corner === 'top-left' || place.corner === 'bottom-left') style.left = `${margin}px`;
    else style.right = `${margin}px`;
    return;
  }
  if (place.kind === 'edge') {
    if (place.edge === 'top') style.top = `${margin}px`;
    else style.bottom = `${margin}px`;
    style.left = '50%';
    style.transform = 'translateX(-50%)';
    return;
  }
  style.left = '0px';
  style.top = '0px';
  style.visibility = 'hidden';
};

// Keeps a world-placed panel over its point: the canvas's bottom-left corner, which is where the
// `Tag` widget puts the foot of its leader line, sits on the projected point.
const followWorld = (
  canvas: HTMLCanvasElement,
  height: () => number,
  place: Extract<HudPlace, { kind: 'world' }>,
  session: Session,
  world: WorldPlacement | undefined,
): (() => void) => () => {
  const style = canvas.style;
  const point = place.point(session);
  const at = point === undefined || world === undefined ? undefined : world.project(point);
  if (at === undefined) {
    style.visibility = 'hidden';
    return;
  }
  style.visibility = 'visible';
  style.left = `${Math.round(at.x)}px`;
  style.top = `${Math.round(at.y - height())}px`;
};

// Makes sure a panel's canvas can be placed inside its container.
const ensurePositioned = (container: HTMLElement): void => {
  if (typeof getComputedStyle !== 'function') return;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
};

// Hosts one panel over the viewport. The panel's `sync` runs after each session change event and its
// `onCommit` after each change the panel's own intents made, never after a sync, so a panel that
// mirrors viewer state cannot drive itself in a loop.
export const hostPanel = <D, I>(
  container: HTMLElement,
  panel: HudPanel<D, I>,
  session: Session,
  options: PanelOptions = {},
): Result<Hosted> => {
  let syncing = false;
  const spec: AppSpec<D, HostIntent<D, I>> = {
    init: panel.spec.init,
    update: (doc, intent) =>
      isSyncIntent<D, I>(intent) ? intent[syncField] : panel.spec.update(doc, intent),
    view: (doc) => panel.spec.view(doc),
    ambient: (doc, time) => panel.spec.ambient?.(doc, time) ?? false,
    onCommit: (doc, previous) => {
      panel.spec.onCommit?.(doc, previous);
      if (!syncing) panel.onCommit?.(doc, previous, session);
    },
  };

  const hosted = hostSurface<D, HostIntent<D, I>>(container, {
    id: panel.id,
    spec,
    sizing: { kind: 'content', maxWidth: options.maxWidth },
    frames: options.frames,
  });
  if (!hosted.ok) return failure(hosted.diagnostics);
  const surface = hosted.value;

  ensurePositioned(container);
  placeCanvas(surface.canvas, panel.place, options.margin ?? 12);

  const reposition =
    panel.place.kind === 'world'
      ? followWorld(surface.canvas, () => surface.size().y, panel.place, session, options.world)
      : undefined;
  reposition?.();

  const sync = panel.sync;
  const subscription = session.subscribe(() => {
    if (sync !== undefined) {
      const next = sync(session, surface.doc());
      if (next !== surface.doc()) {
        syncing = true;
        surface.dispatch({ [syncField]: next });
        syncing = false;
      }
    }
    reposition?.();
    surface.wake();
  });

  const frames = reposition === undefined ? undefined : options.world?.onFrame?.(reposition);

  return success({
    canvas: surface.canvas,
    semantics: surface.semantics,
    activate: surface.activate,
    onChanged: surface.onChanged,
    dispose: () => {
      frames?.dispose();
      subscription.dispose();
      surface.dispose();
    },
  });
};

// A mount a demo can apply to panels of different document and intent types without a cast: hand it
// to `AnyHudPanel.host` and each panel applies it to itself.
export const panelMount = (
  container: HTMLElement,
  session: Session,
  options: PanelOptions = {},
): PanelMount => (panel) => hostPanel(container, panel, session, options);

// Hosts a panel whose types are already closed over.
export const hostAnyPanel = (
  container: HTMLElement,
  panel: AnyHudPanel,
  session: Session,
  options: PanelOptions = {},
): Result<Hosted> => panel.host(panelMount(container, session, options));
