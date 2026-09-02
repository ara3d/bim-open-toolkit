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

  it('reports instances under their source entity ids, not BOS row indices', async () => {
    const bos = await parseBosGeometry(buffer());
    const ids = bos.EntityLocalId!;
    expect(ids.length).toBeGreaterThan(0);
    const scene = new ViewerScene();
    const { groupEntities } = await loadBos(buffer(), scene);
    const entities = groupEntities.flatMap((g) => [...g.entities]);
    expect(entities.length).toBeGreaterThan(0);
    // Every reported id is the LocalId of some entity row, and differs from
    // the row index for at least most instances (the two are distinct spaces).
    const localIds = new Set([...ids]);
    expect(entities.every((e) => localIds.has(e))).toBe(true);
    const rowIndices = new Set([...bos.InstanceEntityIndex]);
    expect(entities.some((e) => !rowIndices.has(e))).toBe(true);
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
