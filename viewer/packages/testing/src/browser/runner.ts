// One browser run: launch, open a page, wait for it to say it is ready, run a script, take a
// screenshot, close.
//
// `playwright-core` ships no browser of its own, so a run uses one already installed on the
// machine, tried in order. That is why availability is a question with an answer rather than an
// assumption: a test asks first and skips with a printed reason when nothing launches, instead of
// failing on a machine that simply has no browser.
//
// One browser process per call, closed in a `finally`. Long-lived shared browsers are what make
// browser suites flaky and what make one track's failure another track's failure.

import { graphicsProbeScript } from '../bench/page-script.js';

// A browser to try. `bundled` means playwright's own download, which is usually not installed.
export type BrowserChannel = 'msedge' | 'chrome' | 'msedge-beta' | 'chrome-beta' | 'bundled';

// Tried in this order: the two browsers a Windows or macOS machine usually has, then playwright's.
export const defaultChannels: readonly BrowserChannel[] = ['msedge', 'chrome', 'bundled'];

// Flags that force ANGLE onto its software renderer, so a headless machine with no GPU still runs
// WebGL. Correct pictures, not representative frame rates.
export const softwareWebGLArgs: readonly string[] = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

// What the page reported about its WebGL, or undefined when it could not make a context.
export type GraphicsInfo = { readonly renderer: string; readonly version: string };

// Whether a browser can be launched here, and which.
export type BrowserAvailability = {
  readonly available: boolean;
  readonly channel: BrowserChannel | undefined;
  readonly version: string | undefined;
  // Why not, when nothing launched. Print this in a skip message.
  readonly reason: string | undefined;
};

// How to run.
export type BrowserRunOptions = {
  // The page to open. A `data:` URL works and needs no server, which is what the tests here use.
  readonly url: string;
  // A JavaScript expression the page must make true before the script runs. Without one, the run
  // continues as soon as the document has loaded.
  readonly readyExpression: string | undefined;
  // A JavaScript expression evaluated in the page. Its value, which must survive JSON, is returned.
  readonly script: string | undefined;
  // Where to write a screenshot. No screenshot is taken when this is undefined.
  readonly screenshotPath: string | undefined;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly deviceScaleFactor: number;
  readonly softwareWebGL: boolean;
  readonly timeoutMs: number;
  readonly channels: readonly BrowserChannel[];
  // Ask the page what WebGL it got, so a report can say whether it was software.
  readonly collectGraphics: boolean;
};

// A run with software WebGL, at the viewport the alpha's browser suite used.
export const defaultRunOptions: BrowserRunOptions = {
  url: 'about:blank',
  readyExpression: undefined,
  script: undefined,
  screenshotPath: undefined,
  viewportWidth: 1280,
  viewportHeight: 800,
  deviceScaleFactor: 1,
  softwareWebGL: true,
  timeoutMs: 30_000,
  channels: defaultChannels,
  collectGraphics: false,
};

// What a run produced.
export type BrowserRunResult = {
  readonly channel: BrowserChannel;
  readonly browserVersion: string;
  readonly graphics: GraphicsInfo | undefined;
  // Whatever the script evaluated to. `undefined` when no script was given.
  readonly value: unknown;
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly screenshotPath: string | undefined;
  readonly elapsedMs: number;
};

// A page holding the given HTML, with no server. The markup is carried in the URL, so keep it
// small: browsers limit how long a URL may be.
export const dataUrlPage = (html: string): string =>
  `data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`;

// The launched browser and the channel it came from.
type Launched = {
  readonly channel: BrowserChannel;
  readonly browser: import('playwright-core').Browser;
};

// Playwright's chromium type, loaded when it is needed rather than when this module is imported.
const chromiumOf = async (): Promise<import('playwright-core').BrowserType> => {
  const playwright = await import('playwright-core');
  return playwright.chromium;
};

// The first channel that launches, or every reason it did not.
async function launchFirst(
  channels: readonly BrowserChannel[],
  args: readonly string[],
): Promise<Launched | string> {
  const reasons: string[] = [];
  let chromium: import('playwright-core').BrowserType;
  try {
    chromium = await chromiumOf();
  } catch (error) {
    return `playwright-core could not be loaded: ${String(error)}`;
  }
  for (const channel of channels) {
    try {
      const browser = await chromium.launch({
        headless: true,
        args: [...args],
        ...(channel === 'bundled' ? {} : { channel }),
      });
      return { channel, browser };
    } catch (error) {
      reasons.push(`${channel}: ${String(error).split('\n')[0] ?? 'unknown error'}`);
    }
  }
  return `no browser launched (${reasons.join('; ')})`;
}

// Whether a browser can be launched here. Launches and closes one, so it costs a browser start.
export async function browserAvailability(
  channels: readonly BrowserChannel[] = defaultChannels,
): Promise<BrowserAvailability> {
  const launched = await launchFirst(channels, []);
  if (typeof launched === 'string') {
    return { available: false, channel: undefined, version: undefined, reason: launched };
  }
  try {
    return { available: true, channel: launched.channel, version: launched.browser.version(), reason: undefined };
  } finally {
    await launched.browser.close();
  }
}

// Runs one page and closes the browser, whatever happened. Throws when no browser launches; call
// `browserAvailability` first to skip instead.
export async function runInBrowser(options: Partial<BrowserRunOptions>): Promise<BrowserRunResult> {
  const settings: BrowserRunOptions = { ...defaultRunOptions, ...options };
  const started = Date.now();
  const launched = await launchFirst(settings.channels, settings.softwareWebGL ? softwareWebGLArgs : []);
  if (typeof launched === 'string') throw new Error(launched);
  const { browser, channel } = launched;
  try {
    const page = await browser.newPage({
      viewport: { width: settings.viewportWidth, height: settings.viewportHeight },
      deviceScaleFactor: settings.deviceScaleFactor,
    });
    page.setDefaultTimeout(settings.timeoutMs);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => { pageErrors.push(String(error)); });
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

    await page.goto(settings.url, { waitUntil: 'domcontentloaded', timeout: settings.timeoutMs });
    if (settings.readyExpression !== undefined) {
      await page.waitForFunction(settings.readyExpression, undefined, { timeout: settings.timeoutMs });
    }
    const graphics = settings.collectGraphics
      ? await page.evaluate<GraphicsInfo | null>(graphicsProbeScript)
      : null;
    const value = settings.script === undefined ? undefined : await page.evaluate<unknown>(settings.script);
    if (settings.screenshotPath !== undefined) await page.screenshot({ path: settings.screenshotPath });
    return {
      channel,
      browserVersion: browser.version(),
      graphics: graphics ?? undefined,
      value,
      consoleErrors,
      pageErrors,
      screenshotPath: settings.screenshotPath,
      elapsedMs: Date.now() - started,
    };
  } finally {
    await browser.close();
  }
}
