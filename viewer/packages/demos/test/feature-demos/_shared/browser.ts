// Runs one feature demo page in a real browser and reads back what it reports.
//
// A Vite dev server is started on the track's own port with the shared config, the page is opened
// through the testing package's playwright-core runner with software WebGL, and the result is the
// page's report plus every console and page error. When no browser launches here the run says so
// instead of failing, so a machine without Edge or Chrome never turns this into a red test.
//
// Screenshots go to `viewer/artifacts/feature-demos/`, which git ignores.

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { browserAvailability, runInBrowser } from '@bim-open-toolkit/testing';
import { demoReadyExpression, demoReportExpression } from '../../../src/feature-demos/_shared/protocol.js';

const configFile = fileURLToPath(new URL('../../../vite.feature-demos.config.mjs', import.meta.url));
const artifacts = fileURLToPath(new URL('../../../../../artifacts/feature-demos/', import.meta.url));

// What a run came to: the page's report, or the reason nothing ran.
export type DemoRun =
  | { readonly skipped: string }
  | {
      readonly error: string | undefined;
      readonly report: Readonly<Record<string, unknown>>;
      readonly errors: readonly string[];
      readonly renderer: string | undefined;
      readonly screenshotPath: string;
      readonly elapsedMs: number;
    };

// How to run one page.
export type DemoRunOptions = {
  // The page name under `demos/feature-demos/`, without `.html`.
  readonly page: string;
  readonly port: number;
  // Evaluated in the page after it is ready; defaults to reading the report.
  readonly script?: string | undefined;
  readonly timeoutMs?: number | undefined;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

// The `{ error, report }` shape `demoReportExpression` evaluates to, or a description of what came back instead.
const readBack = (value: unknown): { readonly error: string | undefined; readonly report: Readonly<Record<string, unknown>> } => {
  if (!isRecord(value)) return { error: `the page evaluated to ${String(value)}`, report: {} };
  const error = value['error'];
  const report = value['report'];
  return {
    error: typeof error === 'string' ? error : undefined,
    report: isRecord(report) ? report : {},
  };
};

// Serves the page, runs it, and closes everything, whatever happened.
export const runDemoPage = async (options: DemoRunOptions): Promise<DemoRun> => {
  const available = await browserAvailability();
  if (!available.available) return { skipped: available.reason ?? 'no browser launched' };
  const server = await createServer({ configFile, server: { port: options.port, strictPort: true } });
  await server.listen();
  try {
    const local = server.resolvedUrls?.local[0];
    if (local === undefined) throw new Error('the vite server reported no local url');
    await mkdir(artifacts, { recursive: true });
    const screenshotPath = `${artifacts}${options.page}.png`;
    const run = await runInBrowser({
      url: `${local}feature-demos/${options.page}.html`,
      readyExpression: demoReadyExpression,
      script: options.script ?? demoReportExpression,
      screenshotPath,
      collectGraphics: true,
      timeoutMs: options.timeoutMs ?? 60_000,
    });
    const back = readBack(run.value);
    return {
      error: back.error,
      report: back.report,
      errors: [...run.pageErrors, ...run.consoleErrors],
      renderer: run.graphics?.renderer,
      screenshotPath,
      elapsedMs: run.elapsedMs,
    };
  } finally {
    await server.close();
  }
};

// A number from a report, or a thrown explanation of what was there instead.
export const reportedNumber = (report: Readonly<Record<string, unknown>>, name: string): number => {
  const value = report[name];
  if (typeof value !== 'number') throw new Error(`report.${name} is ${String(value)}, not a number`);
  return value;
};

// A string from a report, or a thrown explanation of what was there instead.
export const reportedString = (report: Readonly<Record<string, unknown>>, name: string): string => {
  const value = report[name];
  if (typeof value !== 'string') throw new Error(`report.${name} is ${String(value)}, not a string`);
  return value;
};
