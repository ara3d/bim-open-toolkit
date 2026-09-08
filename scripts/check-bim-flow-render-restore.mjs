import assert from 'node:assert/strict';
import { chromium } from '../viewer/node_modules/playwright-core/index.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
  await page.goto((process.env.BOF_DEMO_URL ?? 'http://127.0.0.1:5300') + '/3d.html?profileStartup=1');
  await page.waitForFunction(() => performance.getEntriesByName('bimflow:first-model-frame-submitted').length > 0, {}, { timeout: 180000 });
  const pixels = async () => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return (await page.locator('.bof-panes-canvas').screenshot()).toString('base64');
  };
  const before = await pixels();
  for (const node of ['ghost', 'cutaway', 'exploded']) {
    await page.getByLabel('Preview node').selectOption(node);
    assert.notEqual(await pixels(), before, `${node} changes the rendering`);
    await page.getByLabel('Preview node').selectOption('categories');
    const after = await pixels();
    const result = await page.evaluate(async ({ before, after }) => {
      const decode = async encoded => {
        const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(encoded), value => value.charCodeAt(0))], { type: 'image/png' }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const [a, b] = await Promise.all([decode(before), decode(after)]);
      if (a.length !== b.length) throw new Error('Canvas size changed');
      let changed = 0;
      for (let i = 0; i < a.length; i += 4)
        if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i + 1] - b[i + 1]) > 8 || Math.abs(a[i + 2] - b[i + 2]) > 8) changed++;
      return { changed, pixels: a.length / 4 };
    }, { before, after });
    // Coplanar depth ties can change a few pixels when switching rendering paths.
    assert.ok(result.changed / result.pixels < .001, `${node}: more than 0.1% pixels differ on restoration`);
    console.log(JSON.stringify({ node, ...result }));
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
