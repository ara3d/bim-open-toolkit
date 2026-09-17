// Snowdon Towers as this demo's second fixture, the reading of what an opened model carries, and
// which of the two the demo is looking at.
//
// This fixture used to be a statement of absence. The drill-through consumes buildings, the source
// documents that report figures about them, and the figures themselves, and none of the three could
// be read out of the file: an `ObjectRecord` carried no quantity and no document, so opening
// Snowdon showed what the file held and said the roll-up could not be run. The loader has since
// been extended - `@bim-open-toolkit/formats` decodes the BOS parameter tables and the document
// each object came from, and the gallery asks for both - so that is no longer true and this fixture
// now runs a real roll-up over real figures. `recorded.ts` states exactly which question it answers
// and why that is not the estate's question.
//
// What is still true is that the estate stays the default. It is the fixture that answers the
// demo's own question - which building is the outlier - because it is the one with more than one
// building, and it is the only one carrying the case the workflow exists for: a source document
// that names no building, or several. Snowdon has neither; every one of its objects names exactly
// one of its seven documents, so nothing about it is ambiguous in that way. The two fixtures answer
// two different questions and each says which.
//
// The file is the one `_shared/snowdon.ts` names, which is the BIM export: the plain export carries
// no BOS tables at all, so every one of its objects loads unnamed and uncategorised and there would
// be no parameter table to roll up. The title differs from the shared fixture's because here it is
// a second entry beside the estate and has to say which of the two it is.

import type { ObjectRecord } from '@bim-open-toolkit/model';
import { success, type Result } from '@bim-open-toolkit/model';
import type { DemoFixture, ModelSource, OpenedModel } from '../../gallery/contracts.js';
import { snowdonFile, snowdonUrl } from '../_shared/snowdon.js';
import { rollupOf, type RecordedRollup } from './recorded.js';

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

// What the demo is looking at: the estate it generated, which the estate workflow is run over, or a
// model it did not generate, which it reads and rolls up by source document. `rollup` is absent when
// the file carried no parameter table and no document table, and that absence is what the sheet
// reports instead of a roll-up - it is never stood in for with zeros.
export type Subject =
  | { readonly kind: 'estate' }
  | {
      readonly kind: 'source';
      readonly title: string;
      readonly reading: ModelReading;
      readonly rollup: RecordedRollup | undefined;
    };

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
    rollup: rollupOf(foreign),
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

// The source document the reader has drilled into, by the index the file records, or nothing.
//
// Nothing rather than -1, because -1 is a document index the roll-up uses: it is the group the
// objects the file attributes to no document are listed under, and that group is drillable like any
// other. A sentinel that is also a value is how a group stops being reachable.
//
// The estate says which building is drilled into by what the session has isolated, because a
// building is one object. A source document is tens of thousands of them, and reading a document
// back out of an isolation of 21,652 keys would be a scan per frame, so the drill is recorded here
// beside the subject it belongs to and the isolation is what it puts on the screen.
let drilled: number | undefined;

// The subject the demo is on.
export const currentSubject = (): Subject => looking;

// Says which subject the demo is on. `start` calls it; a test calls it to drive either path.
export const lookAt = (subject: Subject): void => {
  looking = subject;
  drilled = undefined;
};

// The source document being drilled into, or nothing when the whole model is shown.
export const drilledDocument = (): number | undefined => drilled;

// Says which source document is being drilled into. Nothing goes back to the whole model.
export const drillDocument = (index: number | undefined): void => {
  drilled = index;
};

// Back to the estate, which is what the demo shows before anything has been opened.
export const resetLook = (): void => {
  looking = estateSubject;
  drilled = undefined;
};
