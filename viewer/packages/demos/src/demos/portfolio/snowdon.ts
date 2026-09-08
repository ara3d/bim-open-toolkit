// Snowdon Towers as this demo's second fixture, and the reading of what an opened model actually
// carries.
//
// The drill-through consumes three things: buildings to roll up to, source documents that report
// figures, and the figures themselves. Snowdon Towers carries none of the three in a form this
// demo can reach, so it is offered beside the generated estate rather than in place of it, and
// opening it turns the demo into a statement of what the file holds and what it does not. That is
// the gallery's rule read literally: Snowdon is an opt-in path where a projection exists, and for a
// portfolio roll-up no projection exists.
//
// What is missing, exactly, and why:
//   - No building and no site. The file declares levels, areas, rooms and spaces; nothing in it is
//     a building, and a block name read out of a level label would be an inference, not a record.
//   - No document attribution. The file's entity table names which of its seven source documents
//     each object came from, and `@bim-open-toolkit/formats` does not carry that field on an
//     `ObjectRecord`, so nothing here can read it.
//   - No reported figure. Quantities - `Area` in square feet among them - live in the BOS parameter
//     tables, which the loader never decodes and `LoadedModel` never exposes.
// Each of those is a request to the formats track, not a gap to fill in here.
//
// The file is the one `_shared/snowdon.ts` names, which is the BIM export: the plain export carries
// no BOS tables at all, so every one of its objects loads unnamed and uncategorised, and a demo
// about attribution would have nothing to read off it. The title differs from the shared fixture's
// because here it is a second entry beside the estate and has to say which of the two it is.

import type { ObjectRecord } from '@bim-open-toolkit/model';
import { success, type Result } from '@bim-open-toolkit/model';
import type { DemoFixture, ModelSource, OpenedModel } from '../../gallery/contracts.js';
import { snowdonFile, snowdonUrl } from '../_shared/snowdon.js';

// Re-exported so a test can name the file this demo reads without reaching past it.
export { snowdonFile };


// What the picker calls it. The demo names its own fixtures, so a sheet can say which one it reads.
export const snowdonTitle = 'Snowdon Towers, the BIM export';

// One category of a model and how many records name it, so the sheet can show what the file is
// made of without claiming what any of it measures.
export type CategoryCount = { readonly name: string; readonly count: number };

// What an opened model says about itself. Every number here is a count of records carrying a field,
// read straight off the object records: nothing is derived, joined or guessed.
export type ModelReading = {
  readonly modelId: string;
  // Where the loader says the model came from, which for a fixture is the url it was fetched from.
  readonly origin: string;
  readonly objects: number;
  readonly named: number;
  readonly categorised: number;
  // Records carrying the source system's own id for the object.
  readonly identified: number;
  readonly drawn: number;
  readonly categories: readonly CategoryCount[];
};

const countBy = (records: readonly ObjectRecord[], has: (record: ObjectRecord) => boolean): number =>
  records.reduce((total, record) => (has(record) ? total + 1 : total), 0);

// Every category the records name with how many name it, largest first. Records carrying no
// category are counted under their own row rather than folded into another, because "no category"
// is a fact about the file and not a category it declares.
export const categoryCounts = (records: readonly ObjectRecord[]): readonly CategoryCount[] => {
  const counts = new Map<string, number>();
  for (const record of records) {
    const name = record.category ?? 'No category';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]): CategoryCount => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
};

// What one opened model carries.
export const readingOf = (model: OpenedModel): ModelReading => ({
  modelId: model.modelId,
  origin: model.data.ref.id,
  objects: model.data.objects.length,
  named: countBy(model.data.objects, (record) => record.name !== undefined),
  categorised: countBy(model.data.objects, (record) => record.category !== undefined),
  identified: countBy(model.data.objects, (record) => record.sourceId !== undefined),
  drawn: countBy(model.data.objects, (record) => record.representation !== undefined),
  categories: categoryCounts(model.data.objects),
});

// What the demo is looking at: the estate it generated, which the workflow can be run over, or a
// model it did not generate, which it can only report on.
export type Subject =
  | { readonly kind: 'estate' }
  | { readonly kind: 'source'; readonly title: string; readonly reading: ModelReading };

// The estate, which is what the demo shows when nothing else is open.
export const estateSubject: Subject = { kind: 'estate' };

// Which of the two a viewer has open. The estate is named by the id it was generated under, so any
// other model is one the demo did not make and must not paint the estate's figures over.
export const subjectOf = (estateModelId: string, opened: readonly OpenedModel[]): Subject => {
  const foreign = opened.find((model) => model.modelId !== estateModelId);
  if (foreign === undefined) return estateSubject;
  const reading = readingOf(foreign);
  return {
    kind: 'source',
    title: foreign.modelId === snowdonFixture.id ? snowdonTitle : reading.origin,
    reading,
  };
};

// Snowdon Towers, as a fixture. Source-backed: everything the demo says about it was read out of
// the file. It is fetched by name from the dev server, so a machine without the model gets a 404
// the gallery reports rather than a demo that quietly shows something else.
export const snowdonFixture: DemoFixture = {
  id: 'snowdon',
  title: snowdonTitle,
  basis: 'source-backed',
  source: (): Promise<Result<ModelSource>> =>
    Promise.resolve(success({ kind: 'url', id: 'snowdon', url: snowdonUrl })),
};

// Which subject the demo is on, held for the life of the mount.
//
// `start` is the one place the contract says a demo may read what was opened; `ready`, `report`,
// the inspector and a panel's sync are all handed a `Session`, and a session does not say which
// model is behind it. So `start` records what it saw here and the rest read it back. `resetLook`
// puts it back, so a page that swaps fixtures does not carry the last one's answer into the next.
let looking: Subject = estateSubject;

// The subject the demo is on.
export const currentSubject = (): Subject => looking;

// Says which subject the demo is on. `start` calls it; a test calls it to drive either path.
export const lookAt = (subject: Subject): void => {
  looking = subject;
};

// Back to the estate, which is what the demo shows before anything has been opened.
export const resetLook = (): void => {
  looking = estateSubject;
};
