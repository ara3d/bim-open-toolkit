/**
 * The Snowdon box preview and full frame, timed in a real browser against the plan's 2 s budget.
 *
 * The kill criterion (`docs/plans/coarse-first-frame.md`) is 700 ms from bytes in hand to the
 * submitted preview frame: past that, deriving the preview at load time cannot leave room for the
 * full model's own cost inside a 2 s warm first frame. This test measures that number, and the same
 * number for the full frame, on the real Snowdon file, in a real browser with a real WebGL context.
 *
 * A local HTTP server serves the bundled page and the model bytes, because the model is 106 MB: too
 * large for a `data:` URL, and a page that fetches it the way a host would rather than one carrying
 * it inline. The page itself measures elapsed time from its own `fetch` resolving, so the server and
 * the browser's navigation are outside what is timed.
 *
 * Private data is never committed. When the model or a browser is absent, this prints why and passes.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Rollup } from 'vite';
import { describe, expect, it } from 'vitest';
import { artifactsFor, browserAvailability, runInBrowser } from '@bim-open-toolkit/testing';

const packagesDir = fileURLToPath(new URL('../../../', import.meta.url));
const viewerCore = fileURLToPath(new URL('../../../core/dist/index.js', import.meta.url));
const entry = fileURLToPath(new URL('./preview-page.ts', import.meta.url));

const modelPath =
  process.env['SNOWDON_BFAST_PATH'] ??
  'C:/Users/cdigg/git/bim-open-toolkit/viz/packages/visualization/artifacts/bfast/snowdon-bim.bfast';

const timeout = 300_000;
const killCriterionMs = 700;

// What the page reports back, read loosely rather than assumed: a value that crossed JSON is unknown
// until it is checked.
type PerfResult = {
  readonly ok: boolean;
  readonly error: string | undefined;
  readonly previewMs: number | undefined;
  readonly fullMs: number | undefined;
  readonly count: number | undefined;
  readonly oversized: number | undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readPerfResult = (value: unknown): PerfResult => {
  if (!isRecord(value) || typeof value['ok'] !== 'boolean') throw new Error(`the page reported ${JSON.stringify(value)}, not a perf result`);
  const asString = (key: string): string | undefined => (typeof value[key] === 'string' ? (value[key] as string) : undefined);
  const asNumber = (key: string): number | undefined => (typeof value[key] === 'number' ? (value[key] as number) : undefined);
  return {
    ok: value['ok'],
    error: asString('error'),
    previewMs: asNumber('previewMs'),
    fullMs: asNumber('fullMs'),
    count: asNumber('count'),
    oversized: asNumber('oversized'),
  };
};

// The page as one bundled script: the same alias rules the viewer's own smoke test uses, so
// `@bim-open-toolkit/*` sibling packages resolve to source and `@ara3d/viewer-core` to its built dist.
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
      lib: { entry, formats: ['iife'], name: 'viewerPreviewPerfPage', fileName: () => 'page.js' },
    },
  });
  const outputs: readonly Rollup.OutputChunk[] = (Array.isArray(built) ? built : [built]).flatMap((one) =>
    'output' in one ? one.output.filter((part): part is Rollup.OutputChunk => part.type === 'chunk') : [],
  );
  const code = outputs.map((chunk) => chunk.code).join('\n');
  if (code.length === 0) throw new Error('the page bundled to nothing');
  return `<!doctype html>
<meta charset="utf-8">
<title>viewer preview perf</title>
<style>html,body{margin:0;height:100%}#viewport{width:100%;height:100%;display:block}</style>
<canvas id="viewport"></canvas>
<script>${code}</script>`;
};

// Serves the bundled page at "/" and the model bytes at "/model.bfast", on a random free port.
const serve = (page: string, path: string): Promise<{ readonly url: string; readonly close: () => Promise<void> }> =>
  new Promise((resolve) => {
    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
      if (request.url === '/model.bfast') {
        response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': String(statSync(path).size) });
        createReadStream(path).pipe(response);
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(page);
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${String(address.port)}/`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });

describe('the Snowdon box preview and full frame', () => {
  it(
    'measures milliseconds from bytes in hand to each submitted frame',
    async () => {
      if (!existsSync(modelPath)) {
        console.log(`\nSkipped: no prepared Snowdon BFAST at ${modelPath}. Set SNOWDON_BFAST_PATH to measure.`);
        return;
      }
      const available = await browserAvailability();
      if (!available.available) {
        console.log(`\nSkipped: ${available.reason ?? 'no browser launched'}`);
        return;
      }

      const page = await bundlePage();
      const server = await serve(page, modelPath);
      const out = artifactsFor(import.meta.url, 'preview-perf');
      await mkdir(out, { recursive: true });
      const perRunTimeoutMs = 120_000;

      try {
        // Two page loads, not one: the perf page reports and the test screenshots as soon as it
        // reaches the frame asked for, so the preview frame and the full frame are each captured with
        // Playwright's own screenshot (proven on this canvas by the browser smoke test), never through
        // `viewer.capture`'s `canvas.toBlob`, which a headless, software-rendered canvas is not proven
        // to resolve.
        const previewRun = await runInBrowser({
          url: `${server.url}?model=/model.bfast&stopAtPreview=1`,
          readyExpression: 'window.perfReady === true',
          script: 'JSON.stringify(window.perfResult)',
          screenshotPath: join(out, 'preview-frame.png'),
          timeoutMs: perRunTimeoutMs,
          collectGraphics: true,
        });
        expect(previewRun.pageErrors).toEqual([]);
        const preview = readPerfResult(JSON.parse(String(previewRun.value)));
        expect(preview.error).toBeUndefined();
        expect(preview.ok).toBe(true);
        expect(preview.previewMs).toBeDefined();

        const fullRun = await runInBrowser({
          url: `${server.url}?model=/model.bfast`,
          readyExpression: 'window.perfReady === true',
          script: 'JSON.stringify(window.perfResult)',
          screenshotPath: join(out, 'full-frame.png'),
          timeoutMs: perRunTimeoutMs,
          collectGraphics: true,
        });
        expect(fullRun.pageErrors).toEqual([]);
        const full = readPerfResult(JSON.parse(String(fullRun.value)));
        expect(full.error).toBeUndefined();
        expect(full.ok).toBe(true);
        expect(full.fullMs).toBeDefined();

        const previewMs = preview.previewMs ?? Number.NaN;
        const fullMs = full.fullMs ?? Number.NaN;
        console.log(
          `\n${fullRun.channel} ${fullRun.browserVersion}, ${fullRun.graphics?.renderer ?? 'unknown renderer'}\n` +
            `bytes in hand to preview frame: ${previewMs.toFixed(1)} ms\n` +
            `bytes in hand to full frame:    ${fullMs.toFixed(1)} ms\n` +
            `count: ${String(full.count)}, oversized: ${String(full.oversized)}\n` +
            `kill criterion (${String(killCriterionMs)} ms): ${previewMs > killCriterionMs ? 'TRIGGERED' : 'holds'}\n` +
            `PNGs written under ${out}`,
        );
      } finally {
        await server.close();
      }
    },
    timeout,
  );
});
