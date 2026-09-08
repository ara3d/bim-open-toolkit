// The one check that needs a browser: open `slice.html`, wait for the page to say it is ready,
// and read back what it reports. Skipped with a printed reason when no browser can be launched, so
// this file never turns a machine without one into a failure.
//
// Software WebGL is asked for the way the alpha's `browser-smoke.mjs` asks for it. The screenshot
// goes to `viewer/artifacts/slice/`, which git ignores.

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import type { Browser } from 'playwright-core';
import { sliceData } from '../../src/slice/data.js';

const configFile = fileURLToPath(new URL('../../vite.slice.config.mjs', import.meta.url));
const artifacts = fileURLToPath(new URL('../../../../artifacts/slice/', import.meta.url));
const screenshot = `${artifacts}slice.png`;

const describeCause = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

// A launched browser, or the reason there is none. Every channel is tried before giving up,
// because playwright-core ships no browser of its own.
const launch = async (): Promise<{ readonly browser: Browser } | { readonly reason: string }> => {
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const wanted = process.env['BROWSER_CHANNEL'];
  const channels = wanted === undefined ? ['msedge', 'chrome'] : [wanted];
  let last = 'no channel was tried';
  try {
    const { chromium } = await import('playwright-core');
    for (const channel of channels) {
      try {
        return { browser: await chromium.launch({ channel, headless: true, args }) };
      } catch (cause) {
        last = `${channel}: ${describeCause(cause)}`;
      }
    }
  } catch (cause) {
    return { reason: `playwright-core could not be loaded: ${describeCause(cause)}` };
  }
  return { reason: `no chromium channel could be launched (${last})` };
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

const numberField = (source: Readonly<Record<string, unknown>>, name: string): number => {
  const value = source[name];
  if (typeof value !== 'number') throw new Error(`window.slice.${name} is not a number`);
  return value;
};

const localUrl = (server: ViteDevServer): string => {
  const first = server.resolvedUrls?.local[0];
  if (first === undefined) throw new Error('the vite server reported no local url');
  return first;
};

describe('the slice page', () => {
  it(
    'draws the building, reports its counts and logs no errors',
    async (context) => {
      const started = await launch();
      if ('reason' in started) {
        console.log(`Slice browser smoke skipped: ${started.reason}`);
        context.skip();
        return;
      }
      const browser = started.browser;
      let server: ViteDevServer | undefined;
      try {
        server = await createServer({ configFile, server: { port: 5176, strictPort: false } });
        await server.listen();
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        page.setDefaultTimeout(30_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(`${message.text()} @ ${message.location().url}`);
        });

        await page.goto(`${localUrl(server)}slice.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction('window.sliceReady === true || typeof window.sliceError === "string"', undefined, {
          timeout: 60_000,
        });
        expect(await page.evaluate<unknown>('window.sliceError')).toBeUndefined();
        // The first report is written before any interval has been measured, so wait for one.
        await page.waitForFunction('window.slice !== undefined && window.slice.lastFrameMs > 0', undefined, {
          timeout: 30_000,
        });

        // Click the middle of the canvas, which is a pick whether or not it lands on something.
        const box = await page.locator('#viewport').boundingBox();
        expect(box).not.toBeNull();
        if (box !== null) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        const readout = await page.locator('.slice-readout').innerText();
        expect(readout).not.toContain('Click an object');

        const reported = await page.evaluate<unknown>('window.slice');
        const captured = await page.evaluate<unknown>('window.sliceCapture()');
        await mkdir(artifacts, { recursive: true });
        await page.screenshot({ path: screenshot });
        console.log(
          `Slice browser smoke: ${JSON.stringify(reported)} · capture ${String(captured)} bytes · ` +
            `readout "${readout}" · screenshot ${screenshot}`,
        );
        expect(errors).toEqual([]);

        if (!isRecord(reported)) throw new Error('window.slice is not an object');
        const expected = sliceData();
        expect(numberField(reported, 'objects')).toBe(expected.keys.length);
        expect(numberField(reported, 'doors')).toBe(expected.coverage.total);
        expect(numberField(reported, 'unratedDoors')).toBe(expected.unratedDoors.length);
        expect(numberField(reported, 'instances')).toBe(123);
        expect(numberField(reported, 'styledRowsWritten')).toBeGreaterThan(0);
        expect(numberField(reported, 'lastFrameMs')).toBeGreaterThan(0);
        await page.close();
      } finally {
        await server?.close();
        await browser.close();
      }
    },
    180_000,
  );
});
