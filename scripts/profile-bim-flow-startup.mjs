import { chromium } from '../viewer/node_modules/playwright-core/index.mjs';

const base = process.env.BOF_DEMO_URL ?? 'http://127.0.0.1:5300';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
  const session = await page.context().newCDPSession(page);
  await session.send('Profiler.enable');
  await session.send('Profiler.start');
  await page.goto(base + '/3d.html?profileStartup=1');
  await page.waitForFunction(() => performance.getEntriesByName('bimflow:first-model-frame-submitted').length > 0, {}, { timeout: 180000 });
  const { profile } = await session.send('Profiler.stop');
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('.bof-panes-canvas');
    const gl = canvas.getContext('webgl2');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      firstFrameSubmittedMs: performance.getEntriesByName('bimflow:first-model-frame-submitted')[0].startTime,
      phases: performance.getEntriesByType('measure').filter(entry => entry.name.startsWith('bimflow:')).map(entry => ({ name: entry.name, startMs: entry.startTime, durationMs: entry.duration })),
      network: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/api/') || entry.name.includes('/__bimflow/models/')).map(entry => ({ name: entry.name, startMs: entry.startTime, durationMs: entry.duration })),
    };
  });
  const nodes = new Map(profile.nodes.map(node => [node.id, node.callFrame]));
  const samples = new Map();
  profile.samples.forEach((id, index) => {
    const frame = nodes.get(id);
    const key = `${frame.functionName || '(anonymous)'} ${frame.url}:${frame.lineNumber + 1}`;
    samples.set(key, (samples.get(key) ?? 0) + profile.timeDeltas[index] / 1000);
  });
  console.log(JSON.stringify({ ...result, errors, cpuSelfMs: [...samples].sort((a, b) => b[1] - a[1]).slice(0, 25) }, null, 2));
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
