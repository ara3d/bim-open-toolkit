import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { artifactsFor } from '../../src/artifacts.js';
import { orbitCameraPath } from '../../src/bench/camera-path.js';
import { frameTimeProbeScript, parseFrameProbeResult } from '../../src/bench/page-script.js';
import { frameReport, frameTimeCollector } from '../../src/bench/timings.js';
import { browserAvailability, dataUrlPage, runInBrowser } from '../../src/browser/runner.js';

// Asked once: the browser cases are skipped when this machine has no browser playwright-core can
// drive. Each case costs a browser start, so there are two of them, not one per assertion.
const availability = await browserAvailability();
if (!availability.available) {
  console.log(`Skipping browser runner tests: ${availability.reason ?? 'no reason reported'}`);
}
const whenAvailable = availability.available ? it : it.skip;

const output = artifactsFor(import.meta.url, 'browser');

// A page that becomes ready a moment after loading and draws each frame it is handed.
const page = dataUrlPage(`<!doctype html>
<title>Testing browser runner</title>
<style>body { margin: 0; background: #123; color: #eee; font: 16px system-ui; }</style>
<h1 id="heading">not ready</h1>
<script>
  globalThis.drawn = [];
  globalThis.benchmarkFrame = (view, index) => {
    globalThis.drawn.push(view.camera.position[0] + index);
  };
  setTimeout(() => {
    globalThis.pageReady = true;
    document.querySelector('#heading').textContent = 'ready';
  }, 30);
</script>`);

describe('the browser runner', () => {
  it('reports whether a browser can be launched, and why not when it cannot', () => {
    expect(typeof availability.available).toBe('boolean');
    if (availability.available) {
      expect(availability.channel).toBeDefined();
      expect(availability.version).toMatch(/\d+\./);
      expect(availability.reason).toBeUndefined();
    } else {
      expect(availability.reason).toBeTruthy();
    }
  });

  whenAvailable('waits for the page, replays a camera path, screenshots it and reports the graphics', async () => {
    await mkdir(output, { recursive: true });
    const screenshotPath = join(output, 'runner.png');
    const path = orbitCameraPath('runner-orbit', { min: [0, 0, 0], max: [10, 10, 10] }, { frames: 12 });
    const result = await runInBrowser({
      url: page,
      readyExpression: 'globalThis.pageReady === true',
      script: frameTimeProbeScript(path, { warmupFrames: 2, measuredFrames: 12 }),
      screenshotPath,
      collectGraphics: true,
      viewportWidth: 400,
      viewportHeight: 300,
    });

    expect(result.consoleErrors).toEqual([]);
    expect(result.pageErrors).toEqual([]);
    expect(result.graphics?.version).toMatch(/WebGL/i);
    expect(result.elapsedMs).toBeGreaterThan(0);
    expect((await stat(screenshotPath)).size).toBeGreaterThan(0);

    const parsed = parseFrameProbeResult(result.value);
    if (!parsed.ok) throw new Error(`the probe returned something else: ${JSON.stringify(parsed.diagnostics)}`);
    expect(parsed.value.drew).toBe(true);
    expect(parsed.value.samples.length).toBe(12);
    expect(parsed.value.samples[0]?.frame).toBe(0);
    for (const sample of parsed.value.samples) {
      expect(sample.intervalMs).toBeGreaterThan(0);
      expect(sample.cpuMs).toBeGreaterThanOrEqual(0);
    }

    const collector = frameTimeCollector();
    for (const sample of parsed.value.samples) collector.add(sample.cpuMs, sample.intervalMs);
    const report = frameReport(collector.samples());
    expect(report.interval.count).toBe(12);
    expect(report.framesPerSecond).toBeGreaterThan(0);
  }, 180_000);

  whenAvailable('collects the console and page errors a page produces', async () => {
    const noisy = dataUrlPage(`<!doctype html><title>Noisy</title><script>
      console.error('a logged error');
      setTimeout(() => { throw new Error('a thrown error'); }, 0);
      setTimeout(() => { globalThis.pageReady = true; }, 40);
    </script>`);
    const result = await runInBrowser({ url: noisy, readyExpression: 'globalThis.pageReady === true' });
    expect(result.consoleErrors.join(' ')).toContain('a logged error');
    expect(result.pageErrors.join(' ')).toContain('a thrown error');
    expect(result.value).toBeUndefined();
  }, 180_000);
});
