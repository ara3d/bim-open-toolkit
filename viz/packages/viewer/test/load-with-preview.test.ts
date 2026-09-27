// loadWithPreview over the fake renderer: the C2 worked example with an injected `nextFrame`, and the
// properties from the plan's design (Section "How does refinement swap in without a flash") that make
// coarse-then-full loading safe to wire into a host: the preview stays until `show`, a failed or
// cancelled load leaves no preview behind, and a source with no preview loads exactly as `loadModel`
// always has.

import { describe, expect, it, vi } from 'vitest';
import { createViewer, type Viewer } from '../src/create-viewer.js';
import { loadWithPreview } from '../src/load-with-preview.js';
import { fakeRenderer, testFrames, type FakeRenderer } from './support/fake-renderer.js';
// Reused rather than duplicated: the naive BFAST writer these fixtures build lives in the formats
// package's own test folder, because the loaders package exports no writer (see that file's header).
import { bfastModel, sampleBfast, triangleMesh } from '../../formats/test/fixtures.js';

const objText = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

// One drawn placement, which is a valid preview on its own, plus a second instance naming a mesh
// index that does not exist. `readBoxPreview`'s `isBound` looks up the mesh's vertex count and finds
// nothing there, so it silently excludes the row rather than raising; the full parse's `bfastInstances`
// checks the same index against the mesh count directly and raises `formats/invalidBfast`. So this
// fixture's preview always succeeds and its full parse always fails: a failure strictly after a
// preview was drawn, which is what the "failed load leaves no preview" case needs.
const bfastThatFailsAfterPreview = (): Uint8Array =>
  bfastModel({
    meshes: [triangleMesh()],
    instances: [
      { mesh: 0, entity: 0 },
      { mesh: 99, entity: 1 },
    ],
  });

const started = (): { readonly viewer: Viewer; readonly renderer: FakeRenderer } => {
  let renderer: FakeRenderer | undefined;
  const clock = testFrames();
  const viewer = createViewer({
    renderer: () => {
      renderer = fakeRenderer();
      return renderer;
    },
    schedule: clock.schedule,
  });
  for (const view of viewer.views.all()) view.resize(800, 400);
  return { viewer, renderer: renderer! };
};

// A `nextFrame` a test can await without a browser: it never needs a real animation frame, and it
// counts how many times it was awaited.
const injectedNextFrame = (): { readonly nextFrame: () => Promise<void>; readonly calls: () => number } => {
  let calls = 0;
  return {
    nextFrame: () => {
      calls += 1;
      return Promise.resolve();
    },
    calls: () => calls,
  };
};

describe('loadWithPreview', () => {
  it('draws the preview, calls the host onPreview, and awaits the injected nextFrame once before resolving', async () => {
    const { viewer, renderer } = started();
    const { nextFrame, calls } = injectedNextFrame();
    const seenPreviews: unknown[] = [];

    const result = await loadWithPreview(viewer, sampleBfast(), {
      nextFrame,
      onPreview: (preview) => seenPreviews.push(preview),
    });

    expect(seenPreviews).toHaveLength(1);
    expect(calls()).toBe(1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.data.objects).toHaveLength(3);

    // The preview stays in the scene: `loadWithPreview` never calls `show` itself.
    expect(renderer.scene.groups.length).toBeGreaterThan(0);
  });

  it('leaves the camera the preview framed for show to keep: fitting again after show lands on the same camera', async () => {
    const { viewer } = started();
    const result = await loadWithPreview(viewer, sampleBfast(), { nextFrame: () => Promise.resolve() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const previewCamera = viewer.views.all()[0]!.camera().camera;
    viewer.show(result.value);
    viewer.run('view.fit', {});
    const fullCamera = viewer.views.all()[0]!.camera().camera;

    for (let axis = 0; axis < 3; axis += 1) {
      expect(fullCamera.position[axis] ?? 0).toBeCloseTo(previewCamera.position[axis] ?? 0, 6);
      expect(fullCamera.target[axis] ?? 0).toBeCloseTo(previewCamera.target[axis] ?? 0, 6);
      expect(fullCamera.up[axis] ?? 0).toBeCloseTo(previewCamera.up[axis] ?? 0, 6);
    }
  });

  it('disposes the preview when the load fails after the preview was drawn', async () => {
    const { viewer, renderer } = started();
    const result = await loadWithPreview(viewer, bfastThatFailsAfterPreview(), {
      nextFrame: () => Promise.resolve(),
    });

    expect(result.ok).toBe(false);
    expect(renderer.scene.groups).toHaveLength(0);
  });

  it('disposes the preview when the load is cancelled during onPreview', async () => {
    const { viewer, renderer } = started();
    const controller = new AbortController();

    const result = await loadWithPreview(viewer, sampleBfast(), {
      signal: controller.signal,
      onPreview: () => controller.abort(),
      nextFrame: () => Promise.resolve(),
    });

    expect(result.ok).toBe(false);
    expect(renderer.scene.groups).toHaveLength(0);
  });

  it('gives OBJ bytes no preview and loads them exactly as loadModel would', async () => {
    const { viewer, renderer } = started();
    const onPreview = vi.fn();

    const result = await loadWithPreview(viewer, utf8(objText), { onPreview, nextFrame: () => Promise.resolve() });

    expect(onPreview).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(renderer.scene.groups).toHaveLength(0);
  });
});
