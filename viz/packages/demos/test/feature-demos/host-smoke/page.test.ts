// The one check of the host that needs a browser: the smoke page draws the building and reports.
// Skipped with a printed reason when no browser launches.

import { describe, expect, it } from 'vitest';
import { defaultBuildingOptions, generateBuilding } from '@bim-open-toolkit/synthetic';
import { reportedNumber, reportedString, runDemoPage } from '../_shared/browser.js';

describe('the host smoke page', () => {
  it(
    'draws the building with its roof and ceilings and reports counts and timing',
    async (context) => {
      const run = await runDemoPage({ page: 'host-smoke', port: 5180 });
      if ('skipped' in run) {
        console.log(`Host smoke skipped: ${run.skipped}`);
        context.skip();
        return;
      }
      console.log(`Host smoke: ${JSON.stringify(run.report)} · renderer ${run.renderer ?? 'unknown'} · ${run.elapsedMs} ms · ${run.screenshotPath}`);
      expect(run.error).toBeUndefined();
      expect(run.errors).toEqual([]);
      const building = generateBuilding({ ...defaultBuildingOptions, roof: true, ceilings: true });
      expect(reportedNumber(run.report, 'objects')).toBe(building.model.objects.length);
      expect(reportedNumber(run.report, 'instances')).toBeGreaterThan(0);
      expect(reportedNumber(run.report, 'frames')).toBeGreaterThan(0);
      expect(['available', 'EXT_disjoint_timer_query_webgl2 is not present', 'the canvas has no WebGL2 context']).toContain(
        reportedString(run.report, 'gpu'),
      );
    },
    180_000,
  );
});
