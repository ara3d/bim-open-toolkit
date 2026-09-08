// Observations rendered as columns: every value kind reads, and a gap never reads as a value.

import { describe, expect, it } from 'vitest';
import { bounds, conflicting, flag, known, missing, quantity, reference, text, type Bounds, type ObjectRef } from '@bim-open-toolkit/model';
import {
  conflictOf,
  evidenceOf,
  missingReasonOf,
  observationState,
  observationText,
  quantityColumns,
  quantityNumber,
  quantityUnit,
  textColumns,
} from '../src/schedule.js';

const door: ObjectRef = { modelId: 'tower', revision: 'r1', objectId: 'door-1' };
const boxA: Bounds = { min: [0, 0, 0], max: [1, 2, 3] };
const boxB: Bounds = { min: [0, 0, 0], max: [1, 2, 4] };

describe('observation columns', () => {
  it('renders every value kind a conflict can hold, boxes included', () => {
    expect(conflictOf(conflicting([quantity(0.9, 'm'), quantity(1, 'm')]))).toBe('0.9 m vs 1 m');
    expect(conflictOf(conflicting([text('EI30'), flag(true)]))).toBe('EI30 vs true');
    expect(conflictOf(conflicting([reference(door), flag(false)]))).toBe('door-1 vs false');
    expect(conflictOf(conflicting([bounds(boxA), bounds(boxB)]))).toBe('0 0 0 to 1 2 3 vs 0 0 0 to 1 2 4');
  });

  it('reports a known box as known without pretending it is a number or a text', () => {
    const observation = known(bounds(boxA), [{ source: 'survey' }]);
    expect(observationState(observation)).toBe('known');
    expect(conflictOf(observation)).toBe('');
    expect(quantityNumber(observation)).toBeNaN();
    expect(quantityUnit(observation)).toBe('');
    expect(observationText(observation)).toBe('');
    expect(evidenceOf(observation)).toBe('survey');
  });

  it('leaves the value columns empty wherever the state is not known', () => {
    const observations = [known(quantity(0.9, 'm')), missing('not-measured'), conflicting([bounds(boxA), bounds(boxB)])];
    const columns = new Map(quantityColumns('bbox', observations));
    expect(columns.get('bbox')?.values[1]).toBeNaN();
    expect(columns.get('bboxState')?.values[2]).toBe('conflicting');
    expect(columns.get('bboxMissingReason')?.values[1]).toBe('not-measured');
    expect(columns.get('bboxConflict')?.values[2]).toBe('0 0 0 to 1 2 3 vs 0 0 0 to 1 2 4');
    expect(missingReasonOf(observations[1] ?? missing('not-provided'))).toBe('not-measured');
  });

  it('names the columns a text field produces', () => {
    const columns = textColumns('fireRating', [known(text('EI30'))]);
    expect(columns.map(([name]) => name)).toEqual([
      'fireRating',
      'fireRatingState',
      'fireRatingMissingReason',
      'fireRatingConflict',
      'fireRatingEvidence',
    ]);
  });
});
