// What the sidebar shows: what the open model offers a layout, the layout in force, every parameter
// it carries, and how many objects that layout actually moves.
//
// The layouts slice keeps parameters, never positions, so this sheet reports what was asked for and
// how it is computed rather than a number nobody chose. `layouts.grid` reads a spacing or a column
// count of zero as "render decides", so this sheet says so with the reason instead of printing zero.
//
// The counts come from `survey.ts`, which took them off the model the demo opened. A strength of two
// on a model with no storeys still moves nothing, and this sheet is where that is stated in full.

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
import { heldSurvey, layoutCaveat, movedBy, type ExplodeSurvey } from './survey.js';

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

// What the layout in force does to the model that is open, counted rather than assumed. Zero moved
// is a measurement, so it is printed as the number it is and the reason is given beside it.
const movedRows = (layout: Layout, survey: ExplodeSurvey | undefined): readonly PropertyRow[] => {
  if (survey === undefined)
    return [propertyRow('moved', 'Objects moved', missingValue('no model is open to move'))];
  const caveat = layoutCaveat(survey, layout);
  return [
    propertyRow('moved', 'Objects moved', knownNumber(movedBy(survey, layout), undefined, 0)),
    ...(caveat === undefined ? [] : [propertyRow('caveat', 'What that means on this model', knownValue(caveat))]),
  ];
};

const layoutRows = (layout: Layout, survey: ExplodeSurvey | undefined): readonly PropertyRow[] => {
  const kind = propertyRow('kind', 'Layout', knownValue(layoutKindTitles[layout.kind]));
  switch (layout.kind) {
    case 'none':
      return [kind];
    case 'explode':
      return [kind, ...explodeRows(layout.by, layout.strength), ...movedRows(layout, survey)];
    case 'grid':
      return [kind, ...gridRows(layout.spacing, layout.columns, layout.keys), ...movedRows(layout, survey)];
  }
};

// What the open model gives a layout to work with. A count of zero storeys or one placement is a
// fact about the model, and it is the fact that decides whether an explode can separate anything.
const modelRows = (survey: ExplodeSurvey | undefined): readonly PropertyRow[] =>
  survey === undefined
    ? [propertyRow('objects', 'Objects', missingValue('no model is open, so nothing has been surveyed'))]
    : [
        propertyRow('objects', 'Objects', knownNumber(survey.objects, undefined, 0)),
        propertyRow('storeys', 'Storeys recorded', knownNumber(survey.storeys, undefined, 0)),
        propertyRow('categories', 'Categories recorded', knownNumber(survey.categories, undefined, 0)),
        propertyRow('placements', 'Distinct placements', knownNumber(survey.placements, undefined, 0)),
      ];

// The explode-and-grid sheet: what the open model offers, then the layout in force and what it did.
export const explodeSheet = (session: Session): PropertySheet => {
  const { layout } = session.read(layoutsSlice);
  const survey = heldSurvey();
  return propertySheet(
    'Explode and grid',
    [
      propertyGroup('model', 'What the model offers', modelRows(survey)),
      propertyGroup('layout', 'Layout', layoutRows(layout, survey)),
    ],
    "A layout is parameters only; it never rewrites an object's own transform.",
  );
};
