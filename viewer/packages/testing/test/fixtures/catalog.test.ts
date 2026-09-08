import { describe, expect, it } from 'vitest';
import { noMesh } from '@bim-open-toolkit/model';
import {
  buildingFixture,
  sceneFixture,
  sceneFixtureNames,
  smallBuilding,
  smallBuildingOptions,
  stressScene,
  tenThousandObjects,
} from '../../src/fixtures/catalog.js';
import { drawnTriangles, fixtureFingerprint, tableOf } from '../../src/fixtures/scene-fixture.js';

describe('the catalog', () => {
  it('names three fixtures and builds each of them', () => {
    expect(sceneFixtureNames).toEqual(['small-building', 'ten-thousand-objects', 'stress']);
    for (const name of sceneFixtureNames) expect(sceneFixture(name).name).toBe(name);
  });

  it('gives every fixture a description and a positive triangle count', () => {
    for (const name of sceneFixtureNames) {
      const built = sceneFixture(name);
      expect(built.description.length).toBeGreaterThan(20);
      expect(built.triangleCount).toBeGreaterThan(0);
    }
  });
});

describe('the small building', () => {
  const built = smallBuilding();

  it('is small enough to read, and every drawn instance points at a mesh and an object', () => {
    expect(built.model.objects.length).toBe(150);
    const { count, meshIndex, objectIndex } = built.geometry.instances;
    expect(count).toBe(built.model.objects.length);
    for (let row = 0; row < count; row += 1) {
      const index = meshIndex[row] ?? noMesh;
      if (index !== noMesh) expect(index).toBeLessThan(built.geometry.meshes.length);
      expect(objectIndex[row]).toBe(row);
    }
  });

  it('publishes the two schedules the door review reads', () => {
    expect(built.tables.map(([name]) => name)).toEqual(['roomSchedule', 'doorSchedule']);
    expect(tableOf(built, 'doorSchedule')?.rowCount).toBeGreaterThan(0);
    expect(tableOf(built, 'missing')).toBeUndefined();
  });

  it('counts the triangles its instances draw', () => {
    expect(built.triangleCount).toBe(drawnTriangles(built.geometry));
  });

  it('is deterministic: two builds have the same fingerprint', () => {
    expect(fixtureFingerprint(smallBuilding())).toBe(fixtureFingerprint(built));
  });

  it('has a different fingerprint from a building of another seed', () => {
    const other = buildingFixture('small-building', built.description, { ...smallBuildingOptions, seed: 99 });
    expect(fixtureFingerprint(other)).not.toBe(fixtureFingerprint(built));
  });
});

describe('the ten thousand object building', () => {
  const built = tenThousandObjects();

  it('passes ten thousand addressable objects', () => {
    expect(built.model.objects.length).toBeGreaterThanOrEqual(10_000);
    expect(built.geometry.instances.count).toBe(built.model.objects.length);
  });

  it('is deterministic', () => {
    expect(fixtureFingerprint(tenThousandObjects())).toBe(fixtureFingerprint(built));
  });
});

describe('the stress scene', () => {
  const built = stressScene();

  it('draws ten thousand instances inside the ten million triangle budget', () => {
    expect(built.geometry.instances.count).toBe(10_000);
    expect(built.triangleCount).toBeLessThanOrEqual(10_000_000);
    expect(built.triangleCount).toBe(drawnTriangles(built.geometry));
  });

  it('shares a small mesh library, which is what makes it an instancing workload', () => {
    expect(built.geometry.meshes.length).toBeLessThan(built.geometry.instances.count / 100);
  });

  it('publishes no tables', () => {
    expect(built.tables).toEqual([]);
  });

  it('is deterministic', () => {
    expect(fixtureFingerprint(stressScene())).toBe(fixtureFingerprint(built));
  });
});
