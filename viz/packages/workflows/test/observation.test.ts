// Observations as workflow rows: every value kind reads as a scalar, and a box says where it is.

import { describe, expect, it } from 'vitest';
import {
  bounds,
  conflicting,
  flag,
  known,
  missing,
  quantity,
  reference,
  text,
  type Bounds,
  type ObjectRef,
} from '@bim-open-toolkit/model';
import { factScalar, observationCell, observationJson, unitOf } from '../src/observation.js';

const door: ObjectRef = { modelId: 'tower', revision: 'r1', objectId: 'door-1' };
const boxA: Bounds = { min: [0, 0, 0], max: [1, 2, 3] };
const boxB: Bounds = { min: [0, 0, 0], max: [1, 2, 4] };

describe('fact values as row scalars', () => {
  it('reads every kind, a box as its two corners', () => {
    expect(factScalar(quantity(0.9, 'm'))).toBe(0.9);
    expect(factScalar(text('EI30'))).toBe('EI30');
    expect(factScalar(flag(true))).toBe(true);
    expect(factScalar(reference(door))).toBe('tower|r1|door-1');
    expect(factScalar(bounds(boxA))).toBe('0 0 0 to 1 2 3');
  });

  it('reports no unit for a box, because a box is not a quantity', () => {
    expect(unitOf(bounds(boxA))).toBeUndefined();
    expect(unitOf(quantity(0.9, 'm'))).toBe('m');
  });

  it('writes a known box and a disputed one into a result cell', () => {
    expect(observationJson(known(bounds(boxA)))).toEqual({
      kind: 'known',
      value: '0 0 0 to 1 2 3',
      unit: undefined,
      evidence: undefined,
    });
    expect(observationCell(conflicting([bounds(boxA), bounds(boxB)], [{ source: 'survey' }]))).toEqual({
      kind: 'conflicting',
      values: ['0 0 0 to 1 2 3', '0 0 0 to 1 2 4'],
      evidence: [{ source: 'survey' }],
    });
  });

  it('still states a gap rather than a box', () => {
    expect(observationCell(missing('not-measured'))).toEqual({ kind: 'missing', reason: 'not-measured' });
  });
});
