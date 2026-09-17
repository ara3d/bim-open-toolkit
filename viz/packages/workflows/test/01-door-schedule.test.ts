import { describe, expect, it } from 'vitest';
import { setKeys } from '@bim-open-toolkit/model';
import { doorScheduleInputSchema, runDoorSchedule } from '../src/01-door-schedule.js';
import { keyOf } from '../src/keys.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureInput, fixtureModel, loadFixture, valueOfResult } from './fixtures.js';

const fixture = loadFixture('01-door-schedule');
const parameters = { model: fixtureModel, exceptionFacts: ['fireRatingMinutes'] };
const input = fixtureInput(doorScheduleInputSchema, fixture, parameters);
const result = valueOfResult('door schedule', runDoorSchedule(input));

describe('door schedule', () => {
  it('produces the expected schedule rows', () => {
    expect(resultRows(result, 'schedule')).toEqual(fixture.expected['schedule']);
  });

  it('produces the expected exception rows', () => {
    expect(exceptionRows(result)).toEqual(fixture.expected['exceptions']);
  });

  it('schedules a door with no geometry and keeps it out of the overlays', () => {
    const geometryFree = result.sets.find((set) => set.id === 'door-schedule/geometry-free');
    expect(geometryFree === undefined ? [] : setKeys(geometryFree.members)).toEqual([
      keyOf(fixtureModel, 'D-104'),
    ]);
    expect(resultRows(result, 'schedule').map((row) => row['objectId'])).toContain('D-104');
    expect(result.overlays.map((overlay) => overlay.id)).toEqual([
      'door-schedule/D-103/fireRatingMinutes',
      'door-schedule/D-202/fireRatingMinutes',
      'door-schedule/D-203/fireRatingMinutes',
    ]);
  });

  it('colours by result and selects the exceptions', () => {
    expect(result.rules.map((rule) => rule.id)).toEqual([
      'door-schedule/resolved',
      'door-schedule/missing',
      'door-schedule/conflicting',
    ]);
    expect(result.view.selection).toEqual(['D-103', 'D-202', 'D-203'].map((id) => keyOf(fixtureModel, id)));
    expect(result.recipe.steps[0]?.command).toBe('model.open');
  });

  it('reports coverage of every scheduled fact, not only the reviewed one', () => {
    expect(result.summary['coverage']).toEqual({
      widthMm: { total: 8, known: 7, missing: 1, conflicting: 0 },
      fireRatingMinutes: { total: 8, known: 5, missing: 2, conflicting: 1 },
    });
  });

  it('refuses a doors table that repeats an id rather than losing a row', () => {
    const repeated = runDoorSchedule({ ...input, doors: [...input.doors, ...input.doors.slice(0, 1)] });
    expect(repeated.ok).toBe(false);
    expect(repeated.diagnostics.map((item) => item.code)).toEqual(['workflow/duplicate-id']);
  });
});
