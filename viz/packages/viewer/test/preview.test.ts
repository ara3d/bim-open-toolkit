// Viewer.preview over the fake renderer: the worked example from the plan's box-preview design, and
// the properties that make refinement flash-free (Section "How does refinement swap in without a
// flash").

import { InstancedGroup } from '@ara3d/viewer-core';
import { bfastCoordinates, type BoxPreview } from '@bim-open-toolkit/formats';
import { describe, expect, it } from 'vitest';
import { createViewer, type Viewer } from '../src/create-viewer.js';
import { fakeRenderer, testFrames, type FakeRenderer } from './support/fake-renderer.js';
import { twoObjectModel } from './support/model-fixture.js';

// The C2 worked example: A drawn opaque white at the origin, B drawn translucent red moved to
// (5,0,0). `bounds` also covers a bound-but-alpha-0 placement at (-3,0,0), which is why it reaches
// further left than either drawn box.
const worked = (): BoxPreview => ({
  boxes: Float32Array.of(0, 0, 0, 1, 1, 0, 5, 0, 0, 7, 2, 0),
  colors: Float32Array.of(1, 1, 1, 1, 1, 0, 0, 128 / 255),
  count: 2,
  bounds: { min: [-3, 0, 0], max: [7, 2, 0] },
  coordinates: bfastCoordinates,
  oversized: 0,
});

// A renderer that also remembers the scene's groups at the moment of every submitted frame, so a
// test can tell whether a frame in the middle of a coarse-to-full swap ever drew nothing at all.
const recordingRenderer = (): { readonly renderer: FakeRenderer; readonly frames: () => readonly (readonly InstancedGroup[])[] } => {
  const made = fakeRenderer();
  const frames: (readonly InstancedGroup[])[] = [];
  const renderFrame = made.renderFrame;
  const renderer: FakeRenderer = {
    ...made,
    renderFrame: () => {
      renderFrame();
      frames.push([...made.scene.groups]);
    },
  };
  return { renderer, frames: () => frames };
};

const started = (): {
  readonly viewer: Viewer;
  readonly renderers: FakeRenderer[];
  readonly frames: () => readonly (readonly InstancedGroup[])[];
} => {
  const renderers: FakeRenderer[] = [];
  const frameLogs: (() => readonly (readonly InstancedGroup[])[])[] = [];
  const clock = testFrames();
  const viewer = createViewer({
    renderer: () => {
      const { renderer, frames } = recordingRenderer();
      renderers.push(renderer);
      frameLogs.push(frames);
      return renderer;
    },
    schedule: clock.schedule,
  });
  for (const view of viewer.views.all()) view.resize(800, 400);
  return { viewer, renderers, frames: () => frameLogs.flatMap((log) => log()) };
};

describe('Viewer.preview', () => {
  it('draws the worked example: two groups, translucent B scaled and placed, one frame, framed bounds and up', () => {
    const { viewer, renderers } = started();
    viewer.preview(worked());

    const groups = renderers[0]!.scene.groups;
    expect(groups).toHaveLength(2);
    expect(renderers[0]!.log.frames()).toBe(1);

    const translucent = groups.find((group) => (group.colors[3] ?? 1) < 1)!;
    expect(translucent).toBeDefined();
    expect(translucent.instanceCount).toBe(1);
    expect(translucent.transforms[0]).toBeCloseTo(2, 5);
    expect(translucent.transforms[5]).toBeCloseTo(2, 5);
    expect(translucent.transforms[10]).toBeCloseTo(0.0102, 3);
    expect(translucent.transforms[12]).toBeCloseTo(6, 5);
    expect(translucent.transforms[13]).toBeCloseTo(1, 5);
    expect(translucent.transforms[14]).toBeCloseTo(0, 5);

    expect(viewer.bounds()).toEqual({ min: [-3, 0, 0], max: [7, 2, 0] });
    expect(viewer.views.all()[0]!.camera().camera.up).toEqual([0, 0, 1]);
  });

  it('never draws a frame with neither the preview nor the model, from preview through show', () => {
    const { viewer, frames } = started();
    viewer.preview(worked());
    viewer.show(twoObjectModel());

    const seen = frames();
    expect(seen.length).toBeGreaterThan(0);
    for (const groups of seen) expect(groups.length).toBeGreaterThan(0);
  });

  it('show removes the preview in the same call that adds the model groups', () => {
    const { viewer, renderers } = started();
    viewer.preview(worked());
    const previewGroups = [...renderers[0]!.scene.groups];
    viewer.show(twoObjectModel());

    const groups = renderers[0]!.scene.groups;
    expect(groups.length).toBeGreaterThan(0);
    for (const group of previewGroups) expect(groups).not.toContain(group);
  });

  it('a later preview replaces an earlier one', () => {
    const { viewer, renderers } = started();
    viewer.preview(worked());
    const firstGroups = [...renderers[0]!.scene.groups];

    const second: BoxPreview = {
      ...worked(),
      boxes: Float32Array.of(0, 0, 0, 4, 4, 4),
      colors: Float32Array.of(0, 0, 1, 1),
      count: 1,
      bounds: { min: [0, 0, 0], max: [4, 4, 4] },
    };
    viewer.preview(second);

    const groups = renderers[0]!.scene.groups;
    expect(groups).toHaveLength(1);
    for (const group of firstGroups) expect(groups).not.toContain(group);
  });

  it('dispose removes the preview', () => {
    const { viewer, renderers } = started();
    const handle = viewer.preview(worked());
    handle.dispose();

    expect(renderers[0]!.scene.groups).toHaveLength(0);
  });

  it('picking finds nothing while only the preview is shown', () => {
    const { viewer, renderers } = started();
    viewer.preview(worked());
    renderers[0]!.log.setHits([{ modelId: 'anything', group: 0, slot: 0, point: [0, 0, 0], distance: 1 }]);

    expect(viewer.pick(0, 0)).toBeUndefined();
  });

  it('a view added later gets the preview', () => {
    const { viewer } = started();
    viewer.preview(worked());

    const added = viewer.addView(undefined, { id: 'second' });
    expect(added.ok).toBe(true);
    const secondRenderer = (added.ok ? added.value.renderer : undefined) as FakeRenderer | undefined;
    expect(secondRenderer?.scene.groups).toHaveLength(2);
  });
});
