import { describe, expect, it } from 'vitest';
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
} from 'three';
import { convertObject, materialInfo, toMeshBuffers } from '../src/three-convert.js';
import { triangleGeometry, standardMaterial } from './helpers.js';

describe('toMeshBuffers', () => {
  it('extracts positions, indices, and computes nothing extra', () => {
    const mb = toMeshBuffers(triangleGeometry())!;
    expect([...mb.positions]).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(mb.indices).toBeInstanceOf(Uint32Array);
    expect([...mb.indices!]).toEqual([0, 1, 2]);
    expect(mb.normals).toBeUndefined();
  });

  it('passes through Float32 normals', () => {
    const g = triangleGeometry();
    g.setAttribute('normal', new BufferAttribute(
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    const mb = toMeshBuffers(g)!;
    expect([...mb.normals!]).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  });

  it('returns null for a geometry without vertices', () => {
    expect(toMeshBuffers(new BufferGeometry())).toBeNull();
  });
});

describe('materialInfo', () => {
  it('reads color, metalness, roughness, opacity', () => {
    const m = standardMaterial(0xff0000, { metalness: 0.5, roughness: 0.25, opacity: 0.75 });
    const info = materialInfo(m);
    expect(info.config).toEqual({ metalness: 0.5, roughness: 0.25, opacity: 0.75 });
    expect(info.color[0]).toBeCloseTo(1);
    expect(info.color[3]).toBeCloseTo(0.75);
  });

  it('falls back to defaults when material is missing', () => {
    const info = materialInfo(undefined);
    expect(info.config.opacity).toBe(1);
    expect(info.color).toEqual([1, 1, 1, 1]);
  });
});

describe('convertObject', () => {
  it('bakes nested node transforms into instance matrices', () => {
    const geometry = triangleGeometry();
    const parent = new Group();
    parent.position.set(1, 2, 3);
    const mesh = new Mesh(geometry, standardMaterial(0xffffff));
    mesh.position.set(10, 0, 0);
    parent.add(mesh);

    const { groups, instanceCount } = convertObject(parent);
    expect(groups.length).toBe(1);
    expect(instanceCount).toBe(1);
    const t = groups[0].getTransform(0);
    expect([t[12], t[13], t[14]]).toEqual([11, 2, 3]);
  });

  it('merges meshes sharing geometry and material parameters into one group', () => {
    const geometry = triangleGeometry();
    const root = new Group();
    const a = new Mesh(geometry, standardMaterial(0xff0000));
    const b = new Mesh(geometry, standardMaterial(0x00ff00));
    b.position.set(5, 0, 0);
    root.add(a, b);

    const { groups, instanceCount } = convertObject(root);
    expect(groups.length).toBe(1); // same config, colors differ per instance
    expect(instanceCount).toBe(2);
    expect(groups[0].instanceCount).toBe(2);
    expect(groups[0].getColor(0)[0]).toBeCloseTo(1);
    expect(groups[0].getColor(1)[1]).toBeCloseTo(1);
    expect(groups[0].getTransform(1)[12]).toBe(5);
  });

  it('splits groups when material config differs', () => {
    const geometry = triangleGeometry();
    const root = new Group();
    root.add(
      new Mesh(geometry, standardMaterial(0xffffff, { roughness: 0.1 })),
      new Mesh(geometry, standardMaterial(0xffffff, { roughness: 0.9 })),
    );
    const { groups } = convertObject(root);
    expect(groups.length).toBe(2);
  });

  it('flattens source InstancedMeshes, composing world and instance matrices', () => {
    const geometry = triangleGeometry();
    const im = new InstancedMesh(geometry, standardMaterial(0xffffff), 2);
    im.setMatrixAt(0, new Matrix4().makeTranslation(1, 0, 0));
    im.setMatrixAt(1, new Matrix4().makeTranslation(0, 1, 0));
    const root = new Group();
    root.position.set(0, 0, 7);
    root.add(im);

    const { groups, instanceCount } = convertObject(root);
    expect(instanceCount).toBe(2);
    const g = groups[0];
    expect([g.getTransform(0)[12], g.getTransform(0)[14]]).toEqual([1, 7]);
    expect([g.getTransform(1)[13], g.getTransform(1)[14]]).toEqual([1, 7]);
  });

  it('emits groups incrementally with ordered index/total', () => {
    const root = new Group();
    root.add(
      new Mesh(triangleGeometry(), standardMaterial(0xffffff)),
      new Mesh(triangleGeometry(), standardMaterial(0xffffff)),
    );
    const seen: Array<{ index: number; total: number; count: number }> = [];
    const { groups } = convertObject(root, (g, index, total) =>
      seen.push({ index, total, count: g.instanceCount }));
    expect(groups.length).toBe(2); // distinct geometry objects stay separate
    expect(seen).toEqual([
      { index: 0, total: 2, count: 1 },
      { index: 1, total: 2, count: 1 },
    ]);
  });
});
