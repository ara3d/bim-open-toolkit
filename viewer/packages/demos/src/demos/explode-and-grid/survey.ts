// What the open model lets a layout do, measured on the model itself rather than assumed.
//
// A layout is computed from `ObjectRecord.transform`: `placementsOf` reads each object's own
// translation, storeys come from objects in a storey category, and the category fan comes from the
// category each object records. A model that carries none of those has nothing for a layout to
// separate, and the demo has to say so rather than open on a slider that moves nothing. So the
// opening move is chosen from a measurement, and the same measurement is what the bar, the
// inspector and the report quote.
//
// The survey is taken once, when the demo starts, and held: `ready`, `report` and the inspector are
// given a session and never the model, and the inspector runs after every change event, which is
// not the place to walk twenty-five thousand objects again. `point-and-read` holds its index for the
// same reason.

import {
  categoryExplodeOffsets,
  levelsOf,
  placementsOf,
  storeyExplodeOffsets,
  type ExplodeBy,
  type Layout,
} from '@bim-open-toolkit/features';
import type { ModelData, ObjectKey, Vec3 } from '@bim-open-toolkit/model';

// What the open model offers a layout. Every field is a count taken off the model.
export type ExplodeSurvey = {
  readonly objects: number;
  // Objects recorded in a storey category, which is what a storey explode separates.
  readonly storeys: number;
  // Distinct non-empty categories, which is what a category explode fans out.
  readonly categories: number;
  // Distinct object placements. One means every object's transform puts it at the same point, and
  // then no layout computed from placements can tell any two objects apart.
  readonly placements: number;
  readonly movedByStorey: number;
  readonly movedByCategory: number;
};

// What an opening move asks for.
export type Opening = { readonly by: ExplodeBy; readonly strength: number };

// A third of the gap between floors per floor: enough to read as separated, not enough to lose the
// shape of the building.
export const storeyOpening: Opening = { by: 'storey', strength: 0.35 };

// Half the model's own ground radius per category: the categories clear each other without the
// outermost leaving the frame.
export const categoryOpening: Opening = { by: 'category', strength: 0.5 };

// The strength the survey counts at. Strength scales an explode's offsets and never changes which
// objects get one, so any strength above zero counts the same objects.
const measuringStrength = 1;

const moves = (offsets: ReadonlyMap<ObjectKey, Vec3>): number =>
  [...offsets.values()].filter((offset) => offset[0] !== 0 || offset[1] !== 0 || offset[2] !== 0).length;

const namedCategories = (model: ModelData): ReadonlySet<string> =>
  new Set(model.objects.map((record) => (record.category ?? '').trim()).filter((name) => name !== ''));

const distinctPlacements = (model: ModelData): number =>
  new Set(placementsOf(model).map((placement) => placement.center.join(','))).size;

// What the model offers, measured by running the offset computations the layouts feature would run.
export const surveyExplode = (model: ModelData): ExplodeSurvey => ({
  objects: model.objects.length,
  storeys: levelsOf(model).length,
  categories: namedCategories(model).size,
  placements: distinctPlacements(model),
  movedByStorey: moves(storeyExplodeOffsets(model, measuringStrength)),
  movedByCategory: moves(categoryExplodeOffsets(model, measuringStrength)),
});

// The opening move: by storey when the model has storeys to separate, by category when it has only
// categories, and by storey when it has neither, because that is the demo's headline and the report
// then says why nothing moved instead of quietly choosing a second thing that also moves nothing.
export const openingExplode = (survey: ExplodeSurvey): Opening =>
  survey.movedByStorey === 0 && survey.movedByCategory > 0 ? categoryOpening : storeyOpening;

// How many objects a layout gives an offset to. An explode offsets the objects it can separate; a
// grid offsets every object it names, which with no keys is all of them.
export const movedBy = (survey: ExplodeSurvey | undefined, layout: Layout): number => {
  if (survey === undefined) return 0;
  switch (layout.kind) {
    case 'none':
      return 0;
    case 'explode':
      return layout.strength === 0 ? 0 : layout.by === 'storey' ? survey.movedByStorey : survey.movedByCategory;
    case 'grid':
      return layout.keys.length === 0 ? survey.objects : layout.keys.length;
  }
};

// Why an explode moved nothing, or undefined when it moved something. Identical placements come
// first because that one defeats every layout, not just the separator that was asked for.
export const unmovedReason = (survey: ExplodeSurvey, by: ExplodeBy): string | undefined => {
  if ((by === 'storey' ? survey.movedByStorey : survey.movedByCategory) > 0) return undefined;
  if (survey.placements < 2)
    return `All ${survey.objects} objects carry the same placement, so nothing computed from placements can separate them.`;
  return by === 'storey'
    ? `The model records ${survey.storeys} storeys, and separating storeys needs at least two.`
    : `The model records ${survey.categories} categories, and fanning categories needs at least two.`;
};

// What the model does to the layout in force, or undefined when it does nothing to it. An explode
// that separates nothing and a grid whose placements are all one point are the two ways a model
// defeats a layout computed from placements, and both are the model's doing, not the demo's.
export const layoutCaveat = (survey: ExplodeSurvey, layout: Layout): string | undefined => {
  if (layout.kind === 'explode') return unmovedReason(survey, layout.by);
  if (layout.kind === 'grid' && survey.placements < 2)
    return `All ${survey.objects} objects carry the same placement, so a grid computed from placements arranges them in the order the file lists them rather than by where they are.`;
  return undefined;
};

let held: ExplodeSurvey | undefined;

// The survey of the model the demo has open, or undefined before it starts and after it is disposed.
export const heldSurvey = (): ExplodeSurvey | undefined => held;

// Holds what `start` surveyed, so the session-only functions can quote it. Undefined releases it.
export const holdSurvey = (survey: ExplodeSurvey | undefined): void => {
  held = survey;
};
