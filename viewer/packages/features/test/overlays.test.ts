import { command, emptyDocument, getSlice, object, putSlice, string, success, type Command } from '@bim-open-toolkit/model';
import { objectAnchor, overlayLayer, worldAnchor, type OverlayItem, type OverlayState } from '@bim-open-toolkit/render';
import { describe, expect, it } from 'vitest';
import {
  clickOverlay,
  findOverlayItem,
  heatColor,
  heatMapLayer,
  noOverlayState,
  outcomeColor,
  overlayActionOf,
  overlayCommands,
  overlayFromWorkflow,
  overlaysFeature,
  overlaysFeatureWith,
  overlaysSlice,
  workflowLayerId,
  type OverlayLegend,
  type OverlaysState,
} from '../src/overlays.js';
import { fakeSession } from './support/fake-session.js';

const legend: OverlayLegend = {
  id: 'utilisation',
  title: 'Utilisation',
  units: 'percent',
  stops: [
    { value: 0, color: [0, 0, 1] },
    { value: 100, color: [1, 0, 0] },
  ],
};

const marker: OverlayItem = {
  id: 'm1',
  kind: 'point',
  anchors: [worldAnchor([1, 2, 3])],
  style: { color: [1, 0, 0], opacity: 1, size: 6 },
  text: 'Unrated door',
  action: { command: 'test.echo', input: { id: 'door-3' } },
};

const layers: OverlayState = [overlayLayer('findings', 'Findings', [marker])];

const echo: Command = command({
  name: 'test.echo',
  title: 'Echo',
  description: 'Records what a click sent.',
  input: object({ id: string() }),
  run: (_session, input) => success(input.id),
});

describe('overlays slice', () => {
  it('round trips layers and legends through a document', () => {
    const state: OverlaysState = { layers, legends: [legend] };
    const document = putSlice(emptyDocument(), overlaysSlice, state);
    const read = getSlice(document, overlaysSlice);
    expect(read.ok && read.value).toEqual(state);
  });

  it('refuses a legend with no stops', () => {
    const empty = { layers: [], legends: [{ id: 'x', title: 'x', stops: [] }] };
    const document = { ...emptyDocument(), slices: { overlays: { version: 1, value: empty } } };
    expect(getSlice(document, overlaysSlice).ok).toBe(false);
  });

  it('refuses a primitive of a kind that does not exist', () => {
    const broken = { layers: [{ id: 'l', name: 'l', visible: true, items: [{ ...marker, kind: 'blob' }] }], legends: [] };
    expect(getSlice({ ...emptyDocument(), slices: { overlays: { version: 1, value: broken } } }, overlaysSlice).ok).toBe(false);
  });
});

describe('colour by value', () => {
  it('interpolates between the stops', () => {
    expect(heatColor(legend, 50)).toEqual([0.5, 0, 0.5]);
  });

  it('clamps a reading outside the scale to its ends', () => {
    expect(heatColor(legend, -20)).toEqual([0, 0, 1]);
    expect(heatColor(legend, 400)).toEqual([1, 0, 0]);
  });

  it('builds a layer of points coloured by value', () => {
    const built = heatMapLayer('heat', 'Utilisation', [
      { id: 's1', anchor: objectAnchor('m|r|a'), value: 0, text: '0%' },
      { id: 's2', anchor: worldAnchor([0, 0, 0]), value: 100 },
    ], legend);
    expect(built.ok).toBe(true);
    expect(built.ok && built.value.items.map((item) => item.style.color)).toEqual([
      [0, 0, 1],
      [1, 0, 0],
    ]);
  });
});

describe('workflow overlay records', () => {
  it('reads a marker record straight from a workflow result', () => {
    const built = overlayFromWorkflow({
      kind: 'marker',
      id: 'ex-1',
      text: 'No fire rating',
      outcome: 'missing',
      at: { kind: 'object', key: 'model|r1|door-3' },
    });
    expect(built.ok && built.value.kind).toBe('point');
    expect(built.ok && built.value.style.color).toEqual(outcomeColor('missing'));
    expect(built.ok && built.value.anchors).toEqual([objectAnchor('model|r1|door-3')]);
  });

  it('refuses a line record with only one end', () => {
    const built = overlayFromWorkflow({
      kind: 'line',
      id: 'ex-2',
      text: 'Trace',
      outcome: 'candidate',
      from: { kind: 'point', position: [0, 0, 0] },
    });
    expect(built.diagnostics.map((item) => item.code)).toEqual(['overlays/line-ends']);
  });
});

describe('overlay commands through a session', () => {
  it('sets, adds and clears', () => {
    const session = fakeSession([...overlayCommands, echo]);
    expect(session.dispatch('overlays.set', { layers, legends: [legend] }).ok).toBe(true);
    expect(session.read(overlaysSlice).layers).toEqual(layers);

    expect(
      session.dispatch('overlays.add', {
        kind: 'label',
        id: 'w1',
        text: 'Gap',
        outcome: 'conflicting',
        at: { kind: 'point', position: [4, 5, 6] },
      }).ok,
    ).toBe(true);
    expect(findOverlayItem(session.read(overlaysSlice), 'w1')?.kind).toBe('label');
    expect(session.read(overlaysSlice).layers.map((layer) => layer.id)).toEqual(['findings', workflowLayerId]);

    expect(session.dispatch('overlays.clear', { layerId: workflowLayerId }).ok).toBe(true);
    expect(session.read(overlaysSlice).layers.map((layer) => layer.id)).toEqual(['findings']);

    expect(session.dispatch('overlays.clear', {}).ok).toBe(true);
    expect(session.read(overlaysSlice)).toEqual(noOverlayState);
  });

  it('warns about a layer that was never there rather than failing', () => {
    const session = fakeSession(overlayCommands);
    const result = session.dispatch('overlays.clear', { layerId: 'nothing' });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.map((item) => item.code)).toEqual(['overlays/unknown-layer']);
  });

  it('warns about repeated primitive ids rather than dropping one', () => {
    const session = fakeSession(overlayCommands);
    const twice: OverlayState = [overlayLayer('a', 'a', [marker]), overlayLayer('b', 'b', [marker])];
    const result = session.dispatch('overlays.set', { layers: twice });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.map((item) => item.code)).toContain('repeated-overlay-item');
  });
});

describe('click actions', () => {
  it('dispatches the command the primitive names', () => {
    const session = fakeSession([...overlayCommands, echo]);
    session.dispatch('overlays.set', { layers });
    expect(overlayActionOf(session.read(overlaysSlice), 'm1')?.command).toBe('test.echo');
    const clicked = clickOverlay(session, 'm1');
    expect(clicked.ok && clicked.value).toBe('door-3');
    expect(session.events).toContain('test.echo:');
  });

  it('reports a primitive with no action', () => {
    const session = fakeSession(overlayCommands);
    session.dispatch('overlays.set', { layers: [overlayLayer('a', 'a', [{ ...marker, action: undefined }])] });
    expect(clickOverlay(session, 'm1').diagnostics.map((item) => item.code)).toEqual(['overlays/no-action']);
  });
});

describe('the render hook', () => {
  it('pushes the layers when it installs and on every change, and stops when it is disposed', () => {
    const seen: OverlayState[] = [];
    const withSink = overlaysFeatureWith({ showOverlays: (state) => void seen.push(state) });
    const session = fakeSession(withSink.commands);
    const installed = withSink.install?.(session);
    expect(seen).toHaveLength(1);

    session.dispatch('overlays.set', { layers });
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual(layers);

    installed?.dispose();
    session.dispatch('overlays.clear', {});
    expect(seen).toHaveLength(2);
  });

  it('installs no hook without a sink', () => {
    expect(overlaysFeature.install).toBeUndefined();
    expect(overlaysFeature.commands.map((item) => item.name)).toEqual([
      'overlays.set',
      'overlays.add',
      'overlays.clear',
    ]);
  });
});
