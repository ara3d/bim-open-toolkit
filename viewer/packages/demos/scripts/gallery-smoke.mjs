// Opens every gallery demo in a real browser, checks it came up, and keeps the picture as the
// card thumbnail the index page shows.
//
// One vite server for the whole run and one browser process per demo: a demo that hangs or dies
// takes only itself down, and the report says which. Software WebGL, so a machine with no GPU
// still draws; the pictures are correct, the frame rates in them are not representative.
//
// Run from `viewer/`: npm run gallery:smoke

import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const demosDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const configFile = join(demosDir, 'vite.gallery.config.mjs');
const thumbnailDir = join(demosDir, 'public', 'thumbnails');
const reportPath = join(demosDir, 'docs', 'gallery-smoke.md');
const runnerPath = join(demosDir, '..', 'testing', 'src', 'browser', 'runner.ts');

// The expressions the page publishes on `window.demo`. Copied rather than imported: this script is
// plain JavaScript and the protocol lives in TypeScript.
const readyExpression =
  'window.demo !== undefined && (window.demo.ready === true || typeof window.demo.error === "string")';
//
// The wait before reading is deliberate. `ready` means the model is drawn and the controls are
// wired; a demo whose opening move is an animation - an explode, a camera flight, a light coming
// up - is still moving at that moment, and a picture taken then is a picture of every demo looking
// the same. Waiting for it to settle costs a second per demo and is the difference between a
// thumbnail and a placeholder.
const settleMs = 1500;
const reportExpression = `(async () => {
  await new Promise((done) => setTimeout(done, ${String(settleMs)}));
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  return { error: window.demo.error ?? null, report: window.demo.report() };
})()`;

// A demo is a directory under `src/demos` with an `index.ts`, which is the same thing the
// gallery's own discovery globs for. A directory without one is a demo still being written, and
// the gallery does not list it, so neither does this run.
const hasIndex = async (name) => {
  try {
    return (await stat(join(demosDir, 'src', 'demos', name, 'index.ts'))).isFile();
  } catch {
    return false;
  }
};

const demoIds = async () => {
  const entries = await readdir(join(demosDir, 'src', 'demos'), { withFileTypes: true });
  const named = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort();
  const found = [];
  for (const name of named) if (await hasIndex(name)) found.push(name);
  return found;
};

// One demo, opened and photographed. Never throws: a failure is a row in the report.
const smokeOne = async (runInBrowser, id, origin) => {
  const screenshotPath = join(thumbnailDir, `${id}.png`);
  try {
    const run = await runInBrowser({
      url: `${origin}/gallery.html?demo=${encodeURIComponent(id)}`,
      readyExpression,
      script: reportExpression,
      screenshotPath,
      // The viewport only. A thumbnail of the whole page would be mostly chrome.
      screenshotSelector: '.gallery-viewport',
      viewportWidth: 1200,
      viewportHeight: 800,
      timeoutMs: 60_000,
      collectGraphics: true,
    });
    const said = run.value ?? {};
    const failed = !(said.error === null || said.error === undefined);
    // A picture of a failure is not a thumbnail; the card shows its stand-in instead.
    if (failed) await rm(screenshotPath, { force: true });
    return {
      id,
      ok: said.error === null || said.error === undefined,
      error: said.error ?? undefined,
      report: said.report ?? {},
      elapsedMs: run.elapsedMs,
      graphics: run.graphics?.renderer,
      pageErrors: [...run.pageErrors, ...run.consoleErrors],
    };
  } catch (cause) {
    return { id, ok: false, error: cause instanceof Error ? cause.message : String(cause), report: {}, elapsedMs: 0, pageErrors: [] };
  }
};

const said = (result) => {
  if (result.error !== undefined) return result.error;
  const pairs = Object.entries(result.report).map(([key, value]) => `${key}=${String(value)}`);
  return pairs.length === 0 ? '—' : pairs.join(', ');
};

const line = (result) =>
  `| ${result.id} | ${result.ok ? 'drew' : 'failed'} | ${String(result.elapsedMs)} ms | ${said(result)} |`;

const main = async () => {
  await mkdir(thumbnailDir, { recursive: true });
  const ids = await demoIds();
  const server = await createServer({ configFile, server: { port: Number(process.env.GALLERY_PORT ?? 5190) } });
  await server.listen();
  const origin = `http://localhost:${String(server.config.server.port)}`;
  // The browser runner is TypeScript source; the server that serves the gallery compiles it too,
  // so this script needs no build step of its own.
  const { runInBrowser } = await server.ssrLoadModule(runnerPath);
  console.log(`gallery on ${origin}; ${String(ids.length)} demos`);
  const results = [];
  try {
    for (const id of ids) {
      const result = await smokeOne(runInBrowser, id, origin);
      results.push(result);
      console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${id}${result.error === undefined ? '' : ` â€” ${result.error}`}`);
      for (const message of result.pageErrors) console.log(`     page: ${message}`);
    }
  } finally {
    await server.close();
  }
  const failed = results.filter((one) => !one.ok);
  const body = [
    '# Gallery browser smoke',
    '',
    `Run ${new Date().toISOString()}. ${String(results.length - failed.length)} of ${String(results.length)} demos drew.`,
    'Thumbnails are written to `public/thumbnails/<id>.png` and shown on the index cards.',
    '',
    '| Demo | Result | Time | What it reported |',
    '|---|---|---|---|',
    ...results.map(line),
    '',
  ].join('\n');
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, body, 'utf8');
  console.log(`report: ${reportPath}`);
  process.exitCode = failed.length === 0 ? 0 : 1;
};

await main();
