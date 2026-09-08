// What the sidebar shows: the layout in force and every parameter it carries.
//
// The layouts slice keeps parameters, never positions, so this sheet reports what was asked for and
// how it is computed rather than a number nobody chose. `layouts.grid` reads a spacing or a column
// count of zero as "render decides", so this sheet says so with the reason instead of printing zero.

import { layoutsSlice, type ExplodeBy, type Layout } from '@bim-open-toolkit/features';
import type { Session } from '@bim-open-toolkit/model';
import {
  knownNumber,
  knownValue,
  missingValue,
  propertyGroup,
  propertyRow,
  propertySheet,
  type PropertyRow,
  type PropertySheet,
} from '@bim-open-toolkit/ui-gratify';

const byTitles: Readonly<Record<ExplodeBy, string>> = { storey: 'Storey', category: 'Category' };

// How the offsets of one kind of explode are computed, in the words `layouts.ts` computes them by.
const byComputation: Readonly<Record<ExplodeBy, string>> = {
  storey: 'One average storey height per storey, per unit of strength.',
  category: "The model's ground radius per unit of strength, categories taken in name order.",
};

const layoutKindTitles: Readonly<Record<Layout['kind'], string>> = {
  none: 'None',
  explode: 'Explode',
  grid: 'Grid',
};

// The rows for an explode: which separator, how strong, and how that turns into an offset.
const explodeRows = (by: ExplodeBy, strength: number): readonly PropertyRow[] => [
  propertyRow('by', 'Separates by', knownValue(byTitles[by])),
  propertyRow('strength', 'Strength', knownNumber(strength)),
  propertyRow('computed', 'How the offset is found', knownValue(byComputation[by])),
];

// The rows for a grid: spacing and columns, honest about what zero means for each.
const gridRows = (spacing: number, columns: number, keys: readonly string[]): readonly PropertyRow[] => [
  propertyRow(
    'spacing',
    'Spacing',
    spacing === 0 ? missingValue("render chooses a spacing from the model's own footprint") : knownNumber(spacing, 'm'),
  ),
  propertyRow(
    'columns',
    'Columns',
    columns === 0
      ? missingValue('render chooses as square an arrangement as the count allows')
      : knownNumber(columns, undefined, 0),
  ),
  propertyRow('objects', 'Objects arranged', knownValue(keys.length === 0 ? 'Every object' : String(keys.length))),
];

const layoutRows = (layout: Layout): readonly PropertyRow[] => {
  const kind = propertyRow('kind', 'Layout', knownValue(layoutKindTitles[layout.kind]));
  switch (layout.kind) {
    case 'none':
      return [kind];
    case 'explode':
      return [kind, ...explodeRows(layout.by, layout.strength)];
    case 'grid':
      return [kind, ...gridRows(layout.spacing, layout.columns, layout.keys)];
  }
};

// The explode-and-grid sheet: the layout in force and its parameters.
export const explodeSheet = (session: Session): PropertySheet => {
  const { layout } = session.read(layoutsSlice);
  return propertySheet(
    'Explode and grid',
    [propertyGroup('layout', 'Layout', layoutRows(layout))],
    "A layout is parameters only; it never rewrites an object's own transform.",
  );
};
