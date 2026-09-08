// Point and read, through a session that records what the demo dispatched and a headless Gratify
// runtime that draws the tag. No browser and no renderer: everything asserted here is a function of
// the synthetic building and the session.

import { describe, expect, it } from 'vitest';
import { Runtime, type Element } from 'gratify';
import { appearanceCommands, appearanceSlice, editsCommands, setsCommands, setsSlice } from '@bim-open-toolkit/features';
import type { ObjectKey, Observation } from '@bim-open-toolkit/model';
import { sheetCoverage } from '@bim-open-toolkit/ui-gratify';
import type { ObjectHit } from '@bim-open-toolkit/render';
import { factsOf, hideWallsRuleId, inspectIndex, objectTable, runCalls, wallKeys } from '../../../src/demos/point-and-read/building.js';
import { identityRows, pointAndReadSheet } from '../../../src/demos/point-and-read/inspector.js';
import { emptyTag, isPinned, pinnedSetId, shownKey, tagOf, tagSpec, tagView } from '../../../src/demos/point-and-read/panels.js';
import {
  demo,
  hoverCalls,
  openingCalls,
  pinCalls,
  pointAndReadReady,
  pointAndReadReport,
  resetCalls,
} from '../../../src/demos/point-and-read/index.js';
import { commandNames, recordingSession, type RecordingSession } from './fake-session.js';

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

// A label element's text, without assuming what else its props hold.
const labelText = (element: Element): string | undefined => {
  const props: unknown = element.props;
  return typeof props === 'object' && props !== null && 'text' in props && typeof props.text === 'string'
    ? props.text
    : undefined;
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
    expect(tagView(emptyTag).children).toEqual([]);
  });

  it('shows the pointed object through a headless runtime', () => {
    const held = session();
    const door = doorRated('known');
    runCalls(held, hoverCalls(hitOn(door)));
    const doc = tagOf(held);
    const runtime = new Runtime<typeof doc, never>(null, { ...tagSpec, init: doc }, { headless: true, width: 240, height: 120 });
    runtime.step(2);
    const texts = (tagView(runtime.doc).children ?? []).map(labelText);
    expect(texts).toContain(doc.name);
    expect(texts).toContain('Door');
    expect(texts).toContain('Click to pin');
  });
});

describe('point-and-read demo', () => {
  it('registers as an Inspect demo over the synthetic building', () => {
    expect(demo.id).toBe('point-and-read');
    expect(demo.chapter).toBe('inspect');
    expect(demo.fixtures[0]?.basis).toBe('synthetic');
    expect(demo.panels.map((panel) => panel.id)).toEqual(['point-and-read/tag']);
  });

  it('opens the synthetic building as data already in memory', async () => {
    const source = await demo.fixtures[0]?.source();
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
