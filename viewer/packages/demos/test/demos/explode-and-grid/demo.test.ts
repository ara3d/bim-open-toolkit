import { layoutsSlice } from '@bim-open-toolkit/features';
import { describe, expect, it } from 'vitest';
import { demo, explodeReady, explodeReport, startExplode } from '../../../src/demos/explode-and-grid/index.js';
import { explodeSheet } from '../../../src/demos/explode-and-grid/inspector.js';
import { explodeApp, explodePanel, explodePanelSpec } from '../../../src/demos/explode-and-grid/panels.js';
import { sessionForFeatures } from '../_d2-support/fake-session.js';
import { headlessPanel } from '../_d2-support/panel-harness.js';

const session = () => sessionForFeatures(demo.features);

describe('the explode-and-grid demo', () => {
  it('states what it is', () => {
    expect(demo.id).toBe('explode-and-grid');
    expect(demo.chapter).toBe('cut-and-arrange');
    expect(demo.fixtures[0]?.basis).toBe('synthetic');
    expect(demo.briefIds).toContain('F13');
  });

  it('opens the synthetic building', async () => {
    const source = await demo.fixtures[0]?.source();
    expect(source?.ok).toBe(true);
    if (source?.ok !== true) return;
    expect(source.value.kind).toBe('data');
  });
});

describe('starting the demo', () => {
  it('separates the model a little and is then ready', () => {
    const live = session();
    expect(explodeReady(live)).toBe(false);
    const started = startExplode(live);
    expect(started.ok).toBe(true);
    expect(live.dispatched.map((each) => each.name)).toEqual(['layouts.explode']);
    expect(explodeReady(live)).toBe(true);
    const layout = live.read(layoutsSlice).layout;
    expect(layout.kind).toBe('explode');
    if (layout.kind === 'explode') {
      expect(layout.by).toBe('storey');
      expect(layout.strength).toBe(0.35);
    }
  });

  it('puts the model back together when the demo is disposed', () => {
    const live = session();
    const started = startExplode(live);
    if (started.ok !== true) throw new Error('the demo did not start');
    started.value.dispose();
    expect(live.read(layoutsSlice).layout).toEqual({ kind: 'none' });
    expect(explodeReady(live)).toBe(false);
  });

  it('reports the layout kind and its parameters', () => {
    const live = session();
    startExplode(live);
    const report = explodeReport(live);
    expect(report.layoutKind).toBe('explode');
    expect(report.by).toBe('storey');
    expect(report.strength).toBe(0.35);
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

  it('says nothing is separated when there is no layout', () => {
    const sheet = explodeSheet(session());
    const layout = sheet.groups.find((group) => group.id === 'layout');
    expect(layout?.rows).toHaveLength(1);
    expect(layout?.rows[0]?.value.text).toBe('None');
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
    const doc = { by: 'category' as const, strength: 1.2, gridAsked: 0, resetAsked: 0 };
    explodePanelSpec.onCommit?.(doc, { by: 'storey' as const, strength: 0, gridAsked: 0, resetAsked: 0 }, live);
    expect(live.dispatched.map((each) => each.name)).toEqual(['layouts.explode']);
    expect(live.dispatched[0]?.input).toEqual({ by: 'category', strength: 1.2 });
    explodePanelSpec.onCommit?.(doc, doc, live);
    expect(live.dispatched).toHaveLength(1);
  });

  it('dispatches grid and reset only when their counters change', () => {
    const live = session();
    const before = { by: 'storey' as const, strength: 0, gridAsked: 0, resetAsked: 0 };
    explodePanelSpec.onCommit?.({ ...before, gridAsked: 1 }, before, live);
    expect(live.dispatched.map((each) => each.name)).toEqual(['layouts.grid']);
    explodePanelSpec.onCommit?.({ ...before, resetAsked: 1 }, before, live);
    expect(live.dispatched.map((each) => each.name)).toEqual(['layouts.grid', 'layouts.reset']);
  });

  it('reads an applied explode back out of the slice, and leaves grid and reset presses alone', () => {
    const live = session();
    live.dispatch('layouts.explode', { by: 'category', strength: 0.8 });
    const synced = explodePanelSpec.sync?.(live, { by: 'storey', strength: 0, gridAsked: 3, resetAsked: 2 });
    expect(synced).toEqual({ by: 'category', strength: 0.8, gridAsked: 3, resetAsked: 2 });
    live.dispatch('layouts.grid', {});
    const afterGrid = explodePanelSpec.sync?.(live, { by: 'category', strength: 0.8, gridAsked: 3, resetAsked: 2 });
    expect(afterGrid).toEqual({ by: 'category', strength: 0.8, gridAsked: 3, resetAsked: 2 });
    expect(explodePanel.id).toBe('explode-bar');
  });
});
