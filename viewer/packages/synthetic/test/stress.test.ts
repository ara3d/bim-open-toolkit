import { describe, expect, it } from 'vitest';
import { geometryBounds, isEmptyBounds, isGeometryFree, triangleCount } from '@bim-open-toolkit/model';
import {
  defaultStressOptions,
  generateStressScene,
  materialClasses,
  type MaterialClass,
  type StressOptions,
  type StressScene,
} from '../src/stress.js';

// Options with the given overrides applied to the defaults.
const withOptions = (overrides: Partial<StressOptions>): StressOptions => ({ ...defaultStressOptions, ...overrides });

// The triangles the scene actually draws, counted from the instance rows rather than reported.
function drawnTriangles(scene: StressScene): number {
  let total = 0;
  for (let row = 0; row < scene.geometry.instances.count; row++) {
    const index = scene.geometry.instances.meshIndex[row];
    if (index === undefined) throw new Error(`instance ${row} has no mesh index`);
    const mesh = scene.geometry.meshes[index];
    if (mesh === undefined) throw new Error(`instance ${row} points at mesh ${index}, which does not exist`);
    total += triangleCount(mesh);
  }
  return total;
}

// A small scene that still exercises every rule, so most tests stay fast.
const small = withOptions({ seed: 5, instances: 600, meshes: 8, triangleBudget: 200_000, maxMeshTriangles: 2048 });

describe('generateStressScene options', () => {
  it('rejects options that cannot produce the scene asked for', () => {
    expect(() => generateStressScene(withOptions({ instances: 0 }))).toThrow(/instances/);
    expect(() => generateStressScene(withOptions({ meshes: 0 }))).toThrow(/meshes/);
    expect(() => generateStressScene(withOptions({ triangleBudget: 0 }))).toThrow(/triangleBudget/);
    expect(() => generateStressScene(withOptions({ maxMeshTriangles: 4 }))).toThrow(/maxMeshTriangles/);
    expect(() => generateStressScene(withOptions({ seed: 0.5 }))).toThrow(/seed/);
  });

  it('refuses a budget too small for the instances rather than dropping instances', () => {
    expect(() => generateStressScene(withOptions({ instances: 1000, triangleBudget: 1000 }))).toThrow(/budget/);
  });

  it('rejects a material mix that says nothing', () => {
    const mix = { opaque: 0, transparent: 0, metal: 0, painted: 0 };
    expect(() => generateStressScene(withOptions({ mix }))).toThrow(/positive weight/);
    expect(() => generateStressScene(withOptions({ mix: { ...mix, opaque: -1 } }))).toThrow(/at least 0/);
  });
});

describe('generateStressScene determinism', () => {
  it('gives identical output for the same options', () => {
    expect(generateStressScene(small)).toEqual(generateStressScene(small));
  });

  it('gives different output for different seeds', () => {
    const a = generateStressScene({ ...small, seed: 1 });
    const b = generateStressScene({ ...small, seed: 2 });
    expect(b.geometry.instances.transform).not.toEqual(a.geometry.instances.transform);
    expect(b.materialClass).not.toEqual(a.materialClass);
  });
});

describe('generateStressScene counts', () => {
  const scene = generateStressScene(small);

  it('places exactly the number of instances asked for', () => {
    expect(scene.geometry.instances.count).toBe(small.instances);
    expect(scene.model.objects.length).toBe(small.instances);
    expect(scene.materialClass.length).toBe(small.instances);
  });

  it('draws every instance, so no instance is silently dropped', () => {
    for (let row = 0; row < scene.geometry.instances.count; row++) {
      expect(isGeometryFree(scene.geometry.instances, row)).toBe(false);
    }
  });

  it('builds exactly the number of meshes asked for and uses them all at this size', () => {
    expect(scene.geometry.meshes.length).toBe(small.meshes);
    expect(scene.meshGroups.length).toBe(small.meshes);
    expect(scene.meshGroups.every((group) => group.instanceCount > 0)).toBe(true);
  });

  it('makes the mesh group instance counts add up to the instances', () => {
    const total = scene.meshGroups.reduce((sum, group) => sum + group.instanceCount, 0);
    expect(total).toBe(small.instances);
    scene.meshGroups.forEach((group, index) => {
      let counted = 0;
      for (let row = 0; row < scene.geometry.instances.count; row++) {
        if (scene.geometry.instances.meshIndex[row] === index) counted += 1;
      }
      expect(group.instanceCount).toBe(counted);
      expect(group.triangleCount).toBe(triangleCount(group.mesh));
    });
  });

  it('gives every instance an addressable object in one revision', () => {
    const ids = scene.model.objects.map((record) => record.ref.objectId);
    expect(new Set(ids).size).toBe(ids.length);
    scene.model.objects.forEach((record, row) => {
      expect(scene.geometry.instances.objectIndex[row]).toBe(row);
      expect(record.representation).toBe(scene.geometry.instances.meshIndex[row]);
    });
  });

  it('places the instances somewhere with volume', () => {
    const bounds = geometryBounds(scene.geometry);
    expect(isEmptyBounds(bounds)).toBe(false);
    expect(bounds.max[0] - bounds.min[0]).toBeGreaterThan(10);
    expect(bounds.max[1] - bounds.min[1]).toBeGreaterThan(10);
  });
});

describe('generateStressScene triangle budget', () => {
  it('reports the triangles it actually draws', () => {
    const scene = generateStressScene(small);
    expect(scene.triangleCount).toBe(drawnTriangles(scene));
  });

  it('stays inside the budget', () => {
    const scene = generateStressScene(small);
    expect(scene.triangleCount).toBeLessThanOrEqual(small.triangleBudget);
  });

  it('stays inside a budget only just large enough, at exactly the instance count', () => {
    const tight = withOptions({ seed: 3, instances: 500, meshes: 6, triangleBudget: 500 * 12, maxMeshTriangles: 1024 });
    const scene = generateStressScene(tight);
    expect(scene.geometry.instances.count).toBe(500);
    expect(scene.triangleCount).toBe(500 * 12);
    expect(scene.triangleCount).toBeLessThanOrEqual(tight.triangleBudget);
  });

  it('stays inside the budget across many sizes and seeds', () => {
    for (const seed of [1, 2, 3]) {
      for (const budget of [20_000, 75_000, 400_000]) {
        const scene = generateStressScene(withOptions({ seed, instances: 400, meshes: 10, triangleBudget: budget, maxMeshTriangles: 4096 }));
        expect(scene.triangleCount).toBeLessThanOrEqual(budget);
        expect(scene.triangleCount).toBe(drawnTriangles(scene));
        expect(scene.geometry.instances.count).toBe(400);
      }
    }
  });

  it('uses most of a budget it is given rather than drawing the cheapest mesh throughout', () => {
    const scene = generateStressScene(withOptions({ seed: 7, instances: 500, meshes: 12, triangleBudget: 400_000, maxMeshTriangles: 4096 }));
    expect(scene.triangleCount).toBeGreaterThan(400_000 * 0.5);
    expect(scene.triangleCount).toBeLessThanOrEqual(400_000);
  });
});

describe('generateStressScene material mix', () => {
  const scene = generateStressScene(withOptions({ seed: 2, instances: 4000, meshes: 8, triangleBudget: 800_000, maxMeshTriangles: 2048 }));

  it('produces all four classes', () => {
    for (const name of materialClasses) {
      expect(scene.materialCounts[name]).toBeGreaterThan(0);
    }
  });

  it('counts the classes it recorded per instance', () => {
    const counted: Record<MaterialClass, number> = { opaque: 0, transparent: 0, metal: 0, painted: 0 };
    for (const index of scene.materialClass) {
      const name = materialClasses[index];
      if (name === undefined) throw new Error(`material class ${index} is not one of the four`);
      counted[name] += 1;
    }
    expect(counted).toEqual(scene.materialCounts);
    expect(materialClasses.reduce((total, name) => total + counted[name], 0)).toBe(scene.geometry.instances.count);
  });

  it('follows the requested shares within a few percent', () => {
    for (const name of materialClasses) {
      const share = scene.materialCounts[name] / scene.geometry.instances.count;
      expect(share).toBeCloseTo(scene.options.mix[name], 1);
    }
  });

  it('makes only the transparent instances see-through', () => {
    for (let row = 0; row < scene.geometry.instances.count; row++) {
      const index = scene.materialClass[row];
      const opacity = scene.geometry.instances.color[row * 4 + 3];
      if (opacity === undefined || index === undefined) throw new Error(`instance ${row} is incomplete`);
      if (materialClasses[index] === 'transparent') {
        expect(opacity).toBeGreaterThanOrEqual(0.2);
        expect(opacity).toBeLessThan(0.51);
      } else {
        expect(opacity).toBeCloseTo(1, 5);
      }
    }
  });

  it('honours a mix that asks for one class only', () => {
    const only = generateStressScene(
      withOptions({ seed: 4, instances: 300, meshes: 4, triangleBudget: 60_000, maxMeshTriangles: 1024, mix: { opaque: 0, transparent: 1, metal: 0, painted: 0 } }),
    );
    expect(only.materialCounts.transparent).toBe(300);
    expect(only.materialCounts.opaque).toBe(0);
  });
});

describe('generateStressScene size', () => {
  it('generates the ten thousand instance, ten million triangle scene the targets name', () => {
    const started = performance.now();
    const scene = generateStressScene(defaultStressOptions);
    const elapsed = performance.now() - started;
    expect(scene.geometry.instances.count).toBe(10000);
    expect(scene.triangleCount).toBeLessThanOrEqual(10_000_000);
    expect(scene.triangleCount).toBeGreaterThan(1_000_000);
    expect(elapsed).toBeLessThan(3000);
  });
});
