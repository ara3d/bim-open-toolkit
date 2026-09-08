// Layouts: explode by storey or by category, and arrange objects on a grid.
//
// A layout is a set of translations, never a new transform: the slice holds the layout's parameters
// and the base translations stay in the group buffers' own history through `captureTranslations`, so
// `layouts.reset` puts every object back exactly where the model placed it. Nothing here rewrites
// `ObjectRecord.transform`, and nothing is saved except the parameters, which is what makes a
// layout reversible across a reload as well as within a session.
//
// Offsets are computed from the model's placements: an object's centre is where its own transform
// puts it. That is enough for both layouts and needs no geometry, so the whole computation is a
// pure function tested in Node.

import {
  array,
  boundsCenter,
  boundsOf,
  boundsSize,
  command,
  diagnostic,
  disposable,
  failure,
  feature,
  integer,
  literal,
  number,
  object,
  objectKey,
  onSlices,
  optional,
  refine,
  stateSlice,
  string,
  subVec3,
  success,
  union,
  type Bounds,
  type Command,
  type Disposable,
  type Feature,
  type Migration,
  type ModelData,
  type ObjectKey,
  type Schema,
  type Session,
  type StateSlice,
  type UpAxis,
  type Vec3,
} from '@bim-open-toolkit/model';
import {
  everyRow,
  translationStride,
  writeTranslations,
  type DirtySets,
  type InstanceTable,
} from '@bim-open-toolkit/render';
import { levelAt, levelsOf } from './navigation-aids.js';

// What an explode separates: the storeys of a building, or the categories of its objects.
export type ExplodeBy = 'storey' | 'category';

// The layout in force. `none` is the model's own placement, which every layout is measured from.
export type Layout =
  | { readonly kind: 'none' }
  | { readonly kind: 'explode'; readonly by: ExplodeBy; readonly strength: number }
  | {
      readonly kind: 'grid';
      readonly spacing: number;
      readonly columns: number;
      readonly keys: readonly ObjectKey[];
    };

// The saved layout state.
export type LayoutsState = { readonly layout: Layout };

// Where one object sits, which is all a layout needs to know about it.
export type Placement = { readonly key: ObjectKey; readonly center: Vec3 };

// What a layout moves: the rows, the object placements behind them and the model they came from.
// `moved` is called after each write so the host publishes the groups whose buffers changed.
export type LayoutHost = {
  readonly table: InstanceTable;
  readonly model: ModelData;
  readonly dirty?: DirtySets | undefined;
  readonly moved?: ((rows: number) => void) | undefined;
};

const positive = (schema: Schema<number>, what: string): Schema<number> =>
  refine(schema, (value) => value > 0, 'layouts/positive', `${what} must be above zero.`);

const layoutSchema = union<Layout>(
  object({ kind: literal('none') }),
  object({
    kind: literal('explode'),
    by: union<ExplodeBy>(literal('storey'), literal('category')),
    strength: refine(number(), (value) => value >= 0, 'layouts/strength', 'Strength cannot be negative.'),
  }),
  object({
    kind: literal('grid'),
    spacing: refine(number(), (value) => value >= 0, 'layouts/spacing', 'Spacing cannot be negative.'),
    columns: refine(integer(), (value) => value >= 0, 'layouts/columns', 'Columns cannot be negative.'),
    keys: array(string()),
  }),
);

// The shape of the layouts slice.
export const layoutsSchema: Schema<LayoutsState> = object({ layout: layoutSchema });

// No layout: every object where the model placed it.
export const noLayout: Layout = { kind: 'none' };

// The layouts slice before anything is arranged.
export const defaultLayouts: LayoutsState = { layout: noLayout };

// Steps that read a layouts slice written at an older version. Version 1 has no history yet.
export const layoutsMigrations: readonly Migration[] = [];

// The saved layout: its parameters only, never the moved positions.
export const layoutsSlice: StateSlice<LayoutsState> = stateSlice(
  'layouts',
  1,
  layoutsSchema,
  defaultLayouts,
  layoutsMigrations,
);

// The index of each axis in a column-major transform's translation.
const translationAt = 12;

// The two ground axes and the up axis, for the frame the model reports in.
const axesFor = (up: UpAxis): { readonly first: number; readonly second: number; readonly up: number } =>
  up === 'y' ? { first: 0, second: 2, up: 1 } : { first: 0, second: 1, up: 2 };

// A vector from a ground pair and a height, in the frame's own axis order.
const inFrame = (first: number, second: number, height: number, up: UpAxis): Vec3 =>
  up === 'y' ? [first, height, second] : [first, second, height];

// Where each object of the model sits: the translation of its own transform.
export const placementsOf = (model: ModelData): readonly Placement[] =>
  model.objects.map((record) => ({
    key: objectKey(record.ref),
    center: [
      record.transform[translationAt] ?? 0,
      record.transform[translationAt + 1] ?? 0,
      record.transform[translationAt + 2] ?? 0,
    ],
  }));

// The box containing every placement, which is the extent a layout is scaled against.
export const placementBounds = (placements: readonly Placement[]): Bounds =>
  boundsOf(placements.map((placement) => placement.center));

// Offsets that separate the storeys of a building along the up axis, in storey order.
//
// The separation is one average storey height per storey per unit of strength, so strength 1
// doubles the spacing between floors and strength 0 is the model's own placement. A model with no
// storey objects has nothing to separate and gets no offsets, which is a fact about the model.
export const storeyExplodeOffsets = (
  model: ModelData,
  strength: number,
): ReadonlyMap<ObjectKey, Vec3> => {
  const levels = levelsOf(model);
  const offsets = new Map<ObjectKey, Vec3>();
  if (levels.length < 2 || strength === 0) return offsets;
  const lowest = levels[0]?.elevation ?? 0;
  const highest = levels[levels.length - 1]?.elevation ?? 0;
  const spread = (highest - lowest) / (levels.length - 1);
  const step = spread > 0 ? spread : 1;
  const axis = axesFor(model.coordinates.up);
  for (const placement of placementsOf(model)) {
    const height = placement.center[axis.up] ?? 0;
    const level = levelAt(levels, height);
    const index = level === undefined ? 0 : levels.indexOf(level);
    if (index <= 0) continue;
    offsets.set(placement.key, inFrame(0, 0, index * step * strength, model.coordinates.up));
  }
  return offsets;
};

// Offsets that fan the categories of a model outwards in the ground plane, one direction each.
//
// Categories are taken in name order so the same model always fans the same way. The distance is
// the model's own ground radius per unit of strength.
export const categoryExplodeOffsets = (
  model: ModelData,
  strength: number,
): ReadonlyMap<ObjectKey, Vec3> => {
  const offsets = new Map<ObjectKey, Vec3>();
  if (strength === 0) return offsets;
  const categories = [...new Set(model.objects.map((record) => record.category ?? ''))].sort();
  if (categories.length < 2) return offsets;
  const bounds = placementBounds(placementsOf(model));
  const size = boundsSize(bounds);
  const axis = axesFor(model.coordinates.up);
  const radius =
    size === undefined
      ? 1
      : Math.max(1, Math.hypot(size[axis.first] ?? 0, size[axis.second] ?? 0) / 2);
  const distance = radius * strength;
  for (const record of model.objects) {
    const place = categories.indexOf(record.category ?? '');
    if (place < 0) continue;
    const angle = (2 * Math.PI * place) / categories.length;
    const spread = inFrame(
      Math.cos(angle) * distance,
      Math.sin(angle) * distance,
      0,
      model.coordinates.up,
    );
    offsets.set(objectKey(record.ref), spread);
  }
  return offsets;
};

// Offsets that arrange the named objects on a grid in the ground plane, centred on the model.
//
// No keys means every object. Columns of zero gives as square an arrangement as the count allows,
// and spacing of zero spreads the objects over about the model's own footprint: the wider ground
// extent divided by the number of columns, and never less than one unit.
export const gridOffsets = (
  model: ModelData,
  keys: readonly ObjectKey[],
  spacing: number,
  columns: number,
): ReadonlyMap<ObjectKey, Vec3> => {
  const placements = placementsOf(model);
  const named = keys.length === 0 ? placements : placements.filter((item) => keys.includes(item.key));
  const offsets = new Map<ObjectKey, Vec3>();
  if (named.length === 0) return offsets;
  const bounds = placementBounds(placements);
  const across = columns > 0 ? columns : Math.ceil(Math.sqrt(named.length));
  const rows = Math.ceil(named.length / across);
  const filled = Math.min(across, named.length);
  const center = boundsCenter(bounds) ?? [0, 0, 0];
  const axis = axesFor(model.coordinates.up);
  const size = boundsSize(bounds);
  const widest = size === undefined ? 0 : Math.max(size[axis.first] ?? 0, size[axis.second] ?? 0);
  const step = spacing > 0 ? spacing : Math.max(1, widest / across);
  named.forEach((placement, index) => {
    const first = (center[axis.first] ?? 0) + ((index % across) - (filled - 1) / 2) * step;
    const second = (center[axis.second] ?? 0) + (Math.floor(index / across) - (rows - 1) / 2) * step;
    const target = inFrame(first, second, placement.center[axis.up] ?? 0, model.coordinates.up);
    offsets.set(placement.key, subVec3(target, placement.center));
  });
  return offsets;
};

// The translation each object gets under a layout. `none` moves nothing.
export const layoutOffsets = (model: ModelData, layout: Layout): ReadonlyMap<ObjectKey, Vec3> => {
  switch (layout.kind) {
    case 'none':
      return new Map();
    case 'explode':
      return layout.by === 'storey'
        ? storeyExplodeOffsets(model, layout.strength)
        : categoryExplodeOffsets(model, layout.strength);
    case 'grid':
      return gridOffsets(model, layout.keys, layout.spacing, layout.columns);
  }
};

// The translation of every row as the table holds it now: the base a layout is measured from.
// Taken once, before any layout is applied, so resetting restores the model's own placement.
export const captureTranslations = (table: InstanceTable): Float32Array => {
  const base = new Float32Array(table.rowCount * translationStride);
  for (let row = 0; row < table.rowCount; row++) {
    const group = table.groupOfRow[row] ?? -1;
    const buffer = table.transforms[group];
    if (buffer === undefined) continue;
    const at = (row - (table.groupStart[group] ?? 0)) * 16 + translationAt;
    base[row * translationStride] = buffer[at] ?? 0;
    base[row * translationStride + 1] = buffer[at + 1] ?? 0;
    base[row * translationStride + 2] = buffer[at + 2] ?? 0;
  }
  return base;
};

// The translation change table for a layout: one translation per row, base plus the offset of the
// object that row draws. Rows whose object the layout does not move keep their base translation, so
// the table is the whole answer and a write with change detection touches only what moved.
export const layoutTranslations = (
  table: InstanceTable,
  base: Float32Array,
  offsets: ReadonlyMap<ObjectKey, Vec3>,
  into?: Float32Array,
): Float32Array => {
  const values = into ?? new Float32Array(table.rowCount * translationStride);
  values.set(base.subarray(0, values.length));
  if (offsets.size === 0) return values;
  const perObject = new Float32Array(table.keys.length * translationStride);
  table.keys.forEach((key, ordinal) => {
    const offset = offsets.get(key);
    if (offset === undefined) return;
    perObject[ordinal * translationStride] = offset[0];
    perObject[ordinal * translationStride + 1] = offset[1];
    perObject[ordinal * translationStride + 2] = offset[2];
  });
  for (let row = 0; row < table.rowCount; row++) {
    const ordinal = table.objectOfRow[row] ?? -1;
    if (ordinal < 0) continue;
    const from = ordinal * translationStride;
    const to = row * translationStride;
    values[to] = (values[to] ?? 0) + (perObject[from] ?? 0);
    values[to + 1] = (values[to + 1] ?? 0) + (perObject[from + 1] ?? 0);
    values[to + 2] = (values[to + 2] ?? 0) + (perObject[from + 2] ?? 0);
  }
  return values;
};

// Writes a layout's translations into the group buffers and reports how many rows moved.
export const writeLayout = (
  table: InstanceTable,
  values: Float32Array,
  dirty?: DirtySets,
): number => writeTranslations(table, everyRow, values, dirty);

// Separates the model, by storey or by category. Strength 0 is the model's own placement.
const explode = command({
  name: 'layouts.explode',
  title: 'Explode',
  description: 'Separate the model by storey or by category; strength 0 puts it back together.',
  input: object({
    by: optional(union<ExplodeBy>(literal('storey'), literal('category'))),
    strength: optional(number()),
  }),
  run: (session: Session, input) => {
    const strength = input.strength ?? 1;
    if (!(strength >= 0))
      return failure([diagnostic('layouts/strength', 'Strength cannot be negative.', ['strength'])]);
    const next: LayoutsState = { layout: { kind: 'explode', by: input.by ?? 'storey', strength } };
    session.write(layoutsSlice, next);
    return success(next);
  },
});

// Arranges objects on a grid. No keys arranges every object; zero spacing or columns is chosen.
const grid = command({
  name: 'layouts.grid',
  title: 'Arrange on a grid',
  description: 'Arrange the named objects, or all of them, on a grid in the ground plane.',
  input: object({
    keys: optional(array(string())),
    spacing: optional(positive(number(), 'Spacing')),
    columns: optional(positive(integer(), 'Columns')),
  }),
  run: (session: Session, input) => {
    const next: LayoutsState = {
      layout: {
        kind: 'grid',
        spacing: input.spacing ?? 0,
        columns: input.columns ?? 0,
        keys: input.keys ?? [],
      },
    };
    session.write(layoutsSlice, next);
    return success(next);
  },
});

// Puts every object back where the model placed it.
const reset = command({
  name: 'layouts.reset',
  title: 'Reset the layout',
  description: 'Put every object back where the model placed it.',
  input: object({}),
  run: (session: Session) => {
    session.write(layoutsSlice, defaultLayouts);
    return success(defaultLayouts);
  },
});

// The commands that arrange and reset the model.
export const layoutsCommands: readonly Command[] = [explode, grid, reset];

// Moves the rows to match the slice's layout, and again whenever a command changes it. The base
// translations are captured at installation, so disposing puts the model back where it was.
export const layoutsHook =
  (host: LayoutHost) =>
  (session: Session): Disposable => {
    const base = captureTranslations(host.table);
    const scratch = new Float32Array(base.length);
    const apply = (layout: Layout): void => {
      const offsets = layoutOffsets(host.model, layout);
      const values = layoutTranslations(host.table, base, offsets, scratch);
      const moved = writeLayout(host.table, values, host.dirty);
      host.moved?.(moved);
    };
    apply(session.read(layoutsSlice).layout);
    const subscription = session.subscribe(
      onSlices([layoutsSlice.id], () => apply(session.read(layoutsSlice).layout)),
    );
    return disposable(() => {
      subscription.dispose();
      apply(noLayout);
    });
  };

// Explode and grid layouts as a feature, applied to the rows by the hook.
export const layoutsFeature: Feature<LayoutsState> = feature('layouts', layoutsSlice, layoutsCommands);
