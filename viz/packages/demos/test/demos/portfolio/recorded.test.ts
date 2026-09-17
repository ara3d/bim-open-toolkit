// The roll-up the demo reads out of a model's own parameter tables, checked on tables built here.
//
// Nothing in this file needs the private model: the tables go through the formats package's own
// decoders, so what is checked is the same reading path a real file takes. `snowdon.test.ts` checks
// the same code against the real file, and skips itself when the file is not on the machine.

import { describe, expect, it } from 'vitest';
import { appearanceSlice, setsSlice } from '@bim-open-toolkit/features';
import { isEmptyBounds } from '@bim-open-toolkit/model';
import { generateBuilding, defaultBuildingOptions } from '@bim-open-toolkit/synthetic';
import { applyRecordedRollup, portfolioFeatures, portfolioReady, portfolioReport } from '../../../src/demos/portfolio/index.js';
import { portfolioIndex } from '../../../src/demos/portfolio/city.js';
import { portfolioSheet, sourceSheet } from '../../../src/demos/portfolio/inspector.js';
import { drillIntoDocument, rollupDoc, rollupPanel } from '../../../src/demos/portfolio/panels.js';
import { metricOf, metricText, notTotalled, rollupOf, unattributedTitle } from '../../../src/demos/portfolio/recorded.js';
import { drilledDocument, lookAt, resetLook, subjectOf } from '../../../src/demos/portfolio/snowdon.js';
import { openedModel } from '../../../src/gallery/model-source.js';
import { commandNames, refusedCalls, sessionForFeatures } from '../_d4-support/fake-session.js';
import { probePanel, semanticLabels } from '../_d4-support/panel-probe.js';
import { expected, recordedModel } from './recorded-fixture.js';

const index = portfolioIndex();

const rollup = () => {
  const made = rollupOf(recordedModel());
  expect(made).toBeDefined();
  if (made === undefined) throw new Error('the fixture records properties and documents');
  return made;
};

const started = () => {
  const session = sessionForFeatures(portfolioFeatures);
  const made = rollup();
  const applied = applyRecordedRollup(session, made);
  return { session, rollup: made, applied };
};

describe('rolling a recorded quantity up by source document', () => {
  it('adds up only what the file records, in the unit the file records it in', () => {
    const made = rollup();
    expect(made.requestedMetricName).toBe('Area');
    expect(made.requested.unit).toBe(expected.areaUnit);
    expect(made.requested.total).toBe(expected.areaTotal);
    expect(made.requested.objects).toBe(expected.areaObjects);
    expect(made.objects).toBe(expected.objects);
  });

  it('counts an object with no figure as having none, never as a zero', () => {
    const made = rollup();
    expect(made.requested.without).toBe(expected.areaWithout);
    expect(made.requested.objects + made.requested.without).toBe(made.objects);
    // The one object whose area is recorded as zero is a recorded zero, counted apart from the
    // objects nobody measured, and it is inside `objects` rather than inside `without`.
    expect(made.requested.zeros).toBe(expected.areaZeros);
  });

  it('never converts, so a quantity recorded in two units gets no total at all', () => {
    const made = rollup();
    const volume = metricOf(made.metrics, 'Volume');
    expect(volume?.total).toBeUndefined();
    expect(volume?.unit).toBeUndefined();
    expect(volume?.byUnit.map((item) => item.unit)).toEqual([...expected.volumeUnits]);
    expect(volume?.byUnit.find((item) => item.unit === 'CUBIC_FEET')?.total).toBe(expected.volumeCubicFeet);
    expect(volume?.byUnit.find((item) => item.unit === 'US_GALLONS')?.total).toBe(expected.volumeGallons);
    expect(notTotalled(made).map((item) => item.metricName)).toEqual(['Volume']);
    expect(metricText(volume)).toContain('Not totalled');
  });

  it('lists every source document the file names, largest total first', () => {
    const made = rollup();
    expect(made.documents.map((item) => item.title)).toEqual([
      unattributedTitle,
      'Architectural',
      'Structural',
      'Landscape',
    ]);
    expect(made.documents.map((item) => item.requested.total ?? -1)).toEqual([...expected.areaByDocument, -1]);
    expect(made.documentCount).toBe(expected.documentTitles.length);
  });

  it('keeps the objects the file attributes to no document out of every document total', () => {
    const made = rollup();
    expect(made.unattributed).toBe(expected.unattributed);
    const none = made.documents.find((item) => item.index < 0);
    expect(none?.title).toBe(unattributedTitle);
    expect(none?.outcome).toBe('excluded');
  });

  it('says a document that records none of the metric records none, and gives it no total', () => {
    const made = rollup();
    const landscape = made.documents.find((item) => item.title === 'Landscape');
    expect(landscape?.requested.objects).toBe(0);
    expect(landscape?.requested.total).toBeUndefined();
    expect(landscape?.outcome).toBe('missing');
    expect(metricText(landscape?.requested)).toBe('No figure recorded');
  });

  it('colours an object that records two disagreeing figures as a disagreement', () => {
    const made = rollup();
    expect((made.byOutcome.get('resolved') ?? []).length).toBe(expected.resolved);
    expect((made.byOutcome.get('conflicting') ?? []).length).toBe(expected.conflicting);
    expect((made.byOutcome.get('missing') ?? []).length).toBe(expected.missing);
    expect((made.byOutcome.get('excluded') ?? []).length).toBe(expected.excluded);
  });

  it('has no roll-up at all for a model whose format carries neither table', () => {
    const built = generateBuilding(defaultBuildingOptions);
    expect(rollupOf(openedModel('snowdon', built.model, built.geometry))).toBeUndefined();
  });
});

describe('putting a recorded roll-up into a session', () => {
  it('is accepted by every feature command it dispatches, and names the same two sets', () => {
    const { session, applied } = started();
    expect(refusedCalls(session)).toEqual([]);
    expect(applied.ok).toBe(true);
    const sets = session.read(setsSlice).sets;
    expect(sets.map((set) => set.id).sort()).toEqual(['portfolio/resolved', 'portfolio/unresolved']);
    expect(sets.find((set) => set.id === 'portfolio/resolved')?.members.length).toBe(expected.resolved);
    expect(session.read(appearanceSlice).rules.map((rule) => rule.id)).toContain('portfolio/missing');
  });

  it('is ready once it has coloured the model, and says so through the same check as the estate', () => {
    const { session, rollup: made } = started();
    lookAt({ kind: 'source', title: 'recorded', reading: { modelId: 'recorded', origin: 'recorded', objects: made.objects, named: 0, categorised: 0, identified: 0, drawn: 0, categories: [] }, rollup: made });
    expect(portfolioReady(session)).toBe(true);
    resetLook();
  });
});

describe('the roll-up panel', () => {
  it('shows a row per source document and says what carries no figure', () => {
    const made = rollup();
    const doc = rollupDoc(made, -1);
    expect(doc.visible).toBe(true);
    expect(doc.rows.map((row) => row.title)).toEqual(made.documents.map((item) => item.title));
    expect(doc.total).toContain(expected.areaUnit);
    expect(doc.without).toBe(`${String(expected.areaWithout)} objects record no Area`);
    expect(doc.notTotalled).toContain('Volume');
  });

  it('drills into one document and back out again, isolating exactly its objects', () => {
    const { session, rollup: made } = started();
    const architectural = made.documents.find((item) => item.title === 'Architectural');
    expect(architectural).toBeDefined();
    if (architectural === undefined) return;
    drillIntoDocument(session, made, architectural.index);
    expect(drilledDocument()).toBe(architectural.index);
    expect(session.read(setsSlice).isolated).toEqual(architectural.keys);
    drillIntoDocument(session, made, architectural.index);
    expect(drilledDocument()).toBeUndefined();
    expect(session.read(setsSlice).isolated).toBeNull();
    resetLook();
  });

  it('sends the camera nowhere when the document it drilled into draws nothing', () => {
    const { session, rollup: made } = started();
    // No mesh draws any object of the fixture, so no document has a box. A box unioned from the
    // object records instead would be a box around the world origin, which is where a model read
    // from a BFAST file leaves every record.
    for (const document of made.documents) expect(isEmptyBounds(document.bounds)).toBe(true);
    const first = made.documents[0];
    if (first === undefined) return;
    drillIntoDocument(session, made, first.index);
    expect(commandNames(session)).not.toContain('navigation.frame');
    expect(session.read(setsSlice).isolated).toEqual(first.keys);
    resetLook();
  });

  it('draws nothing at all while the demo is on the estate', () => {
    const session = sessionForFeatures(portfolioFeatures);
    const probe = probePanel(rollupPanel, session);
    expect(probe).toBeDefined();
    expect(semanticLabels(probe?.semantics() ?? [])).toEqual([]);
    probe?.stop();
  });

  it('drills on a keyboard activation once the demo is on the model it read', () => {
    const { session, rollup: made } = started();
    lookAt(subjectOf(index.city.model.ref.id, [recordedModel()]));
    const probe = probePanel(rollupPanel, session);
    probe?.sync();
    expect(semanticLabels(probe?.semantics() ?? []).length).toBeGreaterThan(0);
    expect(probe?.activate()).toBe(true);
    expect(drilledDocument()).toBe(made.documents[0]?.index);
    probe?.stop();
    resetLook();
  });
});

describe('the sheet for a model that carries a roll-up', () => {
  it('reports the total in the recorded unit and the objects carrying no figure as missing', () => {
    const model = recordedModel();
    const made = rollup();
    const sheet = sourceSheet('recorded', {
      modelId: 'recorded',
      origin: 'recorded',
      objects: model.data.objects.length,
      named: 0,
      categorised: 0,
      identified: 0,
      drawn: 0,
      categories: [],
    }, made);
    const group = sheet.groups.find((item) => item.id === 'rollup');
    const total = group?.rows.find((row) => row.key === 'total');
    expect(total?.value.state).toBe('known');
    expect(total?.value.unit).toBe(expected.areaUnit);
    expect(total?.value.text).toBe(expected.areaTotal.toFixed(2));
    const without = group?.rows.find((row) => row.key === 'without');
    expect(without?.value.state).toBe('missing');
    expect(without?.value.missingReason ?? '').toContain(String(expected.areaWithout));
  });

  it('shows a quantity recorded in two units as a disagreement rather than adding it up', () => {
    const made = rollup();
    const sheet = sourceSheet('recorded', {
      modelId: 'recorded',
      origin: 'recorded',
      objects: made.objects,
      named: 0,
      categorised: 0,
      identified: 0,
      drawn: 0,
      categories: [],
    }, made);
    const volume = sheet.groups
      .find((item) => item.id === 'other-metrics')
      ?.rows.find((row) => row.key === 'metric/Volume');
    expect(volume?.value.state).toBe('conflicting');
    for (const unit of expected.volumeUnits) expect(volume?.value.text).toContain(unit);
  });

  it('carries the two tables that say what was added up and what could not be', () => {
    const { session } = started();
    lookAt(subjectOf(index.city.model.ref.id, [recordedModel()]));
    const sheet = portfolioSheet(index)(session);
    expect((sheet.tables ?? []).map((item) => item.id)).toEqual(['byDocument', 'byUnit']);
    const byUnit = (sheet.tables ?? []).find((item) => item.id === 'byUnit');
    // One row per unit each quantity was recorded in: one for Area, two for Volume.
    expect(byUnit?.table.rowCount).toBe(3);
    resetLook();
  });

  it('narrows to one source document once the reader has drilled into it', () => {
    const { session, rollup: made } = started();
    lookAt(subjectOf(index.city.model.ref.id, [recordedModel()]));
    const structural = made.documents.find((item) => item.title === 'Structural');
    if (structural === undefined) return;
    drillIntoDocument(session, made, structural.index);
    const sheet = portfolioSheet(index)(session);
    expect(sheet.title).toBe('Structural');
    expect(sheet.groups.find((item) => item.id === 'document')?.rows.find((row) => row.key === 'path')?.value.text).toBe(
      'struct.rvt',
    );
    resetLook();
  });
});

describe('what the demo reports about a model that carries a roll-up', () => {
  it('states the figure with its unit, and the objects carrying none beside it', () => {
    const { session } = started();
    lookAt(subjectOf(index.city.model.ref.id, [recordedModel()]));
    const report = portfolioReport(session);
    expect(report['basis']).toBe('source-backed');
    expect(report['metric']).toBe('Area');
    expect(report['unit']).toBe(expected.areaUnit);
    expect(report['total']).toBe(`${expected.areaTotal.toFixed(2)} ${expected.areaUnit}`);
    expect(report['withFigure']).toBe(expected.areaObjects);
    expect(report['withoutFigure']).toBe(expected.areaWithout);
    expect(report['recordedZero']).toBe(expected.areaZeros);
    expect(report['unattributedObjects']).toBe(expected.unattributed);
    expect(report['notTotalled']).toContain('Volume');
    expect(report['drilledDocument']).toBe('none');
    expect(portfolioReady(session)).toBe(true);
    resetLook();
  });
});
