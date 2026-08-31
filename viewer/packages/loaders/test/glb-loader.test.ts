import { describe, expect, it } from 'vitest';
import { ViewerScene } from '@ara3d/viewer-core';
import { loadGlb } from '../src/glb-loader.js';
import { LoadProgress } from '../src/progress.js';
import { twoNodeTriangleGlb } from './helpers.js';

describe('loadGlb', () => {
  it('loads a GLB buffer into the scene, merging reused meshes into instances', async () => {
    const scene = new ViewerScene();
    const events: LoadProgress[] = [];
    const result = await loadGlb(twoNodeTriangleGlb(), scene, {
      onProgress: (p) => events.push(p),
    });

    expect(result.groups.length).toBe(1);
    expect(result.instanceCount).toBe(2);
    expect(scene.groupCount).toBe(1);
    const group = scene.groups[0];
    expect(group.instanceCount).toBe(2);
    expect(group.getTransform(0)[12]).toBe(0);
    expect(group.getTransform(1)[12]).toBe(2); // node translation baked in

    // no fetch stage (buffer source); parse begin/end then one convert step
    expect(events.map((e) => e.stage)).toEqual(['parse', 'parse', 'convert']);
    expect(events[2]).toEqual({ stage: 'convert', loaded: 1, total: 1 });
  });

  it('adds each group to the scene before reporting its convert progress', async () => {
    const scene = new ViewerScene();
    const counts: number[] = [];
    await loadGlb(twoNodeTriangleGlb(), scene, {
      onProgress: (p) => {
        if (p.stage === 'convert') counts.push(scene.groupCount);
      },
    });
    expect(counts).toEqual([1]);
  });
});
