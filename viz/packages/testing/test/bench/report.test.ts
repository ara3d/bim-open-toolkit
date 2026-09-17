import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { smallBuilding } from '../../src/fixtures/catalog.js';
import { fixtureFingerprint } from '../../src/fixtures/scene-fixture.js';
import { orbitCameraPath } from '../../src/bench/camera-path.js';
import { frameReport, frameTimeCollector } from '../../src/bench/timings.js';
import { loadTimer, nodeHeapReading, operationReport, unavailableReading } from '../../src/bench/measurements.js';
import {
  defaultMethod,
  formatReport,
  nodeDevice,
  sceneInfoOf,
  writeReport,
  type BenchmarkReport,
} from '../../src/bench/report.js';
import { defaultFrameProbeOptions, frameTimeProbeScript, graphicsProbeScript } from '../../src/bench/page-script.js';
import { artifactsDir, artifactsFor, findViewerRoot } from '../../src/artifacts.js';

const fixture = smallBuilding();

const collector = frameTimeCollector();
for (const interval of [16, 17, 16, 40]) collector.add(3, interval);

let clock = 0;
const timer = loadTimer(() => clock);
clock = 20;
timer.mark('decode');

const report: BenchmarkReport = {
  name: 'Small building orbit',
  recordedAt: '2026-09-08T00:00:00.000Z',
  device: nodeDevice(),
  browser: { name: 'chromium', version: '152.0', renderer: 'SwiftShader', softwareWebGL: true },
  method: { ...defaultMethod, cameraPath: 'orbit', notes: 'no features enabled' },
  scene: sceneInfoOf(fixture),
  frames: frameReport(collector.samples()),
  load: timer.finish(),
  memory: [nodeHeapReading('after loading'), unavailableReading('gpu', 'no timer query extension')],
  operations: [operationReport({ operation: 'colour', objectCount: 150, samplesMs: [12, 14, 30] }, 1000)],
};

const directories: string[] = [];
afterAll(async () => {
  for (const directory of directories) await rm(directory, { recursive: true, force: true });
});

describe('describing a run', () => {
  it('identifies the scene by its fixture fingerprint', () => {
    expect(report.scene.fingerprint).toBe(fixtureFingerprint(fixture));
    expect(report.scene.objectCount).toBe(150);
    expect(report.scene.triangleCount).toBe(fixture.triangleCount);
  });

  it('reads the machine and leaves the GPU unnamed rather than guessing', () => {
    const device = nodeDevice();
    expect(device.cores).toBeGreaterThan(0);
    expect(device.ramBytes).toBeGreaterThan(0);
    expect(device.gpu).toBeUndefined();
  });
});

describe('formatting a report', () => {
  const text = formatReport(report);

  it('states the device, the browser and the method the plan requires', () => {
    expect(text).toContain('## Device, browser and method');
    expect(text).toContain('chromium 152.0');
    expect(text).toContain('software WebGL');
    expect(text).toContain('1280 by 800 at 1x');
    expect(text).toContain('orbit');
    expect(text).toContain('no features enabled');
  });

  it('states the scene, the frame times, the load, the operations and the memory', () => {
    expect(text).toContain(report.scene.fingerprint);
    expect(text).toContain('## Frame time');
    expect(text).toContain('frames a second');
    expect(text).toContain('## Load');
    expect(text).toContain('## Operations');
    expect(text).toContain('## Memory');
    expect(text).toContain('not measured');
  });

  it('leaves out the sections a run did not measure', () => {
    const bare = formatReport({ ...report, frames: undefined, load: undefined, memory: [], operations: [] });
    expect(bare).not.toContain('## Frame time');
    expect(bare).not.toContain('## Memory');
    expect(bare).toContain('## Scene');
  });

  it('says so when a run had no browser', () => {
    expect(formatReport({ ...report, browser: undefined })).toContain('measured in Node');
  });
});

describe('writing a report', () => {
  it('writes JSON beside markdown, creating the directory', async () => {
    const base = await mkdtemp(join(tmpdir(), 'bim-report-'));
    directories.push(base);
    const directory = join(base, 'nested');
    const written = await writeReport(directory, report);
    expect(written.jsonPath).toBe(join(directory, 'small-building-orbit.json'));
    const parsed: unknown = JSON.parse(await readFile(written.jsonPath, 'utf8'));
    expect(parsed).toEqual(JSON.parse(JSON.stringify(report)));
    expect(await readFile(written.markdownPath, 'utf8')).toBe(formatReport(report));
  });

  it('refuses a name that leaves no file name', async () => {
    const base = await mkdtemp(join(tmpdir(), 'bim-report-'));
    directories.push(base);
    await expect(writeReport(base, { ...report, name: '///' })).rejects.toThrow(/no file name/);
  });
});

describe('the page-side collector', () => {
  const path = orbitCameraPath('orbit', { min: [0, 0, 0], max: [1, 1, 1] }, { frames: 3 });

  it('builds a script that is valid JavaScript and carries the path and the counts', () => {
    const script = frameTimeProbeScript(path, { warmupFrames: 2, measuredFrames: 7 });
    expect(() => new Function(`return ${script};`)).not.toThrow();
    expect(script).toContain('const warmup = 2;');
    expect(script).toContain('const measured = 7;');
    expect(script).toContain('benchmarkFrame');
    expect(JSON.parse(script.slice(script.indexOf('[', script.indexOf('const views')), script.indexOf('];') + 1))).toHaveLength(3);
  });

  it('takes the hook name from its options', () => {
    expect(frameTimeProbeScript(path, { hookName: 'drawFrame' })).toContain('"drawFrame"');
    expect(defaultFrameProbeOptions.hookName).toBe('benchmarkFrame');
  });

  it('rejects counts that would measure nothing', () => {
    expect(() => frameTimeProbeScript(path, { measuredFrames: 0 })).toThrow(/positive integer/);
    expect(() => frameTimeProbeScript(path, { warmupFrames: -1 })).toThrow(/whole number/);
  });

  it('has a graphics probe that is valid JavaScript', () => {
    expect(() => new Function(`return ${graphicsProbeScript};`)).not.toThrow();
    expect(graphicsProbeScript).toContain('webgl2');
  });
});

describe('the artifacts directory', () => {
  it('finds the workspace root above this package and puts output under it', () => {
    const root = findViewerRoot(import.meta.url);
    expect(root.endsWith('viewer')).toBe(true);
    expect(artifactsDir(root, 'browser')).toBe(join(root, 'artifacts', 'testing', 'browser'));
    expect(artifactsFor(import.meta.url)).toBe(join(root, 'artifacts', 'testing'));
  });

  it('says so when there is no such directory above the start', () => {
    expect(() => findViewerRoot('/')).toThrow(/no directory containing/);
  });
});
