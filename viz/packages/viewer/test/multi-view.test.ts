import { describe, expect, it } from 'vitest';
import { cameraPose, defaultView } from '@bim-open-toolkit/model';
import { createViewer, type Viewer } from '../src/create-viewer.js';
import { viewSlice } from '../src/core-features.js';
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
  const second = viewer.addView(undefined, { id: 'second' });
  if (!second.ok) throw new Error('the second view could not start');
  for (const view of viewer.views.all()) view.resize(400, 400);
  return { viewer, renderers, clock };
};

const somewhere = { ...defaultView, camera: cameraPose([9, 9, 9], [0, 0, 0], [0, 0, 1]) };

describe('two views over one session', () => {
  it('draws the same model in both, from one set of groups', () => {
    const { viewer, renderers } = started();
    viewer.show(twoObjectModel());
    expect(renderers[0]?.scene.groupCount).toBe(1);
    expect(renderers[1]?.scene.groupCount).toBe(1);
    expect(renderers[0]?.scene.groups[0]).toBe(renderers[1]?.scene.groups[0]);
    // One model, not two: the binding built one table.
    expect(viewer.binding.models).toHaveLength(1);
    expect(viewer.statistics().renderedInstances).toBe(2);
  });

  it('gives each view its own camera while they are not linked', () => {
    const { viewer } = started();
    viewer.views.get('main')?.setCamera(somewhere);
    expect(viewer.views.get('second')?.camera().camera.position).not.toEqual([9, 9, 9]);
  });

  it('moves both cameras together once they are linked', () => {
    const { viewer } = started();
    expect(viewer.run('view.link', { linked: true }).ok).toBe(true);
    expect(viewer.views.linked()).toBe(true);
    viewer.views.get('main')?.setCamera(somewhere);
    expect(viewer.views.get('second')?.camera().camera.position).toEqual([9, 9, 9]);
  });

  it('does not let two linked views chase each other', () => {
    const { viewer } = started();
    viewer.run('view.link', { linked: true });
    viewer.views.get('main')?.setCamera(somewhere);
    expect(viewer.views.get('main')?.camera().camera.position).toEqual([9, 9, 9]);
    expect(viewer.views.get('second')?.camera().camera.position).toEqual([9, 9, 9]);
  });

  it('switches the mode of every view with one command', () => {
    const { viewer } = started();
    expect(viewer.run('view.mode', { mode: 'overhead' }).ok).toBe(true);
    expect(viewer.views.all().map((one) => one.mode())).toEqual(['overhead', 'overhead']);
    expect(viewer.session.read(viewSlice).mode).toBe('overhead');
  });

  it('fits the view it is told to, and leaves the other alone', () => {
    const { viewer } = started();
    viewer.show(twoObjectModel());
    const before = viewer.views.get('second')?.camera();
    viewer.views.get('second')?.setCamera(somewhere);
    expect(viewer.run('view.fit', { view: 'second' }).ok).toBe(true);
    expect(viewer.views.get('second')?.camera().camera.position).not.toEqual([9, 9, 9]);
    expect(before).toBeDefined();
  });

  it('saves a camera per view and restores both', () => {
    const { viewer } = started();
    viewer.show(twoObjectModel());
    viewer.views.get('second')?.setCamera(somewhere);
    const saved = viewer.save();
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const reopened = started();
    reopened.viewer.show(twoObjectModel());
    expect(reopened.viewer.load(saved.value).ok).toBe(true);
    expect(reopened.viewer.views.get('second')?.camera().camera.position).toEqual([9, 9, 9]);
    reopened.viewer.dispose();
  });

  it('refuses a second view with an id already taken', () => {
    const { viewer } = started();
    const refused = viewer.addView(undefined, { id: 'second' });
    expect(refused.ok).toBe(false);
    expect(refused.diagnostics.map((one) => one.code)).toContain('viewer/repeated-view');
  });

  it('leaves the other view drawing when one is removed', () => {
    const { viewer, renderers, clock } = started();
    viewer.show(twoObjectModel());
    expect(viewer.views.remove('second')).toBe(true);
    expect(renderers[1]?.log.disposals()).toBe(1);
    expect(renderers[1]?.scene.groupCount).toBe(0);
    expect(renderers[0]?.scene.groupCount).toBe(1);
    const drawn = renderers[0]?.log.frames() ?? 0;
    viewer.views.get('main')?.requestRender();
    clock.tick(16);
    expect(renderers[0]?.log.frames()).toBe(drawn + 1);
  });

  it('disposes every view when the viewer goes', () => {
    const { viewer, renderers } = started();
    viewer.dispose();
    expect(renderers.map((one) => one.log.disposals())).toEqual([1, 1]);
    expect(viewer.views.ids()).toEqual([]);
  });
});
