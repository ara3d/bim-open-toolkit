// Analytical overlays: points, lines, labels and heat maps, held as data in the scene document.
//
// The primitives are render's `overlays` module, unchanged, so the renderer that draws them and the
// hit test that answers a click are the ones that module already provides. This feature adds what a
// document needs and a renderer does not: a slice, schemas so the primitives survive a save and a
// load, a legend so a colour by value can be read, and commands so a workflow result becomes an
// overlay without anybody translating it by hand.
//
// Projection is deliberately absent. It needs a camera and a viewport, which belong to the view,
// so the sink is handed the layers and calls render's `projectOverlays` itself.

import {
  array,
  boolean,
  command,
  diagnostic,
  disposable,
  enumeration,
  failure,
  feature,
  number,
  object,
  onSlices,
  optional,
  record,
  refine,
  stateSlice,
  string,
  success,
  tuple,
  union,
  warning,
  type Color,
  type Command,
  type Disposable,
  type Feature,
  type Migration,
  type Result,
  type Schema,
  type Session,
  type StateSlice,
  type Vec3,
} from '@bim-open-toolkit/model';
import {
  checkOverlays,
  noOverlays,
  objectAnchor,
  overlayItem,
  overlayKinds,
  putLayer,
  removeLayer,
  worldAnchor,
  type OverlayAction,
  type OverlayAnchor,
  type OverlayItem,
  type OverlayLayer,
  type OverlayState,
  type OverlayStyle,
} from '@bim-open-toolkit/render';

const vec3Schema: Schema<Vec3> = tuple(number(), number(), number());
const colorSchema: Schema<Color> = tuple(number(), number(), number());

// A world anchor or an object anchor, as a document stores them.
export const overlayAnchorSchema: Schema<OverlayAnchor> = union<OverlayAnchor>(
  object({ kind: enumeration(['world'] as const), point: vec3Schema }),
  object({ kind: enumeration(['object'] as const), key: string() }),
);

// What a click dispatches: a command name and plain values.
export const overlayActionSchema: Schema<OverlayAction> = object({
  command: string(),
  input: record(union<string | number | boolean>(string(), number(), boolean())),
});

// How a primitive is drawn.
export const overlayStyleSchema: Schema<OverlayStyle> = object({
  color: colorSchema,
  opacity: number(),
  size: number(),
});

// One primitive. The anchor count a kind needs is checked by render's `overlayItem`, not here,
// because a schema states a shape and that rule is about how many anchors a shape carries.
export const overlayItemSchema: Schema<OverlayItem> = object({
  id: string(),
  kind: enumeration(overlayKinds),
  anchors: array(overlayAnchorSchema),
  style: overlayStyleSchema,
  text: optional(string()),
  action: optional(overlayActionSchema),
});

// One layer of primitives with its own visibility.
export const overlayLayerSchema: Schema<OverlayLayer> = object({
  id: string(),
  name: string(),
  visible: boolean(),
  items: array(overlayItemSchema),
});

// Every layer, in draw order.
export const overlayStateSchema: Schema<OverlayState> = array(overlayLayerSchema);

// One step of a colour scale: the value at which the colour applies.
export type LegendStop = {
  readonly value: number;
  readonly color: Color;
  readonly label?: string | undefined;
};

// How a colour by value reads: what is being measured, in what units, and the scale itself.
// A heat map without one is a picture nobody can interpret, so the legend is part of the state.
export type OverlayLegend = {
  readonly id: string;
  readonly title: string;
  readonly units?: string | undefined;
  readonly stops: readonly LegendStop[];
};

// The overlay layers and the legends that explain them.
export type OverlaysState = {
  readonly layers: OverlayState;
  readonly legends: readonly OverlayLegend[];
};

// One step of a colour scale.
export const legendStopSchema: Schema<LegendStop> = object({
  value: number(),
  color: colorSchema,
  label: optional(string()),
});

// A colour scale, refusing one with no steps: it could colour nothing.
export const overlayLegendSchema: Schema<OverlayLegend> = refine(
  object({ id: string(), title: string(), units: optional(string()), stops: array(legendStopSchema) }),
  (value) => value.stops.length > 0,
  'overlays/empty-legend',
  'A legend needs at least one stop.',
);

// The whole slice.
export const overlaysSchema: Schema<OverlaysState> = object({
  layers: overlayStateSchema,
  legends: array(overlayLegendSchema),
});

// No overlays and no legends.
export const noOverlayState: OverlaysState = { layers: noOverlays, legends: [] };

// Version 1 has no earlier versions to read; a later version adds its step here.
export const overlayMigrations: readonly Migration[] = [];

// The slice the overlays feature owns.
export const overlaysSlice: StateSlice<OverlaysState> = stateSlice(
  'overlays',
  1,
  overlaysSchema,
  noOverlayState,
  overlayMigrations,
);

// The stops in rising value order, which is the order a scale is read in.
export const orderedStops = (legend: OverlayLegend): readonly LegendStop[] =>
  [...legend.stops].sort((a, b) => a.value - b.value);

// One channel of a colour, interpolated between two stops.
const mix = (from: number, to: number, fraction: number): number => from + (to - from) * fraction;

// The colour a value takes on a legend's scale.
//
// A value below the first stop takes the first colour and one above the last takes the last, rather
// than being left uncoloured: the scale says what the extremes look like, and clamping is honest
// about a reading outside the range in a way that a missing point is not.
export const heatColor = (legend: OverlayLegend, value: number): Color => {
  const stops = orderedStops(legend);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) return [0.5, 0.5, 0.5];
  if (!Number.isFinite(value) || value <= first.value) return first.color;
  if (value >= last.value) return last.color;
  for (let at = 1; at < stops.length; at += 1) {
    const low = stops[at - 1];
    const high = stops[at];
    if (low === undefined || high === undefined || value > high.value) continue;
    const span = high.value - low.value;
    const fraction = span === 0 ? 0 : (value - low.value) / span;
    return [
      mix(low.color[0], high.color[0], fraction),
      mix(low.color[1], high.color[1], fraction),
      mix(low.color[2], high.color[2], fraction),
    ];
  }
  return last.color;
};

// One reading to be drawn as a coloured point.
export type HeatSample = {
  readonly id: string;
  readonly anchor: OverlayAnchor;
  readonly value: number;
  readonly text?: string | undefined;
};

// A layer of points coloured by value against the legend, with the value's own text where it has
// one. A sample whose value is not a finite number still draws, at the legend's low colour, because
// leaving it out would silently hide a reading nobody could then ask about.
export const heatMapLayer = (
  id: string,
  name: string,
  samples: readonly HeatSample[],
  legend: OverlayLegend,
  size = 6,
): Result<OverlayLayer> => {
  const built = samples.map((sample) =>
    overlayItem(
      sample.id,
      'point',
      [sample.anchor],
      { color: heatColor(legend, sample.value), opacity: 1, size },
      sample.text,
    ),
  );
  const diagnostics = built.flatMap((item) => item.diagnostics);
  const items = built.flatMap((item) => (item.ok ? [item.value] : []));
  return items.length === built.length
    ? success({ id, name, visible: true, items }, diagnostics)
    : failure(diagnostics);
};

// The primitive with that id, wherever it is, or undefined.
export const findOverlayItem = (state: OverlaysState, id: string): OverlayItem | undefined => {
  for (const layer of state.layers) {
    const found = layer.items.find((item) => item.id === id);
    if (found !== undefined) return found;
  }
  return undefined;
};

// The click action of the named primitive, or undefined when it has none.
export const overlayActionOf = (state: OverlaysState, id: string): OverlayAction | undefined =>
  findOverlayItem(state, id)?.action;

// Dispatches the click action of the named primitive.
//
// A click is a command like any other, so what a marker does when it is clicked is the same thing a
// keyboard binding or an assistant can do, and it is visible in the document rather than in a
// closure a renderer holds.
export const clickOverlay = (session: Session, id: string): Result<unknown> => {
  const action = overlayActionOf(session.read(overlaysSlice), id);
  return action === undefined
    ? failure([diagnostic('overlays/no-action', `The overlay "${id}" has no click action.`)])
    : session.dispatch(action.command, action.input);
};

// Where a workflow overlay sits, as `overlayRecord` writes it: on an object, or at a point in the
// model's own frame. The workflows package names the same two forms `object` and `point`.
export type WorkflowOverlayAnchor =
  | { readonly kind: 'object'; readonly key: string }
  | { readonly kind: 'point'; readonly position: Vec3 };

// What a workflow result carries for one overlay, as `overlayRecord` writes it. The workflows
// package builds these; this feature reads them, so a wave 3 recipe dispatches its own data.
export type WorkflowOverlayRecord = {
  readonly kind: 'marker' | 'label' | 'line';
  readonly id: string;
  readonly text: string;
  readonly outcome: string;
  readonly at?: WorkflowOverlayAnchor | undefined;
  readonly from?: WorkflowOverlayAnchor | undefined;
  readonly to?: WorkflowOverlayAnchor | undefined;
};

// The anchor a workflow record carries, in either of its two forms.
export const workflowAnchorSchema: Schema<WorkflowOverlayAnchor> = union<WorkflowOverlayAnchor>(
  object({ kind: enumeration(['object'] as const), key: string() }),
  object({ kind: enumeration(['point'] as const), position: vec3Schema }),
);

// One overlay as a workflow result writes it.
export const workflowOverlaySchema: Schema<WorkflowOverlayRecord> = object({
  kind: enumeration(['marker', 'label', 'line'] as const),
  id: string(),
  text: string(),
  outcome: string(),
  at: optional(workflowAnchorSchema),
  from: optional(workflowAnchorSchema),
  to: optional(workflowAnchorSchema),
});

// The colour each workflow outcome is drawn in. A display convention, not domain meaning.
export const outcomeColors: Readonly<Record<string, Color>> = {
  resolved: [0.2, 0.65, 0.32],
  missing: [0.62, 0.62, 0.62],
  conflicting: [0.9, 0.25, 0.2],
  candidate: [0.98, 0.7, 0.1],
  excluded: [0.45, 0.45, 0.55],
};

// The colour of an outcome, or a neutral grey for an outcome this feature has no convention for.
export const outcomeColor = (outcome: string): Color => outcomeColors[outcome] ?? [0.6, 0.6, 0.6];

// A workflow anchor as a render anchor.
const anchorOf = (anchor: WorkflowOverlayAnchor): OverlayAnchor =>
  anchor.kind === 'object' ? objectAnchor(anchor.key) : worldAnchor(anchor.position);

// A workflow overlay record as a render primitive: a marker becomes a point, a label a label and a
// line a line between its two ends. The outcome decides the colour and nothing else.
export const overlayFromWorkflow = (record: WorkflowOverlayRecord): Result<OverlayItem> => {
  const style: OverlayStyle = { color: outcomeColor(record.outcome), opacity: 1, size: record.kind === 'line' ? 2 : 6 };
  if (record.kind === 'line') {
    if (record.from === undefined || record.to === undefined)
      return failure([diagnostic('overlays/line-ends', `The line overlay "${record.id}" needs both ends.`)]);
    return overlayItem(record.id, 'line', [anchorOf(record.from), anchorOf(record.to)], style, record.text);
  }
  if (record.at === undefined)
    return failure([diagnostic('overlays/no-anchor', `The overlay "${record.id}" has no anchor.`)]);
  return overlayItem(record.id, record.kind === 'label' ? 'label' : 'point', [anchorOf(record.at)], style, record.text);
};

// The layer a workflow overlay lands in when the caller does not say.
export const workflowLayerId = 'workflow';

// The layer with the primitive added or replaced, creating the layer when it is not there yet.
const withItem = (layers: OverlayState, layerId: string, item: OverlayItem): OverlayState => {
  const existing = layers.find((layer) => layer.id === layerId);
  const items =
    existing === undefined
      ? [item]
      : existing.items.some((candidate) => candidate.id === item.id)
        ? existing.items.map((candidate) => (candidate.id === item.id ? item : candidate))
        : [...existing.items, item];
  return putLayer(layers, { id: layerId, name: existing?.name ?? layerId, visible: existing?.visible ?? true, items });
};

// Replaces the whole overlay state. Repeated ids are reported as warnings, not refused: a caller
// that means to draw two things with one id gets a picture and a complaint, not silence.
const setCommand: Command = command({
  name: 'overlays.set',
  title: 'Set overlays',
  description: 'Replaces every overlay layer, and the legends that explain them.',
  input: object({ layers: overlayStateSchema, legends: optional(array(overlayLegendSchema)) }),
  run: (session: Session, input) => {
    const state: OverlaysState = { layers: input.layers, legends: input.legends ?? [] };
    session.write(overlaysSlice, state);
    return success(state, checkOverlays(state.layers));
  },
});

// Adds one overlay from a workflow result, in the form `overlayRecord` writes.
const addCommand: Command = command({
  name: 'overlays.add',
  title: 'Add overlay',
  description: "Adds one overlay from a workflow result's overlay record.",
  input: object({ kind: enumeration(['marker', 'label', 'line'] as const), id: string(), text: string(), outcome: string(), at: optional(workflowAnchorSchema), from: optional(workflowAnchorSchema), to: optional(workflowAnchorSchema), layerId: optional(string()) }),
  run: (session: Session, input) => {
    const built = overlayFromWorkflow(input);
    if (!built.ok) return failure(built.diagnostics);
    const state = session.read(overlaysSlice);
    const layers = withItem(state.layers, input.layerId ?? workflowLayerId, built.value);
    session.write(overlaysSlice, { ...state, layers });
    return success(built.value, built.diagnostics);
  },
});

// Removes one layer, or every layer and legend when no layer is named.
const clearCommand: Command = command({
  name: 'overlays.clear',
  title: 'Clear overlays',
  description: 'Removes one overlay layer, or all of them.',
  input: object({ layerId: optional(string()) }),
  run: (session: Session, input) => {
    const state = session.read(overlaysSlice);
    if (input.layerId === undefined) {
      session.write(overlaysSlice, noOverlayState);
      return success(noOverlayState);
    }
    const present = state.layers.some((layer) => layer.id === input.layerId);
    const next: OverlaysState = { ...state, layers: removeLayer(state.layers, input.layerId) };
    session.write(overlaysSlice, next);
    return success(next, present ? [] : [warning('overlays/unknown-layer', `There is no overlay layer "${input.layerId}".`)]);
  },
});

// The commands the overlays feature registers, in the order a registry lists them.
export const overlayCommands: readonly Command[] = [setCommand, addCommand, clearCommand];

// What a renderer is handed whenever the overlay slice changes: the layers, in draw order.
//
// It is the state rather than placed primitives because placing them needs a camera and a viewport.
// The renderer holds both and calls render's `projectOverlays`; this feature holds neither.
export type OverlaySink = {
  readonly showOverlays: (layers: OverlayState) => void;
};

// Analytical overlays with no renderer attached: the state and the commands, drawing nothing.
export const overlaysFeature: Feature<OverlaysState> = feature('overlays', overlaysSlice, overlayCommands);

// Analytical overlays that push every change to a renderer, starting with what is already there.
export const overlaysFeatureWith = (sink: OverlaySink): Feature<OverlaysState> =>
  feature('overlays', overlaysSlice, overlayCommands, [], (session: Session): Disposable => {
    sink.showOverlays(session.read(overlaysSlice).layers);
    const stop = session.subscribe(
      onSlices([overlaysSlice.id], () => sink.showOverlays(session.read(overlaysSlice).layers)),
    );
    return disposable(() => stop.dispose());
  });
