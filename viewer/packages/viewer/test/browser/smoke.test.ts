// One browser run: the documented three lines on a real canvas with a real WebGL context.
//
// Everything else in this package is tested in Node against a renderer that counts. This is the one
// test that answers what none of them can: that `createViewer` on a real canvas draws a frame, and
// that nothing it does puts an error in the console.
//
// It skips, with the reason printed, on a machine where no chromium channel launches. `playwright-core`
// ships no browser of its own, so a machine with neither Edge nor Chrome is not a failure.

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { artifactsFor, browserAvailability, runInBrowser } from '@bim-open-toolkit/testing';
import { array, number, object, optional, parse, string } from '@bim-open-toolkit/model';
import { build, type Rollup } from 'vite';

const packagesDir = fileURLToPath(new URL('../../../', import.meta.url));
const viewerCore = fileURLToPath(new URL('../../../core/dist/index.js', import.meta.url));
const entry = fileURLToPath(new URL('./page.ts', import.meta.url));

// What the page hands back, checked rather than assumed: a value that crossed JSON is unknown.
const readback = object({
  smoke: optional(
    object({
      objects: number(),
      instances: number(),
      triangles: number(),
      framesDrawn: number(),
      redChannel: number(),
      views: array(string()),
      commands: number(),
      restoredSlices: array(string()),
    }),
  ),
  error: optional(string()),
});

// The page as one file: the same alias rules the tests and the demo vite config use, bundled into a
// single script so the run needs no server and no build step of its own.
const bundlePage = async (): Promise<string> => {
  const built = await build({
    logLevel: 'silent',
    configFile: false,
    resolve: {
      alias: [
        { find: /^@bim-open-toolkit\/(?!visualization)([^/]+)$/, replacement: `${packagesDir}$1/src/index.ts` },
        { find: /^@ara3d\/viewer-core$/, replacement: viewerCore },
      ],
    },
    build: {
      write: false,
      target: 'es2022',
      lib: { entry, formats: ['iife'], name: 'viewerSmokePage', fileName: () => 'page.js' },
    },
  });
  const outputs: readonly Rollup.OutputChunk[] = (Array.isArray(built) ? built : [built]).flatMap((one) =>
    'output' in one ? one.output.filter((part): part is Rollup.OutputChunk => part.type === 'chunk') : [],
  );
  const code = outputs.map((chunk) => chunk.code).join('\n');
  if (code.length === 0) throw new Error('the page bundled to nothing');
  return `<!doctype html>
<meta charset="utf-8">
<title>viewer smoke</title>
<style>html,body{margin:0;height:100%}#viewport{width:100%;height:100%;display:block}</style>
<canvas id="viewport"></canvas>
<script>${code}</script>`;
};

describe('createViewer in a browser', () => {
  it(
    'draws a frame and reports no console error',
    { timeout: 180_000 },
    async () => {
      const available = await browserAvailability();
      if (!available.available) {
        console.log(`skipped: ${available.reason ?? 'no browser'}`);
        return;
      }

      const out = artifactsFor(import.meta.url, 'browser');
      await mkdir(out, { recursive: true });
      const page = join(out, 'smoke.html');
      await writeFile(page, await bundlePage(), 'utf8');

      const result = await runInBrowser({
        url: `file://${page.replace(/\\/g, '/')}`,
        readyExpression: 'globalThis.viewerReady === true || typeof globalThis.viewerError === "string"',
        script: 'JSON.stringify({ smoke: globalThis.viewerSmoke, error: globalThis.viewerError })',
        screenshotPath: join(out, 'smoke.png'),
        collectGraphics: true,
      });

      expect(typeof result.value).toBe('string');
      const read = parse(readback, JSON.parse(String(result.value)));
      expect(read.ok ? read.value.error : read.diagnostics.map((one) => one.message).join('; ')).toBeUndefined();
      if (!read.ok) return;
      const smoke = read.value.smoke;
      expect(smoke).toBeDefined();
      if (smoke === undefined) return;
      expect(smoke.objects).toBe(2);
      expect(smoke.instances).toBe(2);
      expect(smoke.triangles).toBe(2);
      expect(smoke.framesDrawn).toBeGreaterThan(0);
      expect(smoke.redChannel).toBeCloseTo(1);
      expect([...smoke.views]).toEqual(['main']);
      expect([...smoke.restoredSlices]).toEqual(['viewer.appearance', 'viewer.models', 'viewer.view']);
      expect(result.consoleErrors).toEqual([]);
      expect(result.pageErrors).toEqual([]);
      console.log(
        `${result.channel} ${result.browserVersion}, ${result.graphics?.renderer ?? 'unknown renderer'}, ${String(
          result.elapsedMs,
        )} ms`,
      );
    },
  );
});
