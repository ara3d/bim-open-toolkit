// Integration test against a real .bos file. The file is local-only test data
// (never committed — see data/README.md), so the suite skips when it is absent.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ViewerScene } from '@ara3d/viewer-core';
import { parseBosGeometry, loadBos } from '../src/bos-loader.js';

const bosPath = fileURLToPath(
  new URL('../../../../platoflow/data/duplex.bos', import.meta.url),
);

describe.skipIf(!existsSync(bosPath))('BOS container (duplex.bos)', () => {
  const buffer = (): ArrayBuffer => {
    const b = readFileSync(bosPath);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };

  it('decodes the geometry tables', async () => {
    const bos = await parseBosGeometry(buffer());
    expect(bos.InstanceMeshIndex.length).toBeGreaterThan(0);
    expect(bos.MeshVertexOffset.length).toBeGreaterThan(0);
    expect(bos.VertexX.length).toBe(bos.VertexY.length);
    expect(bos.TransformTX.length).toBe(bos.TransformQW.length);
  });

  it('loads into a scene with progress reporting', async () => {
    const scene = new ViewerScene();
    const stages = new Set<string>();
    const result = await loadBos(buffer(), scene, {
      onProgress: (p) => stages.add(p.stage),
    });
    expect(result.instanceCount).toBeGreaterThan(0);
    expect(scene.groupCount).toBe(result.groups.length);
    expect(stages.has('parse')).toBe(true);
    expect(stages.has('convert')).toBe(true);
  });
});
