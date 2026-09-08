import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from '../viewer/node_modules/playwright-core/index.mjs';

// Read-only comparison: use the same graph/app, changing only its model response.
const base = process.env.BOF_DEMO_URL ?? 'http://127.0.0.1:5300';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
const samples = [];
try {
  for (const format of ['bos', 'bfast', 'bos', 'bfast', 'bos', 'bfast']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    let modelStart = 0;
    let modelRequests = 0;
    let modelLists = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url() === base + '/api/models') modelLists++; });
    await page.route('**/api/**', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
    await page.route('**/__bimflow/models/*', async route => {
      modelRequests++;
      modelStart = performance.now();
      if (format === 'bfast') return route.continue();
      const id = new URL(route.request().url()).pathname.split('/').at(-1);
      return route.continue({ url: `${base}/api/models/${id}/bos` });
    });
    const start = performance.now();
    await page.goto(base + '/3d.html');
    await page.waitForFunction(() => /456,598/.test(document.querySelector('.bof-panes-viewstatus')?.textContent ?? ''), {}, { timeout: 180000 });
    const ready = performance.now();
    const pixels = await page.locator('.bof-panes-canvas').screenshot();
    assert.equal(modelRequests, 1);
    assert.equal(modelLists, 1);
    assert.deepEqual(errors, []);
    const sample = { format, readyMs: Math.round(ready - start), modelToReadyMs: Math.round(ready - modelStart), canvasHash: createHash('sha256').update(pixels).digest('hex') };
    samples.push(sample);
    console.log(JSON.stringify(sample));
    await page.close();
  }
  for (const format of ['bos', 'bfast']) {
    const rows = samples.filter(sample => sample.format === format);
    const median = key => rows.map(row => row[key]).sort((a, b) => a - b)[1];
    console.log(JSON.stringify({ format, medianReadyMs: median('readyMs'), medianModelToReadyMs: median('modelToReadyMs') }));
  }
  console.log(JSON.stringify({ identicalCanvases: new Set(samples.map(sample => sample.canvasHash)).size === 1 }));
} finally {
  await browser.close();
}
