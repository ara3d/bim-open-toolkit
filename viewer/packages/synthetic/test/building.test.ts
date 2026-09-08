import { describe, expect, it } from 'vitest';
import {
  columnOf,
  geometryBounds,
  isEmptyBounds,
  isGeometryFree,
  isNumericColumn,
  noMesh,
  type ObjectRecord,
  type Table,
} from '@bim-open-toolkit/model';
import { defaultBuildingOptions, generateBuilding, type Building, type BuildingOptions } from '../src/building.js';

// The strings of a named column, refusing anything else so a renamed column fails loudly.
function strings(source: Table, name: string): readonly string[] {
  const column = columnOf(source, name);
  if (column === undefined || column.type !== 'string') throw new Error(`no string column named ${name}`);
  return column.values;
}

// The numbers of a named column.
function numbers(source: Table, name: string): readonly number[] {
  const column = columnOf(source, name);
  if (column === undefined || !isNumericColumn(column)) throw new Error(`no numeric column named ${name}`);
  return [...column.values];
}

// The booleans of a named column.
function booleans(source: Table, name: string): readonly boolean[] {
  const column = columnOf(source, name);
  if (column === undefined || column.type !== 'bool') throw new Error(`no boolean column named ${name}`);
  return [...column.values].map((value) => value !== 0);
}

// Options with the given overrides applied to the defaults.
const withOptions = (overrides: Partial<BuildingOptions>): BuildingOptions => ({ ...defaultBuildingOptions, ...overrides });

// The object records of one category.
const ofCategory = (building: Building, category: string): readonly ObjectRecord[] =>
  building.model.objects.filter((record) => record.category === category);

// The centre on z of a placed object, and the height of a box placed by a scaled unit cube. The
// transform is column-major, so the translation is at 12 to 14 and the z scale at 10.
const centreZ = (record: ObjectRecord): number => record.transform[14];
const heightZ = (record: ObjectRecord): number => record.transform[10];

// The underside and the top of a box placed by a scaled unit cube.
const undersideZ = (record: ObjectRecord): number => centreZ(record) - heightZ(record) / 2;
const topZ = (record: ObjectRecord): number => centreZ(record) + heightZ(record) / 2;

describe('generateBuilding options', () => {
  it('rejects options that cannot produce a building', () => {
    expect(() => generateBuilding(withOptions({ storeys: 0 }))).toThrow(/storeys/);
    expect(() => generateBuilding(withOptions({ roomsPerStorey: 0 }))).toThrow(/roomsPerStorey/);
    expect(() => generateBuilding(withOptions({ storeyHeight: 0.2 }))).toThrow(/storeyHeight/);
    expect(() => generateBuilding(withOptions({ gapScale: -1 }))).toThrow(/gapScale/);
    expect(() => generateBuilding(withOptions({ seed: 1.5 }))).toThrow(/seed/);
  });
});

describe('generateBuilding determinism', () => {
  it('gives identical output for the same options', () => {
    const options = withOptions({ seed: 42, storeys: 4, roomsPerStorey: 9 });
    expect(generateBuilding(options)).toEqual(generateBuilding(options));
  });

  it('gives identical output when the options record is a different object with the same values', () => {
    const first = generateBuilding({ seed: 7, storeys: 2, roomsPerStorey: 6, doorWidthPolicy: 'mixed', storeyHeight: 3.2, gapScale: 1 });
    const second = generateBuilding({ seed: 7, storeys: 2, roomsPerStorey: 6, doorWidthPolicy: 'mixed', storeyHeight: 3.2, gapScale: 1 });
    expect(second.doorSchedule).toEqual(first.doorSchedule);
    expect(second.geometry.instances.transform).toEqual(first.geometry.instances.transform);
  });

  it('gives different output for different seeds', () => {
    const a = generateBuilding(withOptions({ seed: 1, storeys: 3, roomsPerStorey: 9 }));
    const b = generateBuilding(withOptions({ seed: 2, storeys: 3, roomsPerStorey: 9 }));
    expect(strings(b.roomSchedule, 'name')).not.toEqual(strings(a.roomSchedule, 'name'));
    expect(b.geometry.instances.transform).not.toEqual(a.geometry.instances.transform);
  });

  it('changes the model revision with the seed, so two buildings are never confused', () => {
    expect(generateBuilding(withOptions({ seed: 5 })).model.ref.revision).toBe('seed-5');
    expect(generateBuilding(withOptions({ seed: 6 })).model.ref.revision).toBe('seed-6');
  });
});

describe('generateBuilding objects and geometry', () => {
  const building = generateBuilding(withOptions({ seed: 11, storeys: 4, roomsPerStorey: 9 }));

  it('emits one instance row per object, in the same order', () => {
    expect(building.geometry.instances.count).toBe(building.model.objects.length);
    for (let row = 0; row < building.geometry.instances.count; row++) {
      expect(building.geometry.instances.objectIndex[row]).toBe(row);
    }
  });

  it('gives every object a unique identity in one model revision', () => {
    const ids = building.model.objects.map((record) => record.ref.objectId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const record of building.model.objects) {
      expect(record.ref.modelId).toBe(building.model.ref.id);
      expect(record.ref.revision).toBe(building.model.ref.revision);
    }
  });

  it('produces every category the room and door schedule needs', () => {
    for (const category of ['Storey', 'Room', 'Wall', 'Slab', 'Door', 'Window']) {
      expect(ofCategory(building, category).length).toBeGreaterThan(0);
    }
    expect(ofCategory(building, 'Storey').length).toBe(4);
    expect(ofCategory(building, 'Slab').length).toBe(4);
    expect(ofCategory(building, 'Room').length).toBe(36);
  });

  it('draws every instance with a mesh that exists, or with none at all', () => {
    for (let row = 0; row < building.geometry.instances.count; row++) {
      const index = building.geometry.instances.meshIndex[row];
      expect(index).toBeDefined();
      if (index !== undefined && index !== noMesh) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(building.geometry.meshes.length);
      }
    }
  });

  it('leaves storeys and rooms geometry-free and draws everything else', () => {
    building.model.objects.forEach((record, row) => {
      const free = record.category === 'Storey' || record.category === 'Room';
      expect(isGeometryFree(building.geometry.instances, row)).toBe(free);
      expect(record.representation === undefined).toBe(free);
    });
  });

  it('names every mesh group and counts its instances', () => {
    expect(building.meshGroups.length).toBe(building.geometry.meshes.length);
    building.meshGroups.forEach((group, index) => {
      expect(group.name).not.toBe('');
      expect(group.mesh).toBe(building.geometry.meshes[index]);
      let counted = 0;
      for (let row = 0; row < building.geometry.instances.count; row++) {
        if (building.geometry.instances.meshIndex[row] === index) counted += 1;
      }
      expect(group.instanceCount).toBe(counted);
    });
    const drawn = building.meshGroups.reduce((total, group) => total + group.instanceCount, 0);
    const free = building.model.objects.filter((record) => record.representation === undefined).length;
    expect(drawn + free).toBe(building.geometry.instances.count);
  });

  it('shares a handful of meshes across many instances', () => {
    expect(building.geometry.meshes.length).toBeLessThan(12);
    expect(building.geometry.instances.count).toBeGreaterThan(building.geometry.meshes.length * 10);
  });

  it('stacks the storeys to the height the options ask for', () => {
    const bounds = geometryBounds(building.geometry);
    expect(isEmptyBounds(bounds)).toBe(false);
    // The slab of level 1 sits below zero, and the top storey's walls stop a slab short of 4 storeys.
    expect(bounds.min[2]).toBeCloseTo(-0.25, 6);
    expect(bounds.max[2]).toBeCloseTo(3 * 3.6 + 3.6 - 0.25, 6);
  });
});

describe('generateBuilding door schedule', () => {
  const building = generateBuilding(withOptions({ seed: 3, storeys: 6, roomsPerStorey: 12 }));
  const schedule = building.doorSchedule;

  it('has one row per door object', () => {
    expect(schedule.rowCount).toBe(ofCategory(building, 'Door').length);
    expect(strings(schedule, 'objectId')).toEqual(ofCategory(building, 'Door').map((record) => record.ref.objectId));
  });

  it('records three observations per door as facts', () => {
    expect(building.facts.length).toBe(schedule.rowCount * 3);
    const names = new Set(building.facts.map((item) => item.name));
    expect([...names].sort()).toEqual(['clearWidth', 'fireRating', 'nominalWidth']);
  });

  it('never reports an unknown width as a number', () => {
    for (const field of ['nominalWidth', 'clearWidth']) {
      const states = strings(schedule, `${field}State`);
      const values = numbers(schedule, field);
      states.forEach((state, row) => {
        const value = values[row] ?? Number.NaN;
        if (state === 'known') {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThan(0);
        } else {
          expect(Number.isNaN(value)).toBe(true);
        }
      });
    }
  });

  it('gives every absent value a reason and every dispute its values', () => {
    for (const field of ['nominalWidth', 'clearWidth', 'fireRating']) {
      const states = strings(schedule, `${field}State`);
      const reasons = strings(schedule, `${field}MissingReason`);
      const conflicts = strings(schedule, `${field}Conflict`);
      states.forEach((state, row) => {
        expect(['known', 'missing', 'conflicting']).toContain(state);
        expect(reasons[row] === '').toBe(state !== 'missing');
        expect(conflicts[row] === '').toBe(state !== 'conflicting');
        if (state === 'conflicting') expect(conflicts[row]).toContain(' vs ');
      });
    }
  });

  it('cites a source for every observation it can', () => {
    const evidence = strings(schedule, 'fireRatingEvidence');
    expect(evidence.every((item) => item.includes('door-type'))).toBe(true);
    expect(evidence.some((item) => item.includes('fire-strategy-drawing'))).toBe(true);
  });

  it('counts coverage that agrees with the state column', () => {
    const count = (field: string, state: string): number => strings(schedule, `${field}State`).filter((item) => item === state).length;
    for (const [field, coverage] of [
      ['nominalWidth', building.doorCoverage.nominalWidth],
      ['clearWidth', building.doorCoverage.clearWidth],
      ['fireRating', building.doorCoverage.fireRating],
    ] as const) {
      expect(coverage.total).toBe(schedule.rowCount);
      expect(coverage.known).toBe(count(field, 'known'));
      expect(coverage.missing).toBe(count(field, 'missing'));
      expect(coverage.conflicting).toBe(count(field, 'conflicting'));
      expect(coverage.known + coverage.missing + coverage.conflicting).toBe(coverage.total);
    }
  });

  // The rarest gap is drawn at four per cent, so this uses a building large enough that seeing none
  // of it would mean the generator is wrong rather than that the sample was small.
  it('leaves real exceptions for the workflow to show', () => {
    const large = generateBuilding(withOptions({ seed: 3, storeys: 10, roomsPerStorey: 24 }));
    expect(large.doorSchedule.rowCount).toBeGreaterThan(250);
    expect(large.doorCoverage.nominalWidth.missing).toBeGreaterThan(0);
    expect(large.doorCoverage.nominalWidth.conflicting).toBeGreaterThan(0);
    expect(large.doorCoverage.clearWidth.missing).toBeGreaterThan(0);
    expect(large.doorCoverage.fireRating.missing).toBeGreaterThan(0);
    expect(large.doorCoverage.fireRating.conflicting).toBeGreaterThan(0);
    expect(booleans(large.doorSchedule, 'nameKnown').some((known) => !known)).toBe(true);
    expect(booleans(large.roomSchedule, 'storeyKnown').some((known) => !known)).toBe(true);
  });

  it('separates a rating that does not apply from one nobody entered', () => {
    const reasons = new Set(strings(schedule, 'fireRatingMissingReason').filter((item) => item !== ''));
    expect(reasons).toContain('not-applicable');
    expect(reasons).toContain('not-provided');
  });
});

describe('generateBuilding width policy', () => {
  it('records no clear width at all under nominal-only', () => {
    const building = generateBuilding(withOptions({ seed: 4, storeys: 2, roomsPerStorey: 9, doorWidthPolicy: 'nominal-only' }));
    expect(building.doorCoverage.clearWidth.known).toBe(0);
    expect(building.doorCoverage.clearWidth.missing).toBe(building.doorCoverage.clearWidth.total);
    expect(new Set(strings(building.doorSchedule, 'clearWidthMissingReason'))).toEqual(new Set(['not-measured']));
  });

  it('records a clear width wherever the nominal width is known under nominal-and-clear', () => {
    const building = generateBuilding(withOptions({ seed: 4, storeys: 2, roomsPerStorey: 9, doorWidthPolicy: 'nominal-and-clear' }));
    const nominal = strings(building.doorSchedule, 'nominalWidthState');
    const clear = strings(building.doorSchedule, 'clearWidthState');
    nominal.forEach((state, row) => {
      expect(clear[row]).toBe(state === 'known' ? 'known' : 'missing');
    });
    expect(building.doorCoverage.clearWidth.known).toBe(building.doorCoverage.nominalWidth.known);
  });

  it('records a clear width for some but not all doors under mixed', () => {
    const building = generateBuilding(withOptions({ seed: 4, storeys: 4, roomsPerStorey: 12, doorWidthPolicy: 'mixed' }));
    expect(building.doorCoverage.clearWidth.known).toBeGreaterThan(0);
    expect(building.doorCoverage.clearWidth.missing).toBeGreaterThan(0);
  });

  it('reports a clear width narrower than the nominal width it came from', () => {
    const building = generateBuilding(withOptions({ seed: 8, storeys: 3, roomsPerStorey: 9, doorWidthPolicy: 'nominal-and-clear' }));
    const nominal = numbers(building.doorSchedule, 'nominalWidth');
    const clear = numbers(building.doorSchedule, 'clearWidth');
    const states = strings(building.doorSchedule, 'clearWidthState');
    states.forEach((state, row) => {
      if (state !== 'known') return;
      const wide = nominal[row] ?? Number.NaN;
      const narrow = clear[row] ?? Number.NaN;
      expect(narrow).toBeLessThan(wide);
    });
  });
});

describe('generateBuilding gap scale', () => {
  it('leaves nothing unknown or disputed at gapScale 0, apart from what does not apply', () => {
    const building = generateBuilding(
      withOptions({ seed: 9, storeys: 3, roomsPerStorey: 12, doorWidthPolicy: 'nominal-and-clear', gapScale: 0 }),
    );
    expect(building.doorCoverage.nominalWidth.known).toBe(building.doorCoverage.nominalWidth.total);
    expect(building.doorCoverage.clearWidth.known).toBe(building.doorCoverage.clearWidth.total);
    expect(building.doorCoverage.fireRating.conflicting).toBe(0);
    expect(new Set(strings(building.doorSchedule, 'fireRatingMissingReason').filter((item) => item !== ''))).toEqual(
      new Set(['not-applicable']),
    );
    expect(booleans(building.roomSchedule, 'storeyKnown').every((known) => known)).toBe(true);
  });

  it('opens more gaps as gapScale rises', () => {
    const low = generateBuilding(withOptions({ seed: 9, storeys: 4, roomsPerStorey: 12, gapScale: 0.5 }));
    const high = generateBuilding(withOptions({ seed: 9, storeys: 4, roomsPerStorey: 12, gapScale: 2 }));
    expect(high.doorCoverage.nominalWidth.known).toBeLessThan(low.doorCoverage.nominalWidth.known);
  });
});

describe('generateBuilding room schedule', () => {
  const building = generateBuilding(withOptions({ seed: 12, storeys: 5, roomsPerStorey: 12 }));

  it('has one row per room', () => {
    expect(building.roomSchedule.rowCount).toBe(60);
    expect(building.roomSchedule.rowCount).toBe(ofCategory(building, 'Room').length);
  });

  it('gives every room a positive area', () => {
    for (const area of numbers(building.roomSchedule, 'areaM2')) {
      expect(area).toBeGreaterThan(1);
      expect(Number.isFinite(area)).toBe(true);
    }
  });

  it('shows which rooms lost their storey link rather than guessing one', () => {
    const known = booleans(building.roomSchedule, 'storeyKnown');
    const storeys = strings(building.roomSchedule, 'storey');
    known.forEach((isKnown, row) => {
      expect(storeys[row] === '').toBe(!isKnown);
    });
    expect(known.some((isKnown) => !isKnown)).toBe(true);
    building.model.objects
      .filter((record) => record.category === 'Room')
      .forEach((record, row) => {
        expect(record.parentId === undefined).toBe(known[row] === false);
      });
  });

  it('counts the doors of each room', () => {
    const counts = numbers(building.roomSchedule, 'doorCount');
    expect(counts.reduce((total, count) => total + count, 0)).toBe(building.doorSchedule.rowCount);
    for (const count of counts) expect([1, 2]).toContain(count);
  });
});

describe('generateBuilding roof and ceilings', () => {
  const options = withOptions({ seed: 11, storeys: 4, roomsPerStorey: 9 });
  const plain = generateBuilding(options);
  const covered = generateBuilding({ ...options, roof: true, ceilings: true });

  // The one object with the given id, refusing anything else so a renamed object fails loudly.
  function objectById(building: Building, objectId: string): ObjectRecord {
    const found = building.model.objects.find((record) => record.ref.objectId === objectId);
    if (found === undefined) throw new Error(`no object named ${objectId}`);
    return found;
  }

  // The storey number in an object id of the form `door-3-2-1`.
  function storeyOf(objectId: string): string {
    const [, storey] = objectId.split('-');
    if (storey === undefined) throw new Error(`no storey number in ${objectId}`);
    return storey;
  }

  it('generates neither unless they are asked for', () => {
    expect(ofCategory(plain, 'Roof')).toEqual([]);
    expect(ofCategory(plain, 'Ceiling')).toEqual([]);
  });

  it('gives an options record written before they existed the building it always gave', () => {
    const before = generateBuilding({ seed: 1, storeys: 3, roomsPerStorey: 8, doorWidthPolicy: 'mixed', storeyHeight: 3.6, gapScale: 1 });
    const now = generateBuilding(defaultBuildingOptions);
    expect(before.model).toEqual(now.model);
    expect(before.geometry).toEqual(now.geometry);
    expect(before.doorSchedule).toEqual(now.doorSchedule);
    expect(before.roomSchedule).toEqual(now.roomSchedule);
    // The count the fixture snapshot records, and what other packages build on.
    expect(now.model.objects.length).toBe(150);
  });

  it('adds them to the building it would otherwise have generated, changing nothing else', () => {
    expect(covered.model.objects.length).toBe(plain.model.objects.length + 1 + options.storeys);
    expect(covered.model.objects.slice(0, plain.model.objects.length)).toEqual(plain.model.objects);
    expect(covered.facts).toEqual(plain.facts);
    expect(covered.doorSchedule).toEqual(plain.doorSchedule);
    expect(covered.roomSchedule).toEqual(plain.roomSchedule);
  });

  it('names their mesh groups without moving the ones that were there', () => {
    const names = covered.meshGroups.map((group) => group.name);
    expect(names.slice(0, plain.meshGroups.length)).toEqual(plain.meshGroups.map((group) => group.name));
    expect(names.slice(plain.meshGroups.length)).toEqual(['roof-slab', 'ceiling-panel']);
  });

  it('adds each of them on its own', () => {
    const roofOnly = generateBuilding({ ...options, roof: true });
    expect(ofCategory(roofOnly, 'Roof').length).toBe(1);
    expect(ofCategory(roofOnly, 'Ceiling')).toEqual([]);
    const ceilingsOnly = generateBuilding({ ...options, ceilings: true });
    expect(ofCategory(ceilingsOnly, 'Roof')).toEqual([]);
    expect(ofCategory(ceilingsOnly, 'Ceiling').length).toBe(options.storeys);
    expect(ceilingsOnly.meshGroups.map((group) => group.name)).toContain('ceiling-panel');
  });

  it('puts one roof on the top storey, over the whole plan', () => {
    const roof = objectById(covered, 'roof');
    const slab = objectById(covered, 'slab-1');
    expect(ofCategory(covered, 'Roof').length).toBe(1);
    expect(roof.category).toBe('Roof');
    expect(roof.parentId).toBe('storey-4');
    expect(heightZ(roof)).toBeCloseTo(0.25, 6);
    // It takes the place the floor slab of a fifth storey would have occupied.
    expect(undersideZ(roof)).toBeCloseTo(4 * 3.6 - 0.25, 6);
    expect(roof.transform[0]).toBeCloseTo(slab.transform[0], 6);
    expect(roof.transform[5]).toBeCloseTo(slab.transform[5], 6);
  });

  it('sits the roof above every wall of the top storey', () => {
    const roof = objectById(covered, 'roof');
    const topWalls = ofCategory(covered, 'Wall').filter((record) => record.parentId === 'storey-4');
    expect(topWalls.length).toBeGreaterThan(0);
    for (const wall of ofCategory(covered, 'Wall')) {
      expect(undersideZ(roof)).toBeGreaterThanOrEqual(topZ(wall) - 1e-9);
    }
  });

  it('hangs one ceiling per storey against the underside of what is above it', () => {
    const ceilings = ofCategory(covered, 'Ceiling');
    expect(ceilings.length).toBe(options.storeys);
    ceilings.forEach((ceiling, index) => {
      expect(ceiling.ref.objectId).toBe(`ceiling-${index + 1}`);
      expect(ceiling.parentId).toBe(`storey-${index + 1}`);
      expect(heightZ(ceiling)).toBeCloseTo(0.03, 6);
      const above = index + 2 <= options.storeys ? objectById(covered, `slab-${index + 2}`) : objectById(covered, 'roof');
      expect(topZ(ceiling)).toBeCloseTo(undersideZ(above), 6);
    });
  });

  it('insets the ceilings from the exterior walls so they read as suspended', () => {
    const slab = objectById(covered, 'slab-1');
    for (const ceiling of ofCategory(covered, 'Ceiling')) {
      expect(ceiling.transform[0]).toBeLessThan(slab.transform[0]);
      expect(ceiling.transform[5]).toBeLessThan(slab.transform[5]);
      expect(ceiling.transform[12]).toBeCloseTo(slab.transform[12], 6);
      expect(ceiling.transform[13]).toBeCloseTo(slab.transform[13], 6);
    }
  });

  it('keeps every ceiling above the doors of its own storey', () => {
    const doors = ofCategory(covered, 'Door');
    expect(doors.length).toBeGreaterThan(0);
    for (const door of doors) {
      const ceiling = objectById(covered, `ceiling-${storeyOf(door.ref.objectId)}`);
      // A door leaf is its own mesh at true size, so its 2.1 m height is in the mesh, not the transform.
      expect(undersideZ(ceiling)).toBeGreaterThan(centreZ(door) + 2.1 / 2);
    }
  });
});

describe('generateBuilding size', () => {
  it('generates a ten-storey building well under a second', () => {
    const started = performance.now();
    const building = generateBuilding(withOptions({ seed: 21, storeys: 10, roomsPerStorey: 40 }));
    const elapsed = performance.now() - started;
    expect(building.model.objects.length).toBeGreaterThan(2000);
    expect(elapsed).toBeLessThan(500);
  });
});
