// The one check that needs a browser: open `ambient-occlusion.html`, wait for the page to say it
// is ready, and measure what the pass does to the picture. Skipped with a printed reason when no
// browser can be launched, so this file never turns a machine without one into a failure.
//
// Software WebGL is asked for the way the slice's page test asks for it. The screenshots go to
// `viewer/artifacts/ambient-occlusion/`, which git ignores.

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import type { Browser, Page } from 'playwright-core';

const configFile = fileURLToPath(new URL('../../vite.ao.config.mjs', import.meta.url));
const artifacts = fileURLToPath(new URL('../../../../artifacts/ambient-occlusion/', import.meta.url));

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
  if (typeof value !== 'number') throw new Error(`${name} is not a number`);
  return value;
};

const localUrl = (server: ViteDevServer): string => {
  const first = server.resolvedUrls?.local[0];
  if (first === undefined) throw new Error('the vite server reported no local url');
  return first;
};

// Luminance statistics of the frame the page draws now, read through the page's own probe.
type Measured = { readonly mean: number; readonly min: number; readonly max: number; readonly darkShare: number };

const measure = async (page: Page): Promise<Measured> => {
  const found = await page.evaluate<unknown>('window.ambientOcclusionMeasure()');
  if (!isRecord(found)) throw new Error('the page measured nothing');
  return {
    mean: numberField(found, 'mean'),
    min: numberField(found, 'min'),
    max: numberField(found, 'max'),
    darkShare: numberField(found, 'darkShare'),
  };
};

const apply = async (page: Page, patch: Readonly<Record<string, string>>): Promise<void> => {
  const result = await page.evaluate<unknown>(`window.ambientOcclusionApply(${JSON.stringify(patch)})`);
  if (!isRecord(result) || result['ok'] !== true) throw new Error(`the page refused ${JSON.stringify(patch)}: ${JSON.stringify(result)}`);
};

describe('the ambient occlusion page', () => {
  it(
    'draws the building, darkens it with the pass, and shows an occlusion term that varies',
    async (context) => {
      const started = await launch();
      if ('reason' in started) {
        console.log(`Ambient occlusion browser smoke skipped: ${started.reason}`);
        context.skip();
        return;
      }
      const browser = started.browser;
      let server: ViteDevServer | undefined;
      try {
        server = await createServer({ configFile, server: { port: 5177, strictPort: false } });
        await server.listen();
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        page.setDefaultTimeout(30_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(`${message.text()} @ ${message.location().url}`);
        });

        await page.goto(`${localUrl(server)}ambient-occlusion.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(
          'window.ambientOcclusionReady === true || typeof window.ambientOcclusionError === "string"',
          undefined,
          { timeout: 60_000 },
        );
        expect(await page.evaluate<unknown>('window.ambientOcclusionError')).toBeUndefined();

        const reported = await page.evaluate<unknown>('window.ambientOcclusion');
        if (!isRecord(reported)) throw new Error('window.ambientOcclusion is not an object');
        expect(reported['fixture']).toBe('building');
        expect(numberField(reported, 'objects')).toBe(150);
        expect(numberField(reported, 'instances')).toBe(123);
        expect(reported['enabled']).toBe(true);
        expect(isRecord(reported['pass']) && numberField(reported['pass'], 'radius')).toBeGreaterThan(0);

        await mkdir(artifacts, { recursive: true });
        const shaded = await measure(page);
        await page.screenshot({ path: `${artifacts}building-shaded.png` });
        await apply(page, { enabled: 'false' });
        const plain = await measure(page);
        await page.screenshot({ path: `${artifacts}building-plain.png` });
        await apply(page, { enabled: 'true', output: 'occlusion' });
        const occlusion = await measure(page);
        await page.screenshot({ path: `${artifacts}building-occlusion.png` });

        // The pass darkens the picture; the term alone is white where open and darker where enclosed.
        expect(shaded.mean).toBeLessThan(plain.mean);
        expect(occlusion.max).toBeGreaterThan(0.9);
        expect(occlusion.min).toBeLessThan(0.8);
        expect(occlusion.mean).toBeLessThan(occlusion.max);

        const opened = await page.evaluate<unknown>('window.ambientOcclusionOpen("city")');
        expect(isRecord(opened) && opened['ok']).toBe(true);
        await apply(page, { output: 'shaded' });
        const city = await page.evaluate<unknown>('window.ambientOcclusion');
        if (!isRecord(city)) throw new Error('window.ambientOcclusion is not an object after opening the city');
        expect(city['fixture']).toBe('city');
        expect(numberField(city, 'objects')).toBeGreaterThan(0);
        expect(numberField(city, 'instances')).not.toBe(numberField(reported, 'instances'));
        await measure(page);
        await page.screenshot({ path: `${artifacts}city-shaded.png` });

        console.log(
          `Ambient occlusion browser smoke: ${String(reported['renderer'])} · shaded mean ${shaded.mean.toFixed(3)} · ` +
            `plain mean ${plain.mean.toFixed(3)} · occlusion min ${occlusion.min.toFixed(3)} max ${occlusion.max.toFixed(3)} ` +
            `dark share ${occlusion.darkShare.toFixed(3)} · screenshots in ${artifacts}`,
        );
        expect(errors).toEqual([]);
        await page.close();
      } finally {
        await server?.close();
        await browser.close();
      }
    },
    240_000,
  );
});
