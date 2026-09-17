// Analytical overlays: points, lines, arrows, labels, paths and boxes, as data.
//
// Every primitive has the same shape - a kind, an ordered list of anchors, a style, optional text
// and an optional click action - so one projection function and one hit test serve all of them, and
// a renderer decides what each kind looks like. The kind fixes how many anchors are meaningful, and
// `overlayItem` refuses a primitive that does not have them.
//
// An anchor is a world point or an object key. Object anchors are resolved through a function the
// caller supplies, so this module never learns how an object's position is found and an anchor
// whose object has gone stays unresolved rather than moving to a different object.
//
// Overlays are not model geometry: they are not in object inventories and they do not contribute to
// fit-to-selection bounds. A hidden layer neither projects nor answers a click.

import {
  diagnostic,
  failure,
  success,
  type Color,
  type Diagnostic,
  type Matrix4,
  type ObjectKey,
  type Result,
  type Vec3,
} from '@bim-open-toolkit/model';
import { projectPoint } from './picking.js';

// Where a primitive sits: a fixed world point, or wherever an object is now.
export type OverlayAnchor =
  | { readonly kind: 'world'; readonly point: Vec3 }
  | { readonly kind: 'object'; readonly key: ObjectKey };

// A world anchor.
export const worldAnchor = (point: Vec3): OverlayAnchor => ({ kind: 'world', point });

// An anchor that follows an object.
export const objectAnchor = (key: ObjectKey): OverlayAnchor => ({ kind: 'object', key });

// What a click on a primitive dispatches. A command name and plain values, so the same action works
// from a pointer, a keyboard binding or an assistant.
export type OverlayAction = {
  readonly command: string;
  readonly input: Readonly<Record<string, string | number | boolean>>;
};

// How a primitive is drawn. `size` is in screen pixels for points and labels and in pixels of line
// width for the rest.
export type OverlayStyle = {
  readonly color: Color;
  readonly opacity: number;
  readonly size: number;
};

// A readable default: a strong orange at full opacity.
export const defaultOverlayStyle: OverlayStyle = { color: [0.98, 0.45, 0.09], opacity: 1, size: 4 };

// The primitives, in the order a legend lists them.
export const overlayKinds = ['point', 'line', 'arrow', 'label', 'path', 'box'] as const;

// One of the primitives.
export type OverlayKind = (typeof overlayKinds)[number];

// How many anchors a kind needs, and whether more are allowed.
const anchorRule = (kind: OverlayKind): { readonly least: number; readonly most: number } => {
  if (kind === 'point' || kind === 'label') return { least: 1, most: 1 };
  if (kind === 'line' || kind === 'arrow' || kind === 'box') return { least: 2, most: 2 };
  return { least: 2, most: Number.POSITIVE_INFINITY };
};

// One overlay primitive.
export type OverlayItem = {
  readonly id: string;
  readonly kind: OverlayKind;
  readonly anchors: readonly OverlayAnchor[];
  readonly style: OverlayStyle;
  readonly text?: string | undefined;
  readonly action?: OverlayAction | undefined;
};

// A primitive, refusing an anchor count its kind cannot draw. A box takes two opposite corners, a
// path takes two or more points, a label takes one anchor and its text.
export const overlayItem = (
  id: string,
  kind: OverlayKind,
  anchors: readonly OverlayAnchor[],
  style: OverlayStyle = defaultOverlayStyle,
  text?: string,
  action?: OverlayAction,
): Result<OverlayItem> => {
  const rule = anchorRule(kind);
  if (anchors.length < rule.least || anchors.length > rule.most)
    return failure([
      diagnostic('bad-anchor-count', `A ${kind} takes ${rule.least} to ${rule.most} anchors, not ${anchors.length}`, ['anchors']),
    ]);
  if (kind === 'label' && (text === undefined || text === ''))
    return failure([diagnostic('missing-text', 'A label needs text', ['text'])]);
  return success({
    id,
    kind,
    anchors,
    style,
    ...(text === undefined ? {} : { text }),
    ...(action === undefined ? {} : { action }),
  });
};

// An independent layer of primitives, with its own visibility.
export type OverlayLayer = {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly items: readonly OverlayItem[];
};

// Every layer, in draw order.
export type OverlayState = readonly OverlayLayer[];

// No overlays.
export const noOverlays: OverlayState = [];

// A visible layer.
export const overlayLayer = (id: string, name: string, items: readonly OverlayItem[] = []): OverlayLayer => ({
  id,
  name,
  visible: true,
  items,
});

// Adds or replaces a layer, keeping the order of the layers already there.
export const putLayer = (state: OverlayState, layer: OverlayLayer): OverlayState =>
  state.some((item) => item.id === layer.id)
    ? state.map((item) => (item.id === layer.id ? layer : item))
    : [...state, layer];

// Removes a layer.
export const removeLayer = (state: OverlayState, id: string): OverlayState =>
  state.filter((layer) => layer.id !== id);

// Shows or hides a layer.
export const setLayerVisible = (state: OverlayState, id: string, visible: boolean): OverlayState =>
  state.map((layer) => (layer.id === id ? { ...layer, visible } : layer));

// Adds or replaces one primitive inside a layer.
export const putItem = (state: OverlayState, layerId: string, item: OverlayItem): OverlayState =>
  state.map((layer) =>
    layer.id !== layerId
      ? layer
      : {
          ...layer,
          items: layer.items.some((existing) => existing.id === item.id)
            ? layer.items.map((existing) => (existing.id === item.id ? item : existing))
            : [...layer.items, item],
        });

// Removes one primitive.
export const removeItem = (state: OverlayState, layerId: string, itemId: string): OverlayState =>
  state.map((layer) =>
    layer.id !== layerId ? layer : { ...layer, items: layer.items.filter((item) => item.id !== itemId) });

// Every primitive of every visible layer, paired with the layer it came from.
export const visibleItems = (
  state: OverlayState,
): readonly { readonly layer: OverlayLayer; readonly item: OverlayItem }[] =>
  state.flatMap((layer) => (layer.visible ? layer.items.map((item) => ({ layer, item })) : []));

// A point on the drawing surface, in pixels from the top left.
export type ScreenPoint = {
  readonly x: number;
  readonly y: number;
};

// A primitive placed on the drawing surface. `points` follows `anchors`; an anchor that could not
// be resolved or that falls outside the view leaves `visible` false, and the renderer skips it.
export type ProjectedOverlay = {
  readonly layerId: string;
  readonly item: OverlayItem;
  readonly points: readonly ScreenPoint[];
  readonly world: readonly Vec3[];
  readonly visible: boolean;
};

// What a renderer has to provide: the placed primitives to draw now.
export type OverlayRenderer = {
  readonly setOverlays: (items: readonly ProjectedOverlay[]) => void;
};

// Where an object is, for anchors that follow one. Returning undefined is the honest answer for an
// object that has been deleted, and leaves the primitive unresolved.
export type AnchorPositions = (key: ObjectKey) => Vec3 | undefined;

// The world point of an anchor, or undefined when it follows an object nobody can place.
export const resolveAnchor = (anchor: OverlayAnchor, positions: AnchorPositions): Vec3 | undefined =>
  anchor.kind === 'world' ? anchor.point : positions(anchor.key);

// Places a world point on the drawing surface, or undefined when it is outside the view.
export const projectToScreen = (
  viewProjection: Matrix4,
  point: Vec3,
  width: number,
  height: number,
): ScreenPoint | undefined => {
  const ndc = projectPoint(viewProjection, point);
  if (ndc === undefined) return undefined;
  const [x, y, z] = ndc;
  if (!Number.isFinite(x) || !Number.isFinite(y) || z < -1 || z > 1) return undefined;
  return { x: ((x + 1) * width) / 2, y: ((1 - y) * height) / 2 };
};

// Places every primitive of every visible layer.
//
// A primitive is visible only when every one of its anchors resolved and landed in the view, so a
// leader line with one end behind the camera is not drawn half way across the screen.
export const projectOverlays = (
  state: OverlayState,
  viewProjection: Matrix4,
  width: number,
  height: number,
  positions: AnchorPositions = () => undefined,
): readonly ProjectedOverlay[] =>
  visibleItems(state).map(({ layer, item }) => {
    const world: Vec3[] = [];
    const points: ScreenPoint[] = [];
    let visible = true;
    for (const anchor of item.anchors) {
      const place = resolveAnchor(anchor, positions);
      if (place === undefined) {
        visible = false;
        continue;
      }
      world.push(place);
      const screen = projectToScreen(viewProjection, place, width, height);
      if (screen === undefined) visible = false;
      else points.push(screen);
    }
    return { layerId: layer.id, item, points, world, visible };
  });

// The nearest visible primitive within `radius` pixels of a point, or undefined.
//
// Only visible layers are searched, so a hidden overlay neither draws nor intercepts a click.
export const overlayAt = (
  projected: readonly ProjectedOverlay[],
  point: ScreenPoint,
  radius: number,
): ProjectedOverlay | undefined => {
  let nearest: ProjectedOverlay | undefined;
  let best = radius;
  for (const candidate of projected) {
    if (!candidate.visible) continue;
    for (const at of candidate.points) {
      const distance = Math.hypot(at.x - point.x, at.y - point.y);
      if (distance <= best) {
        best = distance;
        nearest = candidate;
      }
    }
  }
  return nearest;
};

// The action a click on a primitive dispatches, or undefined when it has none.
export const clickAction = (candidate: ProjectedOverlay | undefined): OverlayAction | undefined =>
  candidate?.item.action;

// Every primitive id used more than once, which a caller should treat as a mistake in its data.
export const repeatedItemIds = (state: OverlayState): readonly string[] => {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const layer of state)
    for (const item of layer.items) {
      if (seen.has(item.id)) repeated.add(item.id);
      seen.add(item.id);
    }
  return [...repeated];
};

// Diagnostics for a whole overlay state: repeated layer ids and repeated primitive ids.
export const checkOverlays = (state: OverlayState): readonly Diagnostic[] => {
  const notes: Diagnostic[] = [];
  const layers = new Set<string>();
  for (const layer of state) {
    if (layers.has(layer.id))
      notes.push(diagnostic('repeated-layer', `Layer id ${layer.id} is used more than once`, ['layers'], 'warning'));
    layers.add(layer.id);
  }
  const repeated = repeatedItemIds(state);
  if (repeated.length > 0)
    notes.push(
      diagnostic('repeated-overlay-item', `Overlay ids repeat: ${repeated.join(', ')}`, ['layers'], 'warning'),
    );
  return notes;
};
