// The three colourings this demo can apply, each built once from one table so its rules and its
// legend can never disagree.
//
// Two of them read a string column - the category the model records and the storey an object hangs
// under - and one reads a fact, the nominal width of a door. The fact is the interesting one,
// because a width can be recorded, absent, or reported differently by two sources, and those are
// three different answers. A door whose sources disagree is left out of the ramp and given its own
// colour, so the count against "no width recorded" means what it says.
//
// The colours here are analytical: they carry meaning and never change with the gallery theme.

import {
  categoryStyling,
  numericStyling,
  type CategoryPalette,
  type Legend,
  type LegendEntry,
  type NumericScale,
} from '@bim-open-toolkit/features';
import {
  diagnostic,
  failure,
  filterRows,
  stringAt,
  stringColumnOf,
  styleRule,
  success,
  type Color,
  type ObjectKey,
  type Result,
  type StyleRule,
  type Table,
} from '@bim-open-toolkit/model';
import {
  hideWallsRule,
  objectTable,
  type CommandCall,
  type InspectIndex,
} from '../point-and-read/building.js';

// Which column the building is coloured by.
export type ColourColumnId = 'category' | 'storey' | 'doorWidth';

// The columns the picker offers, in the order it lists them.
export const colourColumns: readonly { readonly id: ColourColumnId; readonly title: string }[] = [
  { id: 'category', title: 'Category' },
  { id: 'storey', title: 'Storey' },
  { id: 'doorWidth', title: 'Door width' },
];

// The colour a value nobody recorded gets. Grey is not a low value on a scale; it is no answer.
export const missingColour: Color = [0.55, 0.55, 0.55];

// The colour a value whose sources disagree gets. It is neither of the readings.
export const conflictingColour: Color = [0.85, 0.2, 0.65];

// The ends of the door-width ramp.
export const widthLow: Color = [0.9, 0.93, 0.7];
export const widthHigh: Color = [0.1, 0.35, 0.55];

// The colours the category swatches take, in the order the categories are found.
const categoryColours: readonly Color[] = [
  [0.6, 0.45, 0.7],
  [0.55, 0.55, 0.58],
  [0.72, 0.7, 0.66],
  [0.3, 0.55, 0.75],
  [0.8, 0.45, 0.15],
  [0.45, 0.7, 0.85],
];

// The colours the storey swatches take.
const storeyColours: readonly Color[] = [
  [0.2, 0.4, 0.7],
  [0.85, 0.55, 0.15],
  [0.35, 0.6, 0.35],
];

// The legend the disputed doors are listed under, which is what tells a class row it is a conflict.
export const conflictingLegendId = 'colour-by/conflicting';

// The name a colouring's rules and legend are held under.
export const legendIdOf = (column: ColourColumnId): string => `colour-by/${column}`;

// What one colouring is: the rules that apply it, the legends that explain it, and whether the
// walls have to go so the objects it colours can be seen.
export type Colouring = {
  readonly column: ColourColumnId;
  readonly title: string;
  readonly hideWalls: boolean;
  readonly rules: readonly StyleRule[];
  readonly legends: readonly Legend[];
};

// The distinct values of a string column, in the order they first appear, with the empty value left
// out: nothing recorded is not a class.
export const distinctValues = (source: Table, name: string): readonly string[] => {
  const column = stringColumnOf(source, name);
  if (column === undefined) return [];
  const found: string[] = [];
  for (let row = 0; row < source.rowCount; row += 1) {
    const value = stringAt(column, row);
    if (value !== undefined && value !== '' && !found.includes(value)) found.push(value);
  }
  return found;
};

const paletteOf = (values: readonly string[], colours: readonly Color[], title: string, absent: string): CategoryPalette => ({
  title,
  entries: values.map((value, index) => ({
    value,
    label: value,
    color: colours[index % colours.length] ?? missingColour,
  })),
  missing: { value: '', label: absent, color: missingColour },
});

const widthScale: NumericScale = {
  title: 'Door nominal width',
  min: 700,
  max: 1050,
  low: widthLow,
  high: widthHigh,
  bands: 4,
  missing: { value: '', label: 'No width recorded', color: missingColour },
};

// The doors whose two sources report different nominal widths. They are left out of the ramp, so
// the ramp's missing count is doors nobody measured and nothing else.
export const disputedWidthDoors = (index: InspectIndex): readonly ObjectKey[] =>
  index.keys.filter((key) => index.facts.get(key)?.get('nominalWidth')?.observation.kind === 'conflicting');

// One swatch for the disputed doors, and the legend that names it.
const disputedStyling = (index: InspectIndex): { readonly rule: StyleRule; readonly legend: Legend } => {
  const entry: LegendEntry = { value: 'conflicting', label: 'Sources disagree', color: conflictingColour };
  return {
    rule: styleRule(`${conflictingLegendId}/conflicting`, entry.label, disputedWidthDoors(index), { color: conflictingColour }, 5),
    legend: {
      kind: 'category',
      id: conflictingLegendId,
      title: 'Disputed',
      entries: [entry],
      missing: { value: '', label: 'Not disputed', color: missingColour },
    },
  };
};

const categoryColouring = (index: InspectIndex, column: 'category' | 'storey'): Result<Colouring> => {
  const source = objectTable(index);
  const values = distinctValues(source, column);
  const palette = paletteOf(
    values,
    column === 'category' ? categoryColours : storeyColours,
    column === 'category' ? 'Category' : 'Storey',
    column === 'category' ? 'No category recorded' : 'No storey link recorded',
  );
  const styled = categoryStyling(legendIdOf(column), source, 'key', column, palette);
  if (!styled.ok) return failure(styled.diagnostics);
  return success({
    column,
    title: palette.title,
    hideWalls: false,
    rules: styled.value.rules,
    legends: [styled.value.legend],
  });
};

const widthColouring = (index: InspectIndex): Result<Colouring> => {
  const disputed = new Set(disputedWidthDoors(index));
  const source = objectTable(index);
  const keys = stringColumnOf(source, 'key');
  const categories = stringColumnOf(source, 'category');
  if (keys === undefined || categories === undefined)
    return failure([
      diagnostic('colour-by/missing-column', 'The object table needs a "key" and a "category" column.', ['columns']),
    ]);
  const doors = filterRows(
    source,
    (row) => stringAt(categories, row) === 'Door' && !disputed.has(stringAt(keys, row) ?? ''),
  );
  const styled = numericStyling(legendIdOf('doorWidth'), doors, 'key', 'nominalWidthMm', widthScale);
  if (!styled.ok) return failure(styled.diagnostics);
  const marked = disputedStyling(index);
  return success({
    column: 'doorWidth',
    title: widthScale.title,
    hideWalls: true,
    rules: [...styled.value.rules, marked.rule],
    legends: [styled.value.legend, marked.legend],
  });
};

// The colouring for one column, built from the building's own table.
export const colouringOf = (index: InspectIndex, column: ColourColumnId): Result<Colouring> =>
  column === 'doorWidth' ? widthColouring(index) : categoryColouring(index, column);

// What applying a colouring dispatches: everything already applied is removed first, so switching
// column leaves nothing of the previous one behind.
export const colouringCalls = (index: InspectIndex, colouring: Colouring): readonly CommandCall[] => [
  { command: 'appearance.clear', input: {} },
  ...colouring.legends.map((legend) => ({
    command: 'appearance.addRules',
    input: {
      rules: colouring.rules.filter((rule) => rule.id.startsWith(`${legend.id}/`)),
      legend,
    },
  })),
  ...(colouring.hideWalls
    ? [{ command: 'appearance.addRules', input: { rules: [hideWallsRule(index)] } }]
    : []),
];

// What the demo undoes when it is disposed.
export const resetCalls = (): readonly CommandCall[] => [
  { command: 'appearance.clear', input: {} },
  { command: 'sets.clear', input: {} },
];
