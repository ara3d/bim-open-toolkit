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
import { loadModel } from '@bim-open-toolkit/formats';
import type { ObjectKey, Observation } from '@bim-open-toolkit/model';
import { sheetCoverage } from '@bim-open-toolkit/ui-gratify';
import type { ObjectHit } from '@bim-open-toolkit/render';
import { snowdonFile } from '../../../src/demos/_shared/snowdon.js';
import {
  factsOf,
  hideWallsRuleId,
  inspectIndex,
  inspectIndexOf,
  objectTable,
  runCalls,
  syntheticIndex,
  useInspectIndex,
  wallKeys,
} from '../../../src/demos/point-and-read/building.js';
import { identityRows, pointAndReadSheet } from '../../../src/demos/point-and-read/inspector.js';
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
// asserted here is what the file itself carries; nothing is filled in for what it does not.
describe.skipIf(!existsSync(snowdonPath))(`point-and-read on the real model (needs ${snowdonFile}; skipped when it is not on this machine)`, () => {
  it('reads the object records and the boxes out of the file, and reports the rest as missing', async () => {
    const loaded = await loadModel(new Uint8Array(readFileSync(snowdonPath)), { format: 'bfast' });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const index = inspectIndexOf(loaded.value.data, loaded.value.geometry);
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
    runCalls(held, pinCalls(hitOn(drawn)));
    const sheet = pointAndReadSheet(held);
    expect(rowValue(sheet, 'identity', 'objectId').state).toBe('known');
    // The file records no parent link, so nothing links an object to a storey and the sheet says so
    // rather than reading one off an elevation.
    expect(rowValue(sheet, 'identity', 'storey')).toMatchObject({ state: 'missing', text: '' });
    expect(sheet.groups.find((group) => group.id === 'facts')?.rows).toEqual([]);
    const report = pointAndReadReport(held);
    expect(report['facts']).toBe(0);
    expect(report['objects']).toBe(index.model.objects.length);
  }, 120_000);
});
