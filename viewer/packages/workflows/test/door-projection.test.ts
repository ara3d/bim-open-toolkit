import { describe, expect, it } from 'vitest';
import { runDoorSchedule } from '../src/01-door-schedule.js';
import { doorScheduleFromProjection } from '../src/door-projection.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureModel, valueOfResult } from './fixtures.js';

// A hand-made sample in the shape of an `ara3d.building-workflow-projection` version 1 envelope.
// It is controlled data: no private artifact is read here, and none is needed to check the shape.
const projection = {
  Format: 'ara3d.building-workflow-projection',
  Version: 1,
  Model: {
    Snapshot: { Id: 'snapshot-1' },
    Evidence: [{ Id: 'ev-1', Origin: 'Source', Method: 'typed source measurement', Explanation: 'Nominal width' }],
    Doors: [
      {
        Id: { snapshot: 'snapshot-1', local: 'door-1' },
        Element: { ObjectId: 'door-1', Name: 'Door A', Evidence: [] },
        NominalWidth: { state: 'known', value: { Metres: 0.9 }, assurance: 'Observed', evidence: ['ev-1'] },
        ClearWidth: { state: 'missing', reason: 'NotObserved', explanation: 'No measurement supplied', evidence: [] },
      },
      {
        Id: { snapshot: 'snapshot-1', local: 'door-2' },
        Element: { ObjectId: 'door-2', Name: 'Door B', Evidence: [] },
        NominalWidth: { state: 'missing', reason: 'Conflicting', explanation: 'Two sources disagree', evidence: [] },
        ClearWidth: { state: 'missing', reason: 'NotApplicable', explanation: 'Not a swing door', evidence: [] },
      },
      {
        Id: { snapshot: 'snapshot-1', local: 'door-3' },
        Element: { ObjectId: 'door-3' },
        NominalWidth: { state: 'known', value: { Metres: 1.2 }, assurance: 'Derived', evidence: ['ev-missing'] },
      },
    ],
  },
};

const input = valueOfResult('projection', doorScheduleFromProjection(projection, { model: fixtureModel }));
const result = valueOfResult('projection schedule', runDoorSchedule(input));

describe('door schedule from a BuildingModel workflow projection', () => {
  it('schedules every door with nominal and clear width kept separate', () => {
    expect(resultRows(result, 'schedule')).toEqual([
      {
        objectId: 'door-1',
        name: 'Door A',
        storey: null,
        room: null,
        nominalWidth: { kind: 'known', value: 0.9, unit: 'm', evidence: [{ source: 'Source', reference: 'ev-1' }] },
        clearWidth: { kind: 'missing', reason: 'not-measured' },
      },
      {
        objectId: 'door-2',
        name: 'Door B',
        storey: null,
        room: null,
        nominalWidth: { kind: 'conflicting', values: [] },
        clearWidth: { kind: 'missing', reason: 'not-applicable' },
      },
      {
        objectId: 'door-3',
        name: 'door-3',
        storey: null,
        room: null,
        nominalWidth: { kind: 'known', value: 1.2, unit: 'm', evidence: [{ source: 'ev-missing' }] },
        clearWidth: { kind: 'missing', reason: 'not-provided' },
      },
    ]);
  });

  it('reports every unavailable width as an exception and never substitutes one for the other', () => {
    expect(exceptionRows(result)).toEqual([
      { subjects: ['door-1'], field: 'clearWidth', kind: 'missing', reason: 'not-measured' },
      { subjects: ['door-2'], field: 'nominalWidth', kind: 'conflicting', values: [] },
      { subjects: ['door-2'], field: 'clearWidth', kind: 'missing', reason: 'not-applicable' },
      { subjects: ['door-3'], field: 'clearWidth', kind: 'missing', reason: 'not-provided' },
    ]);
  });

  it('reports referenced evidence the projection does not carry, without dropping the reference', () => {
    const converted = doorScheduleFromProjection(projection, { model: fixtureModel });
    expect(converted.diagnostics.map((item) => item.code)).toEqual(['door-projection/unavailable-evidence']);
  });

  it('schedules every row as geometry-free until the loaded objects are named', () => {
    expect(result.sets.find((set) => set.id === 'door-schedule/geometry-free')?.members.size).toBe(3);
    const loaded = valueOfResult(
      'projection',
      doorScheduleFromProjection(projection, { model: fixtureModel, loadedObjectIds: ['door-1'] }),
    );
    expect(loaded.doors.filter((door) => door.hasGeometry).map((door) => door.objectId)).toEqual(['door-1']);
  });

  it('refuses a door whose identity disagrees with the projection snapshot', () => {
    const mismatched = {
      ...projection,
      Model: {
        ...projection.Model,
        Doors: [{ ...projection.Model.Doors[0], Id: { snapshot: 'other', local: 'door-1' } }],
      },
    };
    const converted = doorScheduleFromProjection(mismatched, { model: fixtureModel });
    expect(converted.ok).toBe(false);
    expect(converted.diagnostics.map((item) => item.code)).toEqual(['door-projection/inconsistent-identity']);
  });

  it('refuses an envelope of another format or version', () => {
    expect(doorScheduleFromProjection({ ...projection, Version: 2 }, { model: fixtureModel }).ok).toBe(false);
  });
});
