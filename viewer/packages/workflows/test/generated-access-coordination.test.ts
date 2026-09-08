import { describe, expect, it } from 'vitest';
import { defaultClearanceOptions, generateClearances, type Clearances } from '@bim-open-toolkit/synthetic';
import { rowOf, type CellValue, type Table } from '@bim-open-toolkit/model';
import {
  runAccessCoordination,
  type AccessCoordinationInput,
  type BoxObservation,
  type CoordinationEnvelope,
} from '../src/07-access-coordination.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { valueOfResult } from './fixtures.js';

const textAt = (value: unknown): string => (typeof value === 'string' ? value : '');
const numberAt = (value: unknown): number => (typeof value === 'number' ? value : Number.NaN);

// `clearances.ts` writes a box observation across six numeric columns plus the same `bboxState` /
// `bboxMissingReason` / `bboxConflict` columns `schedule.ts` produces for a scalar field. A disputed
// box is published as the bounds each source stated, rendered as text, which is exactly what a
// `BoxObservation` conflict carries: this workflow shows both and uses neither.
const boxObservationOf = (cells: Readonly<Record<string, CellValue>>): BoxObservation => {
  const state = textAt(cells['bboxState']);
  if (state === 'known') {
    return {
      kind: 'known',
      value: {
        minX: numberAt(cells['minX']),
        minY: numberAt(cells['minY']),
        minZ: numberAt(cells['minZ']),
        maxX: numberAt(cells['maxX']),
        maxY: numberAt(cells['maxY']),
        maxZ: numberAt(cells['maxZ']),
      },
    };
  }
  if (state === 'missing') return { kind: 'missing', reason: 'not-provided' };
  return { kind: 'conflicting', values: textAt(cells['bboxConflict']).split(' vs ') };
};

// `CoordinationEnvelope` and `CoordinationPenetration` are the same shape; either name reads either
// participant table.
const participantsOf = (source: Table): readonly CoordinationEnvelope[] =>
  Array.from({ length: source.rowCount }, (_, row) => {
    const cells = rowOf(source, row);
    return { objectId: textAt(cells['objectId']), discipline: textAt(cells['discipline']), bbox: boxObservationOf(cells) };
  });

const accessInputOf = (clearances: Clearances): AccessCoordinationInput => ({
  model: clearances.model.ref,
  envelopeFrame: clearances.coordinates,
  penetrationFrame: clearances.coordinates,
  envelopes: participantsOf(clearances.envelopes),
  penetrations: participantsOf(clearances.penetrations),
});

const clearances = generateClearances(defaultClearanceOptions);
const input = accessInputOf(clearances);
const result = valueOfResult('generated access coordination', runAccessCoordination(input));

describe('access coordination on a generated set of envelopes and penetrations', () => {
  it('reports exactly the unregistered and disputed participants the generator documents, as exceptions', () => {
    const gapCount = [...input.envelopes, ...input.penetrations].filter((item) => item.bbox.kind !== 'known').length;
    expect(gapCount).toBeGreaterThan(0);
    expect(exceptionRows(result)).toHaveLength(gapCount);
  });

  it('finds exactly the overlaps the generator counted as candidates', () => {
    expect(resultRows(result, 'candidateFindings')).toHaveLength(clearances.candidateOverlaps);
  });

  it('never calls a candidate overlap a verified clash', () => {
    const rows = resultRows(result, 'candidateFindings');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row['basis'] === 'bounding-box-overlap')).toBe(true);
  });

  it('leaves no exception when every participant is registered and undisputed', () => {
    const complete = generateClearances({ ...defaultClearanceOptions, gapScale: 0 });
    const completeResult = valueOfResult(
      'generated access coordination (complete)',
      runAccessCoordination(accessInputOf(complete)),
    );
    expect(exceptionRows(completeResult)).toEqual([]);
  });
});
