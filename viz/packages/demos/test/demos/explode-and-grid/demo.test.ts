// The demo opens Snowdon Towers by default, and the real file is a hundred megabytes that is never
// committed. So everything that can be checked without it is checked on the generated building, and
// the one test that needs the file skips itself, by name, when the file is not on this machine.

import { layoutsSlice } from '@bim-open-toolkit/features';
import { loadModel } from '@bim-open-toolkit/formats';
import { identityMatrix, objectRef, type ModelData, type ModelRef } from '@bim-open-toolkit/model';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { demo, explodeReady, explodeReport, startExplode } from '../../../src/demos/explode-and-grid/index.js';
import { explodeSheet } from '../../../src/demos/explode-and-grid/inspector.js';
import { explodeApp, explodeDocFrom, explodePanel, explodePanelSpec } from '../../../src/demos/explode-and-grid/panels.js';
import {
  categoryOpening,
  holdSurvey,
  openingExplode,
  storeyOpening,
  surveyExplode,
  unmovedReason,
} from '../../../src/demos/explode-and-grid/survey.js';
import { sessionForFeatures } from '../_d2-support/fake-session.js';
import { headlessPanel } from '../_d2-support/panel-harness.js';

const session = () => sessionForFeatures(demo.features);

// The generated building, which is the demo's second fixture and the one every model-independent
// test runs on.
const generatedBuilding = async (): Promise<ModelData> => {
  const source = await demo.fixtures[1]?.source();
  if (source?.ok !== true || source.value.kind !== 'data') throw new Error('the generated building did not open');
  return source.value.data;
};

// A model whose objects all sit at the same point and record no category, which is the shape a
// prepared BFAST arrives in: its placements live in the instance table, not on the object records.
const flatModel = (count: number): ModelData => {
  const ref: ModelRef = { id: 'flat', revision: '1' };
  return {
    ref,
    coordinates: { units: 'unknown', up: 'z', registration: { kind: 'unknown' } },
    objects: Array.from({ length: count }, (_, index) => ({
      ref: objectRef(ref, `flat:${index}`),
      transform: identityMatrix,
    })),
  };
};

const snowdonPath = fileURLToPath(
  new URL('../../../../visualization/artifacts/bfast/snowdon.bfast', import.meta.url),
);

// The survey is held for the life of a mounted demo, so a test that starts one releases it.
afterEach(() => holdSurvey(undefined));

describe('the explode-and-grid demo', () => {
  it('states what it is', () => {
    expect(demo.id).toBe('explode-and-grid');
    expect(demo.chapter).toBe('cut-and-arrange');
    expect(demo.briefIds).toContain('F13');
  });

  it('opens the real model first and the generated building second', async () => {
    expect(demo.fixtures[0]?.id).toBe('snowdon');
    expect(demo.fixtures[0]?.basis).toBe('source-backed');
    const real = await demo.fixtures[0]?.source();
    expect(real?.ok).toBe(true);
    if (real?.ok === true) expect(real.value.kind).toBe('url');
    expect(demo.fixtures[1]?.basis).toBe('synthetic');
    const generated = await demo.fixtures[1]?.source();
    if (generated?.ok === true) expect(generated.value.kind).toBe('data');
  });
});

describe('surveying what a model offers a layout', () => {
  it('finds the storeys and categories of the generated building', async () => {
    const survey = surveyExplode(await generatedBuilding());
    expect(survey.objects).toBeGreaterThan(0);
    expect(survey.storeys).toBeGreaterThanOrEqual(2);
    expect(survey.categories).toBeGreaterThanOrEqual(2);
    expect(survey.placements).toBeGreaterThan(1);
    expect(survey.movedByStorey).toBeGreaterThan(0);
    expect(survey.movedByCategory).toBeGreaterThan(0);
    expect(openingExplode(survey)).toEqual(storeyOpening);
    expect(unmovedReason(survey, 'storey')).toBeUndefined();
  });

  it('finds nothing to separate in a model whose objects share one placement', () => {
    const survey = surveyExplode(flatModel(1000));
    expect(survey.objects).toBe(1000);
    expect(survey.storeys).toBe(0);
    expect(survey.categories).toBe(0);
    expect(survey.placements).toBe(1);
    expect(survey.movedByStorey).toBe(0);
    expect(survey.movedByCategory).toBe(0);
    // Neither separator moves anything, so the opening move stays on the demo's headline one.
    expect(openingExplode(survey)).toEqual(storeyOpening);
    expect(unmovedReason(survey, 'storey')).toContain('All 1000 objects carry the same placement');
    expect(unmovedReason(survey, 'category')).toContain('same placement');
  });

  it('opens by category when only categories separate the model', async () => {
    const building = await generatedBuilding();
    // The same objects with their storey links gone: categories still fan, storeys cannot.
    const withoutStoreys: ModelData = {
      ...building,
      objects: building.objects.filter((record) => record.category !== 'Storey'),
    };
    const survey = surveyExplode(withoutStoreys);
    expect(survey.storeys).toBe(0);
    expect(survey.movedByStorey).toBe(0);
    expect(survey.movedByCategory).toBeGreaterThan(0);
    expect(openingExplode(survey)).toEqual(categoryOpening);
  });
});

describe('starting the demo', () => {
  it('refuses to start when no model is open', () => {
    const started = startExplode(session(), undefined);
    expect(started.ok).toBe(false);
    if (started.ok) return;
    expect(started.diagnostics[0]?.code).toBe('explode/no-model');
  });

  it('separates the generated building by storey and is then ready', async () => {
    const live = session();
    expect(explodeReady(live)).toBe(false);
    const started = startExplode(live, await generatedBuilding());
    expect(started.ok).toBe(true);
    expect(live.dispatched.map((each) => each.name)).toEqual(['layouts.explode']);
    expect(explodeReady(live)).toBe(true);
    const layout = live.read(layoutsSlice).layout;
    expect(layout.kind).toBe('explode');
    if (layout.kind === 'explode') {
      expect(layout.by).toBe('storey');
      expect(layout.strength).toBe(storeyOpening.strength);
    }
  });

  it('puts the model back together and forgets the survey when the demo is disposed', async () => {
    const live = session();
    const started = startExplode(live, await generatedBuilding());
    if (started.ok !== true) throw new Error('the demo did not start');
    started.value.dispose();
    expect(live.read(layoutsSlice).layout).toEqual({ kind: 'none' });
    expect(explodeReady(live)).toBe(false);
  });

  it('reports the layout, what the model offers, and how many objects moved', async () => {
    const live = session();
    const building = await generatedBuilding();
    startExplode(live, building);
    const report = explodeReport(live);
    const survey = surveyExplode(building);
    expect(report.layoutKind).toBe('explode');
    expect(report.by).toBe('storey');
    expect(report.strength).toBe(storeyOpening.strength);
    expect(report.objects).toBe(survey.objects);
    expect(report.storeys).toBe(survey.storeys);
    expect(report.moved).toBe(survey.movedByStorey);
    expect(report.moved).toBeGreaterThan(0);
    expect(report.caveat).toBe('');
  });

  it('reports zero moved and why on a model nothing can separate', () => {
    const live = session();
    startExplode(live, flatModel(12));
    const report = explodeReport(live);
    expect(report.moved).toBe(0);
    expect(report.placements).toBe(1);
    expect(report.caveat).toContain('same placement');
  });
});

describe('the inspector sheet', () => {
  it('reports an explode and its strength from a known state', () => {
    const live = session();
    live.dispatch('layouts.explode', { by: 'category', strength: 1.5 });
    const sheet = explodeSheet(live);
    expect(sheet.title).toBe('Explode and grid');
    const layout = sheet.groups.find((group) => group.id === 'layout');
    expect(layout?.rows.find((row) => row.key === 'by')?.value.text).toBe('Category');
    expect(layout?.rows.find((row) => row.key === 'strength')?.value.text).toBe('1.50');
    expect(layout?.rows.find((row) => row.key === 'computed')?.value.text).toContain('ground radius');
  });

  it('says a grid with spacing zero is not a number somebody chose', () => {
    const live = session();
    live.dispatch('layouts.grid', {});
    const sheet = explodeSheet(live);
    const layout = sheet.groups.find((group) => group.id === 'layout');
    const spacing = layout?.rows.find((row) => row.key === 'spacing');
    expect(spacing?.value.state).toBe('missing');
    expect(spacing?.value.missingReason).toContain('own footprint');
    const columns = layout?.rows.find((row) => row.key === 'columns');
    expect(columns?.value.state).toBe('missing');
    expect(columns?.value.missingReason).toContain('square an arrangement');
  });

  it('reports a chosen grid spacing and column count as known numbers', () => {
    const live = session();
    live.dispatch('layouts.grid', { spacing: 2, columns: 4 });
    const sheet = explodeSheet(live);
    const layout = sheet.groups.find((group) => group.id === 'layout');
    expect(layout?.rows.find((row) => row.key === 'spacing')?.value.text).toBe('2.00');
    expect(layout?.rows.find((row) => row.key === 'columns')?.value.text).toBe('4');
  });

  it('says nothing is separated, and nothing surveyed, when no demo has started', () => {
    const sheet = explodeSheet(session());
    const layout = sheet.groups.find((group) => group.id === 'layout');
    expect(layout?.rows).toHaveLength(1);
    expect(layout?.rows[0]?.value.text).toBe('None');
    const model = sheet.groups.find((group) => group.id === 'model');
    expect(model?.rows[0]?.value.state).toBe('missing');
    expect(model?.rows[0]?.value.missingReason).toContain('nothing has been surveyed');
  });

  it('counts what the model offers and what the layout moved', async () => {
    const live = session();
    startExplode(live, await generatedBuilding());
    const sheet = explodeSheet(live);
    const model = sheet.groups.find((group) => group.id === 'model');
    expect(Number(model?.rows.find((row) => row.key === 'storeys')?.value.text)).toBeGreaterThanOrEqual(2);
    expect(Number(model?.rows.find((row) => row.key === 'placements')?.value.text)).toBeGreaterThan(1);
    const layout = sheet.groups.find((group) => group.id === 'layout');
    expect(Number(layout?.rows.find((row) => row.key === 'moved')?.value.text)).toBeGreaterThan(0);
    expect(layout?.rows.find((row) => row.key === 'caveat')).toBeUndefined();
  });

  it('says why nothing moved on a model nothing can separate', () => {
    const live = session();
    startExplode(live, flatModel(7));
    const layout = explodeSheet(live).groups.find((group) => group.id === 'layout');
    expect(layout?.rows.find((row) => row.key === 'moved')?.value.text).toBe('0');
    expect(layout?.rows.find((row) => row.key === 'caveat')?.value.text).toContain('same placement');
  });
});

describe('the explode bar', () => {
  it('offers every control a keyboard can reach', () => {
    const panel = headlessPanel(explodeApp);
    expect(panel.controls().map((node) => node.label)).toEqual([
      'Storey',
      'Category',
      'Explode strength',
      'Grid',
      'Reset',
    ]);
    panel.dispose();
  });

  it('chooses a separator when its chip is pressed', () => {
    const panel = headlessPanel(explodeApp);
    expect(panel.press('Category')).toBe(true);
    expect(panel.doc().by).toBe('category');
    panel.dispose();
  });

  it('changes the strength when the slider is dragged', () => {
    const panel = headlessPanel(explodeApp);
    expect(panel.dragX('Explode strength', 0.5)).toBe(true);
    expect(panel.doc().strength).toBeCloseTo(1, 1);
    panel.dispose();
  });

  it('counts a grid press and a reset press separately', () => {
    const panel = headlessPanel(explodeApp);
    expect(panel.press('Grid')).toBe(true);
    expect(panel.doc().gridAsked).toBe(1);
    expect(panel.doc().resetAsked).toBe(0);
    expect(panel.press('Reset')).toBe(true);
    expect(panel.doc().resetAsked).toBe(1);
    panel.dispose();
  });

  it('dispatches the changed explode, and nothing when nothing changed', () => {
    const live = session();
    const doc = { by: 'category' as const, strength: 1.2, objects: 0, moved: 0, gridAsked: 0, resetAsked: 0 };
    explodePanelSpec.onCommit?.(doc, { ...doc, by: 'storey', strength: 0 }, live);
    expect(live.dispatched.map((each) => each.name)).toEqual(['layouts.explode']);
    expect(live.dispatched[0]?.input).toEqual({ by: 'category', strength: 1.2 });
    explodePanelSpec.onCommit?.(doc, doc, live);
    expect(live.dispatched).toHaveLength(1);
  });

  it('dispatches grid and reset only when their counters change', () => {
    const live = session();
    const before = { by: 'storey' as const, strength: 0, objects: 0, moved: 0, gridAsked: 0, resetAsked: 0 };
    explodePanelSpec.onCommit?.({ ...before, gridAsked: 1 }, before, live);
    expect(live.dispatched.map((each) => each.name)).toEqual(['layouts.grid']);
    explodePanelSpec.onCommit?.({ ...before, resetAsked: 1 }, before, live);
    expect(live.dispatched.map((each) => each.name)).toEqual(['layouts.grid', 'layouts.reset']);
  });

  it('reads an applied explode back out of the slice, and leaves grid and reset presses alone', () => {
    const live = session();
    live.dispatch('layouts.explode', { by: 'category', strength: 0.8 });
    const synced = explodePanelSpec.sync?.(live, {
      by: 'storey',
      strength: 0,
      objects: 0,
      moved: 0,
      gridAsked: 3,
      resetAsked: 2,
    });
    expect(synced).toEqual({
      by: 'category',
      strength: 0.8,
      objects: 0,
      moved: 0,
      gridAsked: 3,
      resetAsked: 2,
    });
    live.dispatch('layouts.grid', {});
    const afterGrid = explodePanelSpec.sync?.(live, { ...(synced ?? explodeApp.init) });
    expect(afterGrid?.by).toBe('category');
    expect(afterGrid?.gridAsked).toBe(3);
    expect(explodePanel.id).toBe('explode-bar');
  });

  it('counts what the applied layout moves of the surveyed model', async () => {
    const survey = surveyExplode(await generatedBuilding());
    const doc = explodeDocFrom(explodeApp.init, { kind: 'explode', by: 'storey', strength: 0.35 }, survey);
    expect(doc.objects).toBe(survey.objects);
    expect(doc.moved).toBe(survey.movedByStorey);
    const flat = surveyExplode(flatModel(9));
    const none = explodeDocFrom(explodeApp.init, { kind: 'explode', by: 'storey', strength: 0.35 }, flat);
    expect(none.objects).toBe(9);
    expect(none.moved).toBe(0);
    // A grid names every object when it is given no keys, so it offsets all of them.
    const grid = explodeDocFrom(explodeApp.init, { kind: 'grid', spacing: 0, columns: 0, keys: [] }, flat);
    expect(grid.moved).toBe(9);
  });
});

// Skipped when Snowdon Towers is not on this machine: the file is private and a hundred megabytes,
// so it is never committed and the rest of the suite never needs it.
describe.skipIf(!existsSync(snowdonPath))('the real model', () => {
  it('carries no storeys, no categories and one placement, so no explode can separate it', async () => {
    const loaded = await loadModel(new Uint8Array(readFileSync(snowdonPath)), { format: 'bfast' });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const survey = surveyExplode(loaded.value.data);
    expect(survey.objects).toBeGreaterThan(1000);
    expect(survey.storeys).toBe(0);
    expect(survey.categories).toBe(0);
    // A prepared BFAST keeps its placements in the instance table; every object record is identity.
    expect(survey.placements).toBe(1);
    expect(survey.movedByStorey).toBe(0);
    expect(survey.movedByCategory).toBe(0);
    expect(unmovedReason(survey, 'storey')).toContain('same placement');
  }, 120000);
});
