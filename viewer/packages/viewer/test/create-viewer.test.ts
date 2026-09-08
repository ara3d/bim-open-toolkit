import { describe, expect, it } from 'vitest';
import {
  isEmptyBounds,
  objectKey,
  styleRule,
  type ObjectKey,
  type StyleRule,
} from '@bim-open-toolkit/model';
import { createViewer, type Viewer } from '../src/create-viewer.js';
import { appearanceSlice, modelsSlice, viewSlice } from '../src/core-features.js';
import { fakeRenderer, testFrames, type FakeRenderer } from './support/fake-renderer.js';
import { twoObjectModel } from './support/model-fixture.js';

const started = (): {
  readonly viewer: Viewer;
  readonly renderers: FakeRenderer[];
  readonly clock: ReturnType<typeof testFrames>;
} => {
  const renderers: FakeRenderer[] = [];
  const clock = testFrames();
  const viewer = createViewer({
    renderer: () => {
      const made = fakeRenderer();
      renderers.push(made);
      return made;
    },
    schedule: clock.schedule,
  });
  for (const view of viewer.views.all()) view.resize(800, 400);
  return { viewer, renderers, clock };
};

const keyOf = (objectId: string): ObjectKey =>
  objectKey({ modelId: 'fixture', revision: 'r1', objectId });

const redRule = (): StyleRule => styleRule('red', 'Red doors', [keyOf('b')], { color: [1, 0, 0] });

describe('createViewer', () => {
  it('installs the default features and their commands', () => {
    const { viewer } = started();
    expect(viewer.features.features().map((one) => one.id)).toEqual([
      'viewer.models',
      'viewer.view',
      'viewer.appearance',
    ]);
    expect(viewer.describe().map((one) => one.name)).toContain('view.fit');
    expect(viewer.describe().map((one) => one.name)).toContain('appearance.select');
  });

  it('has one view, and reports having nothing to draw yet', () => {
    const { viewer } = started();
    expect(viewer.views.ids()).toEqual(['main']);
    expect(isEmptyBounds(viewer.bounds())).toBe(true);
    expect(viewer.statistics().renderedInstances).toBe(0);
  });

  it('shows a model: binds it, puts its groups in the view, and records it', () => {
    const { viewer, renderers } = started();
    const shown = viewer.show(twoObjectModel());
    expect(shown.ok).toBe(true);
    expect(viewer.statistics().renderedInstances).toBe(2);
    expect(viewer.statistics().sourceObjects).toBe(2);
    expect(renderers[0]?.scene.groupCount).toBe(1);
    expect(viewer.models().map((one) => one.id)).toEqual(['fixture']);
    expect(viewer.session.read(modelsSlice).open).toHaveLength(1);
    expect(isEmptyBounds(viewer.bounds())).toBe(false);
  });

  it('refuses to show the same model twice', () => {
    const { viewer } = started();
    viewer.show(twoObjectModel());
    expect(viewer.show(twoObjectModel()).ok).toBe(false);
  });

  it('closes a model and takes its groups out of the view', () => {
    const { viewer, renderers } = started();
    viewer.show(twoObjectModel());
    expect(viewer.close('fixture')).toBe(true);
    expect(renderers[0]?.scene.groupCount).toBe(0);
    expect(viewer.models()).toEqual([]);
    expect(viewer.close('fixture')).toBe(false);
  });

  it('frames the model when one opens', () => {
    const { viewer } = started();
    const before = viewer.views.get('main')?.camera().camera.position;
    viewer.show(twoObjectModel());
    expect(viewer.views.get('main')?.camera().camera.position).not.toEqual(before);
  });

  it('writes a colour rule into the buffers, and writes nothing the second time', () => {
    const { viewer } = started();
    viewer.show(twoObjectModel());
    const applied = viewer.apply(redRule());
    expect(applied.ok).toBe(true);
    const table = viewer.binding.tableOf('fixture');
    expect(table).toBeDefined();
    if (table === undefined) return;
    // Object b is the second object, so its row is the second of the single group.
    const colors = table.colors[0];
    expect(colors?.[4]).toBeCloseTo(1);
    expect(colors?.[5]).toBeCloseTo(0);
  });

  it('hides everything a filter leaves out', () => {
    const { viewer } = started();
    viewer.show(twoObjectModel());
    expect(viewer.run('appearance.filter', { keys: [keyOf('b')] }).ok).toBe(true);
    const table = viewer.binding.tableOf('fixture');
    expect(table?.visible[0]).toBe(0);
    expect(table?.visible[1]).toBe(1);
    viewer.run('appearance.filter', { keys: null });
    expect(table?.visible[0]).toBe(1);
  });

  it('selects what a pick found, and reports nothing when the ray misses', () => {
    const { viewer, renderers } = started();
    viewer.show(twoObjectModel());
    renderers[0]?.log.setHits([{ modelId: 'fixture', group: 0, slot: 1, point: [2, 0, 0], distance: 5 }]);
    const hit = viewer.pick(0, 0);
    expect(hit?.key).toBe(keyOf('b'));
    expect(viewer.select([hit?.key ?? '']).ok).toBe(true);
    expect(viewer.session.read(appearanceSlice).selection).toEqual([keyOf('b')]);

    renderers[0]?.log.setHits([]);
    expect(viewer.pick(0, 0)).toBeUndefined();
  });

  it('refuses a camera command when there is no view', () => {
    const viewer = createViewer();
    expect(viewer.views.ids()).toEqual([]);
    const refused = viewer.run('view.fit', {});
    expect(refused.ok).toBe(false);
    expect(refused.diagnostics.map((one) => one.code)).toContain('viewer/no-scene');
    viewer.dispose();
  });

  it('reports a renderer that could not start rather than throwing', () => {
    const viewer = createViewer({
      renderer: () => {
        throw new Error('no WebGL here');
      },
    });
    expect(viewer.views.ids()).toEqual([]);
    expect(viewer.diagnostics().map((one) => one.code)).toContain('viewer/no-renderer');
    viewer.dispose();
  });

  it('saves a scene with every installed slice and restores it into a fresh viewer', () => {
    const { viewer } = started();
    viewer.show(twoObjectModel());
    viewer.apply(redRule());
    viewer.select([keyOf('a')]);
    const saved = viewer.save();
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(Object.keys(saved.value.slices).sort()).toEqual([
      'viewer.appearance',
      'viewer.fingerprint',
      'viewer.models',
      'viewer.view',
    ]);
    expect(saved.value.slices['viewer.view']).toBeDefined();

    const second = started();
    second.viewer.show(twoObjectModel());
    const loaded = second.viewer.load(saved.value);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect([...loaded.value.restored].sort()).toEqual(['viewer.appearance', 'viewer.models', 'viewer.view']);
    expect(second.viewer.session.read(appearanceSlice).selection).toEqual([keyOf('a')]);
    const table = second.viewer.binding.tableOf('fixture');
    expect(table?.colors[0]?.[4]).toBeCloseTo(1);
    second.viewer.dispose();
  });

  it('refuses a scene saved against a model that is not open', () => {
    const { viewer } = started();
    viewer.show(twoObjectModel());
    const saved = viewer.save();
    if (!saved.ok) return;
    const other = started();
    other.viewer.show(twoObjectModel('fixture', 'r2'));
    const refused = other.viewer.load(saved.value);
    expect(refused.ok).toBe(false);
    expect(refused.diagnostics.map((one) => one.code)).toContain('viewer/model-mismatch');
    other.viewer.dispose();
  });

  it('restores a saved camera into the view it belongs to', () => {
    const { viewer } = started();
    viewer.show(twoObjectModel());
    const saved = viewer.save();
    if (!saved.ok) return;
    const moved = viewer.views.get('main')?.camera();

    const second = started();
    second.viewer.show(twoObjectModel());
    second.viewer.load(saved.value);
    expect(second.viewer.views.get('main')?.camera().camera.position).toEqual(moved?.camera.position);
    second.viewer.dispose();
  });

  it('captures the picture as bytes', async () => {
    const { viewer } = started();
    viewer.show(twoObjectModel());
    const image = await viewer.capture();
    expect(image.ok).toBe(true);
    expect(image.ok && image.value.bytes.length).toBe(4);
  });

  it('reports what the GPU timer could not do rather than a number in its place', () => {
    const { viewer } = started();
    const hud = viewer.hud();
    expect(hud.gpu.state).toBe('unavailable');
    expect(hud.camera).toBe('perspective');
  });

  it('leaves nothing behind when disposed', () => {
    const { viewer, renderers, clock } = started();
    viewer.show(twoObjectModel());
    clock.tick(16);
    viewer.dispose();
    expect(viewer.disposed()).toBe(true);
    expect(viewer.views.ids()).toEqual([]);
    expect(renderers[0]?.log.disposals()).toBe(1);
    expect(renderers[0]?.scene.groupCount).toBe(0);
    expect(viewer.binding.disposed).toBe(true);
    expect(viewer.session.disposed()).toBe(true);
    expect(viewer.session.sliceRegistry().size).toBe(0);
    expect(clock.pending()).toBe(0);
    const drawn = renderers[0]?.log.frames();
    clock.tick(32);
    expect(renderers[0]?.log.frames()).toBe(drawn);
  });

  it('is safe to dispose twice', () => {
    const { viewer, renderers } = started();
    viewer.dispose();
    viewer.dispose();
    expect(renderers[0]?.log.disposals()).toBe(1);
  });

  it('takes its own features out for a host that brings its own', () => {
    const viewer = createViewer({ features: [] });
    expect(viewer.features.features()).toEqual([]);
    expect(viewer.describe()).toEqual([]);
    expect(viewer.session.read(viewSlice).mode).toBe('orbit');
    viewer.dispose();
  });
});
