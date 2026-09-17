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
//
// Some formats do not put the placement there. BFAST leaves every object record at the identity
// because the real placement is on the instance rows and the render path composes it, so reading
// the records alone puts a whole building at one point and no layout can separate anything. A
// layout can therefore be given the placements to compute from - `layoutPlacements` takes them off
// the rows when the records carry none - and every offset function takes them as an optional
// argument, so a model whose records do carry placements computes exactly what it always did.

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
  note,
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
  type Result,
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
  // Where the objects are, when that is not what their own records say. Absent means the records
  // are the answer, which is what every layout computed from before anything took rows into
  // account. Read once, when the hook is installed, so it is the placement the model loaded with
  // and not whatever a layout already in force moved the rows to.
  readonly placements?: readonly Placement[] | undefined;
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

// Floats in one column-major transform.
const transformFloats = 16;

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

// How many distinct points a set of placements puts objects at. One means the placements tell no
// two objects apart, and then nothing computed from them can separate anything.
export const distinctPlacements = (placements: readonly Placement[]): number =>
  new Set(placements.map((placement) => placement.center.join(','))).size;

// Where the drawn rows put each object: the centre of the box around the translations of the rows
// that object draws. An object the table draws no row for gets no placement, because the rows are
// the only thing here that says where it is, and saying nothing is more honest than saying zero.
export const rowPlacements = (table: InstanceTable): readonly Placement[] => {
  const placements: Placement[] = [];
  for (let object = 0; object < table.keys.length; object++) {
    const key = table.keys[object];
    if (key === undefined) continue;
    const start = table.objectStart[object] ?? 0;
    const end = table.objectStart[object + 1] ?? start;
    const low = [Infinity, Infinity, Infinity];
    const high = [-Infinity, -Infinity, -Infinity];
    for (let at = start; at < end; at++) {
      const row = table.objectRows[at] ?? -1;
      const group = table.groupOfRow[row] ?? -1;
      const buffer = table.transforms[group];
      if (buffer === undefined) continue;
      const from = (row - (table.groupStart[group] ?? 0)) * transformFloats + translationAt;
      for (let axis = 0; axis < 3; axis++) {
        const value = buffer[from + axis] ?? 0;
        low[axis] = Math.min(low[axis] ?? Infinity, value);
        high[axis] = Math.max(high[axis] ?? -Infinity, value);
      }
    }
    if (!Number.isFinite(low[0])) continue;
    placements.push({
      key,
      center: [
        ((low[0] ?? 0) + (high[0] ?? 0)) / 2,
        ((low[1] ?? 0) + (high[1] ?? 0)) / 2,
        ((low[2] ?? 0) + (high[2] ?? 0)) / 2,
      ],
    });
  }
  return placements;
};

// The placements a layout should compute from, for a model drawn by an instance table.
//
// The model's own records win whenever they tell two objects apart, so a format that places its
// objects there computes exactly what it always did. When they do not - every record at the
// identity, the whole building at one point - the rows are asked instead. Failing says the rows do
// not separate the objects either, which is a fact about the model and not something to work
// around: the caller keeps the records' answer and whatever it reports about it stays true.
export const layoutPlacements = (
  model: ModelData,
  table: InstanceTable,
): Result<readonly Placement[]> => {
  const own = placementsOf(model);
  if (distinctPlacements(own) > 1) return success(own);
  const rows = rowPlacements(table);
  if (distinctPlacements(rows) > 1)
    return success(rows, [
      note(
        'layouts/placements-from-rows',
        `The object records place all ${model.objects.length} objects at one point, so the layout uses the ${rows.length} placements its instance rows carry.`,
      ),
    ]);
  return failure([
    diagnostic(
      'layouts/no-placements',
      `Neither the object records nor the ${table.rowCount} instance rows place any two objects apart, so no layout computed from placements can separate them.`,
    ),
  ]);
};

// The height each placed object sits at, along the model's up axis.
export const placementElevations = (
  placements: readonly Placement[],
  up: UpAxis,
): ReadonlyMap<ObjectKey, number> => {
  const axis = axesFor(up).up;
  return new Map(placements.map((placement) => [placement.key, placement.center[axis] ?? 0]));
};

// Offsets that separate the storeys of a building along the up axis, in storey order.
//
// The separation is one average storey height per storey per unit of strength, so strength 1
// doubles the spacing between floors and strength 0 is the model's own placement. A model with no
// storey objects has nothing to separate and gets no offsets, which is a fact about the model.
// Neither does a model whose storey objects are all at the same height: there is no gap between
// floors to measure a separation against, and inventing one would move the whole building at once.
//
// The storeys are read from the given placements when there are any, so a model that places its
// objects on its rows separates by the storeys those rows sit on. A storey object with no
// placement among them is not a storey this can use, because nothing says how high it is.
export const storeyExplodeOffsets = (
  model: ModelData,
  strength: number,
  placements?: readonly Placement[],
): ReadonlyMap<ObjectKey, Vec3> => {
  const placed = placements ?? placementsOf(model);
  const levels =
    placements === undefined
      ? levelsOf(model)
      : levelsOf(model, placementElevations(placements, model.coordinates.up));
  const offsets = new Map<ObjectKey, Vec3>();
  if (levels.length < 2 || strength === 0) return offsets;
  const lowest = levels[0]?.elevation ?? 0;
  const highest = levels[levels.length - 1]?.elevation ?? 0;
  const step = (highest - lowest) / (levels.length - 1);
  if (step <= 0) return offsets;
  const axis = axesFor(model.coordinates.up);
  for (const placement of placed) {
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
// the model's own ground radius per unit of strength, measured over the given placements when
// there are any, so a building whose records sit at one point still fans across its real footprint
// rather than across a single unit.
export const categoryExplodeOffsets = (
  model: ModelData,
  strength: number,
  placements?: readonly Placement[],
): ReadonlyMap<ObjectKey, Vec3> => {
  const offsets = new Map<ObjectKey, Vec3>();
  if (strength === 0) return offsets;
  const categories = [...new Set(model.objects.map((record) => record.category ?? ''))].sort();
  if (categories.length < 2) return offsets;
  const bounds = placementBounds(placements ?? placementsOf(model));
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
//
// A grid arranges what the given placements place, so an object with no placement among them is
// left where it is rather than sent to a cell chosen by its position in the file.
export const gridOffsets = (
  model: ModelData,
  keys: readonly ObjectKey[],
  spacing: number,
  columns: number,
  from?: readonly Placement[],
): ReadonlyMap<ObjectKey, Vec3> => {
  const placements = from ?? placementsOf(model);
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

// The translation each object gets under a layout. `none` moves nothing. Without placements every
// layout reads the object records, which is what a model that places its objects there wants.
export const layoutOffsets = (
  model: ModelData,
  layout: Layout,
  placements?: readonly Placement[],
): ReadonlyMap<ObjectKey, Vec3> => {
  switch (layout.kind) {
    case 'none':
      return new Map();
    case 'explode':
      return layout.by === 'storey'
        ? storeyExplodeOffsets(model, layout.strength, placements)
        : categoryExplodeOffsets(model, layout.strength, placements);
    case 'grid':
      return gridOffsets(model, layout.keys, layout.spacing, layout.columns, placements);
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
    const at = (row - (table.groupStart[group] ?? 0)) * transformFloats + translationAt;
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
      const offsets = layoutOffsets(host.model, layout, host.placements);
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
