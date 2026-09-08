import { describe, expect, it } from 'vitest';
import { assetHandoverInputSchema, runAssetHandover } from '../src/08-asset-handover.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureInput, fixtureModel, loadFixture, valueOfResult } from './fixtures.js';

const fixture = loadFixture('08-asset-handover');
const input = fixtureInput(assetHandoverInputSchema, fixture, { model: fixtureModel });
const result = valueOfResult('asset handover', runAssetHandover(input));

describe('asset handover and maintenance', () => {
  it('produces the expected handover rows', () => {
    expect(resultRows(result, 'handover')).toEqual(fixture.expected['handover']);
  });

  it('produces the expected exception rows', () => {
    expect(exceptionRows(result)).toEqual(fixture.expected['exceptions']);
  });

  it('refuses an assets table that repeats an id rather than losing a row', () => {
    const repeated = runAssetHandover({ ...input, assets: [...input.assets, ...input.assets.slice(0, 1)] });
    expect(repeated.ok).toBe(false);
    expect(repeated.diagnostics.map((item) => item.code)).toEqual(['workflow/duplicate-id']);
  });
});
