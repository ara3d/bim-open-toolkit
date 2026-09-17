import { describe, expect, it } from 'vitest';
import { generateBuilding, defaultBuildingOptions, type Building } from '@bim-open-toolkit/synthetic';
import { hasRepresentation, indexFacts, observationAt, type ObjectRecord } from '@bim-open-toolkit/model';
import { runDoorSchedule, type DoorScheduleInput, type ScheduleDoor } from '../src/01-door-schedule.js';
import { observationJson } from '../src/observation.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { valueOfResult } from './fixtures.js';

// The generated building states its facts as model `Fact`s and its links as object parents, so the
// schedule input is read off those rather than off the generator's own schedule table. Nothing here
// is workflow-specific: it is the shape of a `ModelData` plus its facts.
const of = (building: Building, category: string): readonly ObjectRecord[] =>
  building.model.objects.filter((record) => record.category === category);

const scheduleInput = (building: Building, exceptionFacts: readonly string[]): DoorScheduleInput => {
  const index = indexFacts(building.facts);
  const storeyOfRoom = new Map(of(building, 'Room').map((room) => [room.ref.objectId, room.parentId]));
  const names: readonly string[] = ['nominalWidth', 'clearWidth', 'fireRating'];
  const doors: readonly ScheduleDoor[] = of(building, 'Door').map((record) => ({
    objectId: record.ref.objectId,
    name: record.name ?? record.ref.objectId,
    storeyId: (record.parentId === undefined ? undefined : storeyOfRoom.get(record.parentId)) ?? null,
    roomId: record.parentId ?? null,
    hasGeometry: hasRepresentation(record),
    facts: Object.fromEntries(names.map((name) => [name, observationJson(observationAt(index, record.ref, name))])),
  }));
  return {
    model: building.model.ref,
    storeys: of(building, 'Storey').map((record) => ({
      storeyId: record.ref.objectId,
      name: record.name ?? record.ref.objectId,
    })),
    rooms: of(building, 'Room').map((record) => ({
      objectId: record.ref.objectId,
      name: record.name ?? record.ref.objectId,
      storeyId: record.parentId ?? '',
    })),
    doors,
    exceptionFacts,
  };
};

const building = generateBuilding(defaultBuildingOptions);
const input = scheduleInput(building, ['clearWidth', 'fireRating']);
const result = valueOfResult('generated door schedule', runDoorSchedule(input));
const gapsOf = (field: 'nominalWidth' | 'clearWidth' | 'fireRating'): number =>
  building.doorCoverage[field].missing + building.doorCoverage[field].conflicting;

describe('the door schedule on a generated building', () => {
  it('schedules every generated door', () => {
    expect(input.doors.length).toBeGreaterThan(0);
    expect(resultRows(result, 'schedule')).toHaveLength(input.doors.length);
  });

  it('reports exactly the gaps the generator documents, as exceptions', () => {
    expect(exceptionRows(result)).toHaveLength(gapsOf('clearWidth') + gapsOf('fireRating'));
    expect(gapsOf('clearWidth') + gapsOf('fireRating')).toBeGreaterThan(0);
  });

  it('reports the same coverage the generator counted, column by column', () => {
    expect(result.summary['coverage']).toEqual({
      nominalWidth: { ...building.doorCoverage.nominalWidth },
      clearWidth: { ...building.doorCoverage.clearWidth },
      fireRating: { ...building.doorCoverage.fireRating },
    });
  });

  it('leaves only stated non-applicability when the generator is asked for a building with no gaps', () => {
    const complete = generateBuilding({ ...defaultBuildingOptions, gapScale: 0 });
    const completeResult = valueOfResult(
      'generated door schedule',
      runDoorSchedule(scheduleInput(complete, ['clearWidth', 'fireRating'])),
    );
    // A door in a room whose use is not fire rated has no rating to record. That is not a gap in
    // the data, and the reason says so, which is why it still belongs in the exceptions table.
    expect(completeResult.exceptions.every((item) => item.observation.kind === 'missing')).toBe(true);
    expect(new Set(exceptionRows(completeResult).map((row) => row['reason']))).toEqual(
      new Set(['not-applicable']),
    );
  });
});
