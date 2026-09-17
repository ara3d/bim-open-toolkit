import { describe, expect, it } from 'vitest';

const fixture = process.env.BIM_SNOWDON_FIXTURE;

// No fixture discovery or large parsing during ordinary tests. Run the script OR this opt-in gate.
describe.skipIf(!fixture)('actual normalized Snowdon integration', () => {
  it('preserves the pinned source identities, finite complete representations and cooperative abort', async () => {
    const { checkNormalizedSnowdon } = await import('../scripts/check-normalized-snowdon.mjs');
    const report = await checkNormalizedSnowdon(fixture);
    expect(report.counts.objects).toBe(51139);
    expect(report.counts.bindings).toBe(456598);
    expect(report.counts.triangles).toBe(6185680);
  }, 120000);
});
