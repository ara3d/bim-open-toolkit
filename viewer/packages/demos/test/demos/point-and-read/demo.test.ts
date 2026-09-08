// Point and read, through a session that records what the demo dispatched and a headless Gratify
// runtime that draws the tag. No browser and no renderer: everything asserted here is a function of
// the model the demo is reading and the session.
//
// The demo opens Snowdon Towers by default and the generated building second. The real file is a
// hundred megabytes and private, so it is not in the repository: everything that does not need it is
// asserted on the generated building, and the one block that does is skipped, with its reason in the
// block's name, on a machine that does not have the file.

import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Runtime } from 'gratify';
import { appearanceCommands, appearanceSlice, editsCommands, setsCommands, setsSlice } from '@bim-open-toolkit/features';
import { loadModel, type ModelProperties } from '@bim-open-toolkit/formats';
import type { ModelData, ObjectKey, Observation } from '@bim-open-toolkit/model';
import { sheetCoverage, type PropertySheet } from '@bim-open-toolkit/ui-gratify';
import type { ObjectHit } from '@bim-open-toolkit/render';
import { snowdonFile } from '../../../src/demos/_shared/snowdon.js';
import {
  documentOf,
  factsOf,
  hideWallsRuleId,
  inspectIndex,
  inspectIndexOf,
  objectTable,
  propertiesOf,
  propertyCountOf,
  runCalls,
  storeyOfObject,
  syntheticIndex,
  useInspectIndex,
  wallKeys,
  type InspectIndex,
} from '../../../src/demos/point-and-read/building.js';
import {
  identityRows,
  numberText,
  pointAndReadSheet,
  propertyGroupsOf,
  readingValue,
} from '../../../src/demos/point-and-read/inspector.js';
import { documentsFixture, propertiesFixture } from './properties-fixture.js';
import { emptyTag, tagHudPanel, tagOf, tagSpec } from '../../../src/demos/point-and-read/panels.js';
import {
  hoverCalls,
  isPinned,
  openingCalls,
  pinCalls,
  pinnedSetId,
  resetCalls,
  shownKey,
} from '../../../src/demos/point-and-read/pinning.js';
import { demo, pointAndReadReady, pointAndReadReport } from '../../../src/demos/point-and-read/index.js';
import { commandNames, recordingSession, type RecordingSession } from './fake-session.js';

// What the demo's `start` does with what the viewer opened, which a test with no viewer does itself.
beforeEach(() => {
  useInspectIndex(syntheticIndex());
});

const session = (): RecordingSession => recordingSession([...editsCommands, ...setsCommands, ...appearanceCommands]);

const hitOn = (key: ObjectKey): ObjectHit => ({
  key,
  object: 0,
  row: 0,
  point: [0, 0, 0],
  distance: 1,
  source: 'instances',
});

// The first door whose fire rating is in the given state, so the test names no generated id.
const doorRated = (kind: Observation['kind']): ObjectKey => {
  const index = inspectIndex();
  const found = index.keys.find((key) => index.facts.get(key)?.get('fireRating')?.observation.kind === kind);
  if (found === undefined) throw new Error(`the building has no door whose fire rating is ${kind}`);
  return found;
};

const rowValue = (
  sheet: ReturnType<typeof pointAndReadSheet>,
  group: string,
  key: string,
): { readonly state: string; readonly text: string; readonly reason: string | undefined; readonly evidence: number } => {
  const row = sheet.groups.find((item) => item.id === group)?.rows.find((item) => item.key === key);
  if (row === undefined) throw new Error(`the sheet has no row "${key}" in group "${group}"`);
  return {
    state: row.value.state,
    text: row.value.text,
    reason: row.value.missingReason,
    evidence: row.value.evidence?.length ?? 0,
  };
};

// A property row by the label the file gives it, wherever in the sheet it sits. Property rows are
// keyed by the object's own row number, so a test names the property rather than the number.
const labelled = (sheet: PropertySheet, label: string) => {
  const found = sheet.groups.flatMap((group) => group.rows.map((row) => ({ group, row }))).find((each) => each.row.label === label);
  if (found === undefined) throw new Error(`the sheet has no row labelled "${label}"`);
  return found;
};

// The generated model with every parent link taken out, so nothing but a recorded level can say
// which storey an object sits on. That is the shape a Revit export arrives in.
const withoutParents = (model: ModelData): ModelData => ({
  ...model,
  objects: model.objects.map((record) => {
    const { parentId: _dropped, ...rest } = record;
    return rest;
  }),
});

// The generated building with a parameter table hung on it, which is the shape the demo reads a real
// model in: object records and geometry from the file, properties in their own columns beside them.
const withProperties = (properties: ModelProperties, documents = documentsFixture([], [], [])): InspectIndex => {
  const base = syntheticIndex();
  return inspectIndexOf(base.model, base.geometry, { properties, documents });
};

describe('point-and-read opening', () => {
  it('hides the walls so the doors inside them can be seen', () => {
    const held = session();
    expect(pointAndReadReady(held)).toBe(false);
    expect(runCalls(held, openingCalls()).ok).toBe(true);
    expect(commandNames(held)).toEqual(['appearance.addRules']);
    const rule = held.read(appearanceSlice).rules.find((item) => item.id === hideWallsRuleId);
    expect(rule?.targets.length).toBe(wallKeys(inspectIndex()).length);
    expect(rule?.change.visible).toBe(false);
    expect(pointAndReadReady(held)).toBe(true);
  });

  it('puts everything back when the demo is disposed', () => {
    const held = session();
    runCalls(held, openingCalls());
    runCalls(held, pinCalls(hitOn(doorRated('known'))));
    expect(runCalls(held, resetCalls()).ok).toBe(true);
    expect(pointAndReadReady(held)).toBe(false);
    expect(held.read(setsSlice).sets).toEqual([]);
    expect(held.read(setsSlice).selection).toEqual([]);
  });
});

describe('point-and-read pointing', () => {
  it('selects what is pointed at and empties the selection when nothing is', () => {
    const held = session();
    const door = doorRated('known');
    runCalls(held, hoverCalls(hitOn(door)));
    expect(shownKey(held)).toBe(door);
    expect(isPinned(held)).toBe(false);
    runCalls(held, hoverCalls(undefined));
    expect(shownKey(held)).toBeUndefined();
  });

  it('keeps showing the pinned object while the pointer moves on', () => {
    const held = session();
    const pinned = doorRated('missing');
    const other = doorRated('known');
    runCalls(held, pinCalls(hitOn(pinned)));
    expect(held.read(setsSlice).sets.find((set) => set.id === pinnedSetId)?.members).toEqual([pinned]);
    runCalls(held, hoverCalls(hitOn(other)));
    expect(shownKey(held)).toBe(pinned);
    expect(isPinned(held)).toBe(true);
  });

  it('unpins when the click hits nothing', () => {
    const held = session();
    runCalls(held, pinCalls(hitOn(doorRated('known'))));
    runCalls(held, pinCalls(undefined));
    expect(isPinned(held)).toBe(false);
    expect(shownKey(held)).toBeUndefined();
  });
});

describe('point-and-read inspector', () => {
  it('says what it is looking at when nothing is pointed at', () => {
    const sheet = pointAndReadSheet(session());
    expect(sheet.title).toBe('Nothing pointed at');
    expect(sheet.groups).toEqual([]);
  });

  it('reports a recorded fire rating with the evidence for it', () => {
    const held = session();
    const door = doorRated('known');
    runCalls(held, pinCalls(hitOn(door)));
    const sheet = pointAndReadSheet(held);
    const rating = rowValue(sheet, 'facts', 'fireRating');
    expect(rating.state).toBe('known');
    expect(rating.text).not.toBe('');
    expect(rating.evidence).toBeGreaterThan(0);
    expect(rowValue(sheet, 'identity', 'category').text).toBe('Door');
    expect(sheet.subtitle).toContain('Pinned');
  });

  it('leaves a fire rating nobody recorded missing, with the reason the data gives', () => {
    const held = session();
    runCalls(held, pinCalls(hitOn(doorRated('missing'))));
    const rating = rowValue(pointAndReadSheet(held), 'facts', 'fireRating');
    expect(rating.state).toBe('missing');
    expect(rating.text).toBe('');
    expect(rating.reason).toMatch(/not (provided|applicable)/);
  });

  it('lists both readings when the sources disagree, and picks neither', () => {
    const held = session();
    const door = doorRated('conflicting');
    runCalls(held, pinCalls(hitOn(door)));
    const rating = rowValue(pointAndReadSheet(held), 'facts', 'fireRating');
    expect(rating.state).toBe('conflicting');
    expect(rating.text).toContain(' vs ');
    expect(rating.evidence).toBeGreaterThan(0);
  });

  it('counts one row per recorded fact plus the four identity rows', () => {
    const held = session();
    const door = doorRated('known');
    runCalls(held, pinCalls(hitOn(door)));
    const counts = sheetCoverage(pointAndReadSheet(held));
    expect(counts.known + counts.missing + counts.conflicting).toBe(4 + factsOf(inspectIndex(), door).length);
  });

  it('says an object with no storey link has none rather than guessing one', () => {
    const index = inspectIndex();
    const room = index.keys.find((key) => index.records.get(key)?.category === 'Room');
    const record = room === undefined ? undefined : index.records.get(room);
    expect(record).toBeDefined();
    if (record === undefined) return;
    const rows = identityRows(record, undefined);
    const storey = rows.find((item) => item.key === 'storey');
    expect(storey?.value.state).toBe('missing');
    expect(storey?.value.missingReason).toBe('no storey link recorded');
    expect(storey?.value.text).toBe('');
  });

  it('shows no source and no property groups for a model that records neither', () => {
    const held = session();
    runCalls(held, pinCalls(hitOn(doorRated('known'))));
    const sheet = pointAndReadSheet(held);
    expect(sheet.groups.map((group) => group.id)).toEqual(['identity', 'facts']);
    expect(sheet.groups.find((group) => group.id === 'facts')?.title).toBe('Facts');
    expect(sheet.subtitle).toBe('Pinned; click elsewhere to move the pin.');
  });
});

// What the sheet does with the parameter tables a BOS file records. The tables here are built by
// hand through the loader's own decoder, so nothing in this block needs the private model.
describe('point-and-read reading recorded properties', () => {
  // One object of the generated building carrying one property of every kind the tables hold,
  // including the three encodings that mean "recorded, with no value in it".
  const descriptors = [
    { name: 'Area', units: 'SQUARE_FEET', group: 'Dimensions', kind: 'number' },
    { name: 'Length', units: 'FEET_AND_FRACTIONAL_INCHES', group: 'Dimensions', kind: 'number' },
    { name: 'Comments', group: 'Identity Data', kind: 'string' },
    { name: 'Mark', group: 'Identity Data', kind: 'string' },
    { name: 'Base Constraint', group: 'Constraints', kind: 'entity' },
    { name: 'Image', group: 'Identity Data', kind: 'entity' },
    { name: 'Room Bounding', group: 'Constraints', kind: 'int' },
    { name: 'Rvt:Element:Bounds.Min', group: 'RevitAPI', kind: 'point' },
    { name: 'Category', group: 'Other', kind: 'entity' },
  ] as const;

  const sample = (object: number, level: number): ModelProperties =>
    propertiesFixture(
      150,
      [...descriptors],
      [
        { object, descriptor: 0, value: 0 },
        { object, descriptor: 1, value: 1 },
        { object, descriptor: 2, text: 'Fixed in place' },
        // A string the exporter pooled as the empty string: recorded, with nothing written in it.
        { object, descriptor: 3, value: 0 },
        { object, descriptor: 4, value: level },
        // The -1 an exporter writes for a property that references nothing.
        { object, descriptor: 5, value: -1 },
        { object, descriptor: 6, value: 1 },
        { object, descriptor: 7, value: 0 },
        { object, descriptor: 8, value: -1 },
      ],
      [465.61871337890625, 18.652475357055664],
      [[1.5, -2.25, 3]],
    );

  // The one property of the sample object recorded under the given name.
  const reading = (index: InspectIndex, object: number, name: string) => {
    const key = index.keys[object];
    const found = key === undefined ? undefined : propertiesOf(index, key).find((each) => each.name === name);
    if (found === undefined) throw new Error(`the fixture records no "${name}" on object ${object}`);
    return found;
  };

  it('prints a whole number whole and everything else to six significant figures', () => {
    expect(numberText(0)).toBe('0');
    expect(numberText(-3)).toBe('-3');
    expect(numberText(465.61871337890625)).toBe('465.619');
    expect(numberText(-0.0833333358168602)).toBe('-0.0833333');
  });

  it('keeps a quantity in the unit the file recorded it in, and converts nothing', () => {
    const index = withProperties(sample(4, 0));
    const area = reading(index, 4, 'Area');
    expect(area.units).toBe('SQUARE_FEET');
    expect(readingValue(index, area)).toMatchObject({
      kind: 'number',
      state: 'known',
      text: '465.619',
      unit: 'SQUARE_FEET',
    });
  });

  it('leaves a string the file recorded with nothing in it missing rather than blank', () => {
    const index = withProperties(sample(4, 0));
    const value = readingValue(index, reading(index, 4, 'Mark'));
    expect(value.state).toBe('missing');
    expect(value.text).toBe('');
    expect(value.missingReason).toBe('recorded, with no text written in it');
  });

  it('resolves an entity value to the object it names and keeps that object id as evidence', () => {
    const index = withProperties(sample(4, 0));
    const target = index.model.objects[0];
    if (target === undefined) return;
    const value = readingValue(index, reading(index, 4, 'Base Constraint'));
    expect(value.kind).toBe('reference');
    expect(value.state).toBe('known');
    expect(value.text).toBe(target.name ?? target.ref.objectId);
    // Never the row number the file holds.
    expect(value.text).not.toBe('0');
    expect(value.evidence?.[0]).toContain(target.ref.objectId);
  });

  it('says an entity value that references nothing is missing, and prints no row number for it', () => {
    const index = withProperties(sample(4, 0));
    const image = reading(index, 4, 'Image');
    expect(image.raw).toBe(-1);
    const value = readingValue(index, image);
    expect(value.state).toBe('missing');
    expect(value.text).toBe('');
    expect(value.missingReason).toBe('recorded as a reference to nothing');
  });

  it('prints a point in the coordinates the file records it in', () => {
    const index = withProperties(sample(4, 0));
    const point = reading(index, 4, 'Rvt:Element:Bounds.Min');
    expect(readingValue(index, point)).toMatchObject({ state: 'known', text: '1.5, -2.25, 3' });
  });

  it('groups the properties the way the file groups them, in the order the file records them', () => {
    const index = withProperties(sample(4, 0));
    const key = index.keys[4];
    if (key === undefined) return;
    const groups = propertyGroupsOf(index, key);
    expect(groups.map((group) => group.title)).toEqual([
      'Dimensions',
      'Identity Data',
      'Constraints',
      'RevitAPI',
      'Other',
    ]);
    expect(groups.map((group) => group.id)).toContain('props/identity-data');
    expect(groups.flatMap((group) => group.rows).length).toBe(9);
    // Every row keeps its own key even where the file records one name twice.
    const keys = groups.flatMap((group) => group.rows.map((row) => row.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('shows the source document an object came from, and the file it was exported from', () => {
    const base = syntheticIndex();
    const documents = documentsFixture(
      ['Snowdon Towers Sample Architectural', 'Snowdon Towers Sample Electrical'],
      ['C:/models/architectural.rvt', 'C:/models/electrical.rvt'],
      base.keys.map((_, object) => (object % 2 === 0 ? 1 : 0)),
    );
    const index = inspectIndexOf(base.model, base.geometry, { properties: sample(4, 0), documents });
    useInspectIndex(index);
    const key = index.keys[4];
    if (key === undefined) return;
    expect(documentOf(index, key)?.title).toBe('Snowdon Towers Sample Electrical');
    const held = session();
    runCalls(held, pinCalls(hitOn(key)));
    const sheet = pointAndReadSheet(held);
    expect(rowValue(sheet, 'source', 'document').text).toBe('Snowdon Towers Sample Electrical');
    expect(rowValue(sheet, 'source', 'documentPath').text).toBe('C:/models/electrical.rvt');
    expect(sheet.subtitle).toContain('9 properties in 5 groups');
  });

  it('reads the storey off the recorded level when no parent link says which one it is', () => {
    const base = syntheticIndex();
    const storey = base.storeys[1];
    const stripped = withoutParents(base.model);
    const object = stripped.objects.findIndex((record) => record.category === 'Door');
    const levelRow = stripped.objects.findIndex((record) => record.ref.objectId === storey?.objectId);
    if (storey === undefined || object < 0 || levelRow < 0) throw new Error('the generated building changed shape');
    const properties = propertiesFixture(
      stripped.objects.length,
      [{ name: 'Rvt:Element:Level', group: 'RevitAPI', kind: 'entity' }],
      [{ object, descriptor: 0, value: levelRow }],
    );
    const index = inspectIndexOf(stripped, base.geometry, { properties });
    const key = index.keys[object];
    if (key === undefined) return;
    expect(storeyOfObject(index, key)).toMatchObject({ name: storey.name, via: 'the level it records' });
    useInspectIndex(index);
    const held = session();
    runCalls(held, pinCalls(hitOn(key)));
    const row = rowValue(pointAndReadSheet(held), 'identity', 'storey');
    expect(row.state).toBe('known');
    expect(row.text).toBe(storey.name);
    expect(row.evidence).toBe(1);
    // An object the file says nothing about still reads as having no storey.
    const other = index.keys.find((each) => !index.storeyOf.has(each));
    expect(other).toBeDefined();
  });

  it('says the file records no observations when it carries properties but no facts', () => {
    const base = syntheticIndex();
    const index = inspectIndexOf(
      { ...base.model, ref: { id: 'loaded-from-a-file', revision: '1' } },
      base.geometry,
      { properties: sample(4, 0) },
    );
    useInspectIndex(index);
    expect(index.recorded).toEqual([]);
    const held = session();
    const key = index.keys[4];
    if (key === undefined) return;
    runCalls(held, pinCalls(hitOn(key)));
    const sheet = pointAndReadSheet(held);
    expect(sheet.groups.find((group) => group.id === 'facts')?.title).toBe('Facts: this file records no observations');
    expect(sheet.groups.find((group) => group.id === 'facts')?.rows).toEqual([]);
  });

  it('reports what it is showing, so the browser smoke records it', () => {
    const index = withProperties(sample(4, 0));
    useInspectIndex(index);
    const held = session();
    const key = index.keys[4];
    if (key === undefined) return;
    runCalls(held, pinCalls(hitOn(key)));
    const report = pointAndReadReport(held);
    expect(report['properties']).toBe(9);
    expect(report['propertiesDropped']).toBe(0);
    expect(report['shownProperties']).toBe(9);
    expect(report['shownPropertyGroups']).toBe(5);
    expect(report['shownQuantity']).toBe('Area 465.619 SQUARE_FEET');
  });
});

describe('point-and-read tag panel', () => {
  it('draws nothing until something is pointed at', () => {
    expect(tagOf(session())).toEqual(emptyTag);
  });

  it('names the pointed object and its place through a headless runtime', () => {
    const held = session();
    runCalls(held, hoverCalls(hitOn(doorRated('known'))));
    const doc = tagOf(held);
    const runtime = new Runtime(null, { ...tagSpec, init: doc }, { headless: true, width: 240, height: 120 });
    runtime.step(2);
    expect(doc.detail).toContain('Door');
    expect(doc.detail).toContain('Level');
    const notes = runtime.semanticsTree().filter((node) => node.role === 'note');
    expect(notes.map((node) => node.label)).toEqual([`${doc.name}: ${doc.detail}`]);
  });

  it('drops the pin when the tag is pressed', () => {
    const held = session();
    const door = doorRated('known');
    runCalls(held, pinCalls(hitOn(door)));
    const pinnedDoc = tagOf(held);
    expect(pinnedDoc.pinned).toBe(true);
    const runtime = new Runtime(null, { ...tagSpec, init: pinnedDoc }, { headless: true, width: 240, height: 120 });
    runtime.step(1);
    runtime.dispatch({ kind: 'unpin' });
    expect(runtime.doc.pinned).toBe(false);
    tagHudPanel.onCommit?.(runtime.doc, pinnedDoc, held);
    expect(isPinned(held)).toBe(false);
    expect(shownKey(held)).toBe(door);
  });

  it('brings what the session holds into the document', () => {
    const held = session();
    runCalls(held, pinCalls(hitOn(doorRated('known'))));
    expect(tagHudPanel.sync?.(held, emptyTag)).toEqual(tagOf(held));
  });
});

describe('point-and-read demo', () => {
  it('registers as an Inspect demo over the real model, the generated one behind it', () => {
    expect(demo.id).toBe('point-and-read');
    expect(demo.chapter).toBe('inspect');
    expect(demo.fixtures.map((fixture) => fixture.basis)).toEqual(['source-backed', 'synthetic']);
    expect(demo.panels.map((panel) => panel.id)).toEqual(['point-and-read/tag']);
  });

  it('asks for the real model by name, so a machine without it reports a missing file', async () => {
    const source = await demo.fixtures[0]?.source();
    expect(source?.ok).toBe(true);
    if (source === undefined || !source.ok) return;
    expect(source.value.kind).toBe('url');
  });

  it('opens the generated building as data already in memory', async () => {
    const source = await demo.fixtures[1]?.source();
    expect(source?.ok).toBe(true);
    if (source === undefined || !source.ok) return;
    expect(source.value.kind).toBe('data');
  });

  it('reports counts that add up to the facts the generator recorded', () => {
    const held = session();
    runCalls(held, openingCalls());
    const report = pointAndReadReport(held);
    const count = (name: string): number => {
      const value = report[name];
      return typeof value === 'number' ? value : Number.NaN;
    };
    expect(count('facts')).toBe(count('factsKnown') + count('factsMissing') + count('factsConflicting'));
    expect(count('wallsHidden')).toBe(wallKeys(inspectIndex()).length);
    expect(report['shown']).toBe('none');
    expect(count('objects')).toBe(objectTable(inspectIndex()).rowCount);
  });
});

// Where the gallery's dev server looks for the real model, and where this reads it from directly.
const snowdonPath = fileURLToPath(new URL(`../../../../visualization/artifacts/bfast/${snowdonFile}`, import.meta.url));

// The derivations over the real model, which is the fixture the demo opens by default. Everything
// asserted here is what the file itself carries; nothing is filled in for what it does not, and no
// number here is written down anywhere but in the file.
describe.skipIf(!existsSync(snowdonPath))(`point-and-read on the real model (needs ${snowdonFile}; skipped when it is not on this machine)`, () => {
  const openSnowdon = async (): Promise<InspectIndex> => {
    const loaded = await loadModel(new Uint8Array(readFileSync(snowdonPath)), { format: 'bfast', properties: true });
    if (!loaded.ok) throw new Error(loaded.diagnostics.map((one) => one.message).join('; '));
    return inspectIndexOf(loaded.value.data, loaded.value.geometry, {
      properties: loaded.value.properties,
      documents: loaded.value.documents,
    });
  };

  // The key the file holds this object id under, which is what a pick and a set speak.
  const keyOfObjectId = (index: InspectIndex, objectId: string): ObjectKey => {
    const found = index.keys.find((key) => index.records.get(key)?.ref.objectId === objectId);
    if (found === undefined) throw new Error(`the file holds no object ${objectId}`);
    return found;
  };

  it('reads the object records and the boxes out of the file', async () => {
    const index = await openSnowdon();
    expect(index.keys.length).toBe(index.model.objects.length);
    expect(index.keys.length).toBeGreaterThan(1000);

    // A BFAST carries no observations, so the demo has no facts to show and shows none.
    expect(index.recorded).toEqual([]);

    // Every object placed by the file gets a real box, which is what the tag anchors to.
    const drawn = index.keys.find((key) => index.records.get(key)?.representation !== undefined);
    expect(drawn).toBeDefined();
    if (drawn === undefined) return;
    const box = index.bounds.get(drawn);
    expect(box?.max[2]).toBeGreaterThan(box?.min[2] ?? 0);

    useInspectIndex(index);
    const held = session();
    expect(runCalls(held, openingCalls()).ok).toBe(true);
    expect(pointAndReadReady(held)).toBe(true);
    expect(wallKeys(index).length).toBeGreaterThan(0);
  }, 300_000);

  it('shows a picked wall its own properties, in its own groups, in the units the file recorded', async () => {
    const index = await openSnowdon();
    useInspectIndex(index);
    const wall = keyOfObjectId(index, 'bos:1165');
    expect(index.records.get(wall)?.category).toBe('Walls');
    const held = session();
    runCalls(held, pinCalls(hitOn(wall)));
    const sheet = pointAndReadSheet(held);

    // The identity the object records, and the file it came from.
    expect(rowValue(sheet, 'identity', 'objectId').text).toBe('bos:1165');
    expect(rowValue(sheet, 'identity', 'category').text).toBe('Walls');
    expect(rowValue(sheet, 'source', 'document').text).toBe('Snowdon Towers Sample Architectural');
    expect(rowValue(sheet, 'source', 'documentPath').state).toBe('known');

    // The quantity, in the unit the exporter wrote and with nothing converted.
    const area = labelled(sheet, 'Area');
    expect(area.group.title).toBe('Dimensions');
    expect(area.row.value).toMatchObject({ state: 'known', text: '465.619', unit: 'SQUARE_FEET' });
    expect(labelled(sheet, 'Volume').row.value).toMatchObject({ unit: 'CUBIC_FEET', state: 'known' });

    // The groups are the file's own, and there are more than a handful of them.
    const groups = sheet.groups.filter((group) => group.id.startsWith('props/'));
    expect(groups.map((group) => group.title)).toContain('Constraints');
    expect(groups.length).toBeGreaterThan(4);
    expect(groups.reduce((total, group) => total + group.rows.length, 0)).toBe(44);
    expect(sheet.subtitle).toContain('44 properties');
  }, 300_000);

  it('resolves a reference to the object it names and never prints a row number as a value', async () => {
    const index = await openSnowdon();
    useInspectIndex(index);
    const held = session();
    runCalls(held, pinCalls(hitOn(keyOfObjectId(index, 'bos:1165'))));
    const sheet = pointAndReadSheet(held);

    // `Base Constraint` names the level the wall stands on; it reads as that level, not as 1057.
    const base = labelled(sheet, 'Base Constraint').row.value;
    expect(base.kind).toBe('reference');
    expect(base.state).toBe('known');
    expect(base.text).toBe('L1 - Block 35');
    expect(base.evidence?.[0]).toContain('bos:1057');

    // `Image` is recorded with an entity index of -1, which references nothing.
    expect(labelled(sheet, 'Image').row.value).toMatchObject({ state: 'missing', text: '' });

    // Nowhere on the sheet does a reference read as the bare number the file holds.
    const references = sheet.groups.flatMap((group) => group.rows).filter((row) => row.value.kind === 'reference');
    expect(references.length).toBeGreaterThan(0);
    for (const row of references) expect(row.value.text).not.toMatch(/^-?\d+$/);
  }, 300_000);

  it('reads the storey off the level the file records, and says which of the two ways found it', async () => {
    const index = await openSnowdon();
    useInspectIndex(index);
    const wall = keyOfObjectId(index, 'bos:1165');

    // The file records no parent link at all: every link to another object came from the level that
    // object records, and the only others are the 92 level objects, each its own storey.
    const via = new Map<string, number>();
    for (const each of index.storeyVia.values()) via.set(each, (via.get(each) ?? 0) + 1);
    expect(via.get('a parent link')).toBeUndefined();
    expect(via.get('the level it records')).toBe(17_106);
    expect(via.get('being a storey itself')).toBe(index.storeys.length);
    expect(index.storeyOf.size).toBeLessThan(index.keys.length);

    const held = session();
    runCalls(held, pinCalls(hitOn(wall)));
    const storey = rowValue(pointAndReadSheet(held), 'identity', 'storey');
    expect(storey.state).toBe('known');
    expect(storey.text).toBe('L1 - Block 35');
    expect(storey.evidence).toBe(1);

    // An object the file records no level for still reads as having no storey.
    const unlinked = index.keys.find((key) => !index.storeyOf.has(key));
    expect(unlinked).toBeDefined();
    if (unlinked === undefined) return;
    const other = session();
    runCalls(other, pinCalls(hitOn(unlinked)));
    expect(rowValue(pointAndReadSheet(other), 'identity', 'storey')).toMatchObject({
      state: 'missing',
      text: '',
      reason: 'no storey link recorded',
    });
  }, 300_000);

  it('keeps every object readable, including the one carrying the most properties', async () => {
    const index = await openSnowdon();
    useInspectIndex(index);
    let most = index.keys[0];
    let count = 0;
    let empty = 0;
    for (const key of index.keys) {
      const each = propertyCountOf(index, key);
      if (each === 0) empty += 1;
      if (each > count) {
        count = each;
        most = key;
      }
    }
    // Every object of this file carries a sheet; none is empty.
    expect(empty).toBe(0);
    expect(count).toBe(120);
    if (most === undefined) return;
    const held = session();
    runCalls(held, pinCalls(hitOn(most)));
    const sheet = pointAndReadSheet(held);
    const groups = sheet.groups.filter((group) => group.id.startsWith('props/'));
    expect(groups.reduce((total, group) => total + group.rows.length, 0)).toBe(120);
    // A hundred and twenty properties in a handful of groups, and every row addressable on its own.
    expect(groups.length).toBeGreaterThan(3);
    const keys = groups.flatMap((group) => group.rows.map((row) => row.key));
    expect(new Set(keys).size).toBe(keys.length);
  }, 300_000);

  it('reports what it is showing, and reports the observations it does not have as none', async () => {
    const index = await openSnowdon();
    useInspectIndex(index);
    const held = session();
    runCalls(held, openingCalls());
    runCalls(held, pinCalls(hitOn(keyOfObjectId(index, 'bos:1165'))));
    const report = pointAndReadReport(held);
    expect(report['objects']).toBe(index.model.objects.length);
    expect(report['properties']).toBe(index.properties.rows);
    expect(report['propertiesDropped']).toBe(0);
    expect(report['documents']).toBe(7);
    expect(report['facts']).toBe(0);
    expect(report['shown']).toBe('bos:1165');
    expect(report['shownProperties']).toBe(44);
    expect(report['shownDocument']).toBe('Snowdon Towers Sample Architectural');
    // The first quantity the file records for this wall, in the unit it recorded it in. A recorded
    // zero is a recorded value and is reported as one; it is a value nobody recorded that is missing.
    expect(report['shownQuantity']).toBe('Base Extension Distance 0 FEET_AND_FRACTIONAL_INCHES');
    expect(report['shownStoreyVia']).toBe('the level it records');
    // The file records no observations, and the sheet says that rather than showing an empty group
    // beside forty-four properties without saying why it is empty.
    expect(pointAndReadSheet(held).groups.find((group) => group.id === 'facts')?.title).toBe(
      'Facts: this file records no observations',
    );
  }, 300_000);
});
