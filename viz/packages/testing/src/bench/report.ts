// A benchmark report: the numbers, and everything needed to believe them.
//
// The plan requires every report to record device, browser and method. A frame time without the
// machine, the viewport, the warm-up and the camera path is not a measurement anybody can repeat
// or compare, so those fields are part of the type rather than a convention. The scene is
// identified by its fixture fingerprint, so a report says exactly which data it ran against.

import { cpus, release, totalmem, type } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureFingerprint, type SceneFixture } from '../fixtures/scene-fixture.js';
import { megabytes, totalLoadMs, type LoadTiming, type MemoryReading, type OperationReport } from './measurements.js';
import type { FrameReport } from './timings.js';

// The machine a run happened on.
export type DeviceInfo = {
  readonly os: string;
  readonly cpu: string;
  readonly cores: number;
  readonly ramBytes: number;
  // Named when known. A GPU cannot be read from Node, so a Node-only report leaves it undefined.
  readonly gpu: string | undefined;
};

// The browser a run happened in, and whether its WebGL was software.
export type BrowserInfo = {
  readonly name: string;
  readonly version: string;
  readonly renderer: string;
  readonly softwareWebGL: boolean;
};

// How the run was conducted. Everything here changes the numbers, so all of it is recorded.
export type MethodInfo = {
  readonly warmupFrames: number;
  readonly measuredFrames: number;
  readonly repetitions: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly devicePixelRatio: number;
  readonly hudEnabled: boolean;
  readonly cameraPath: string;
  // Anything else a reader needs: feature combination, cache state, what was not measured.
  readonly notes: string;
};

// The data a run drew, identified so another run can use the same.
export type SceneInfo = {
  readonly fixture: string;
  readonly fingerprint: string;
  readonly objectCount: number;
  readonly instanceCount: number;
  readonly triangleCount: number;
};

// One finished report. Every measurement is optional because a run measures what it set out to.
export type BenchmarkReport = {
  readonly name: string;
  readonly recordedAt: string;
  readonly device: DeviceInfo;
  readonly browser: BrowserInfo | undefined;
  readonly method: MethodInfo;
  readonly scene: SceneInfo;
  readonly frames: FrameReport | undefined;
  readonly load: LoadTiming | undefined;
  readonly memory: readonly MemoryReading[];
  readonly operations: readonly OperationReport[];
};

// The machine this process is on. Reads nothing about the GPU, and says so by leaving it undefined.
export const nodeDevice = (): DeviceInfo => ({
  os: `${type()} ${release()}`,
  cpu: cpus()[0]?.model ?? 'unknown',
  cores: cpus().length,
  ramBytes: totalmem(),
  gpu: undefined,
});

// A fixture described for a report, with the fingerprint that identifies its exact contents.
export const sceneInfoOf = (fixture: SceneFixture): SceneInfo => ({
  fixture: fixture.name,
  fingerprint: fixtureFingerprint(fixture),
  objectCount: fixture.model.objects.length,
  instanceCount: fixture.geometry.instances.count,
  triangleCount: fixture.triangleCount,
});

// A method record with the fields a run did not vary already filled in.
export const defaultMethod: MethodInfo = {
  warmupFrames: 5,
  measuredFrames: 60,
  repetitions: 1,
  viewportWidth: 1280,
  viewportHeight: 800,
  devicePixelRatio: 1,
  hudEnabled: false,
  cameraPath: 'unnamed',
  notes: '',
};

const round = (value: number): string => (value < 10 ? value.toFixed(3) : value.toFixed(1));

// A markdown table from a header and rows.
const table = (header: readonly string[], rows: readonly (readonly string[])[]): string => {
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => (row[column] ?? '').length)));
  const line = (cells: readonly string[]): string =>
    `| ${cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join(' | ')} |`;
  return [line(header), `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`, ...rows.map(line)].join('\n');
};

// The report as markdown: what ran, on what, how, and what came out.
export function formatReport(report: BenchmarkReport): string {
  const parts: string[] = [`# ${report.name}`, '', `Recorded ${report.recordedAt}.`, ''];

  parts.push('## Device, browser and method', '');
  const browser = report.browser;
  parts.push(
    table(
      ['field', 'value'],
      [
        ['os', report.device.os],
        ['cpu', `${report.device.cpu} (${report.device.cores} cores)`],
        ['ram', `${megabytes(report.device.ramBytes).toFixed(0)} MB`],
        ['gpu', report.device.gpu ?? 'not read from this process'],
        ['browser', browser === undefined ? 'none: measured in Node' : `${browser.name} ${browser.version}`],
        ['renderer', browser === undefined ? 'none' : `${browser.renderer}${browser.softwareWebGL ? ' (software WebGL)' : ''}`],
        ['viewport', `${report.method.viewportWidth} by ${report.method.viewportHeight} at ${report.method.devicePixelRatio}x`],
        ['warm-up', `${report.method.warmupFrames} frames`],
        ['measured', `${report.method.measuredFrames} frames, ${report.method.repetitions} repetition(s)`],
        ['camera path', report.method.cameraPath],
        ['hud', report.method.hudEnabled ? 'enabled' : 'disabled'],
        ['notes', report.method.notes === '' ? 'none' : report.method.notes],
      ],
    ),
    '',
  );

  parts.push('## Scene', '');
  parts.push(
    table(
      ['field', 'value'],
      [
        ['fixture', report.scene.fixture],
        ['fingerprint', report.scene.fingerprint],
        ['objects', String(report.scene.objectCount)],
        ['instances', String(report.scene.instanceCount)],
        ['triangles', String(report.scene.triangleCount)],
      ],
    ),
    '',
  );

  const frames = report.frames;
  if (frames !== undefined) {
    parts.push('## Frame time', '');
    parts.push(
      table(
        ['series', 'count', 'median ms', 'p95 ms', 'min ms', 'max ms', 'over budget'],
        [
          ['interval', String(frames.interval.count), round(frames.interval.medianMs), round(frames.interval.p95Ms), round(frames.interval.minMs), round(frames.interval.maxMs), String(frames.interval.overBudget)],
          ['cpu', String(frames.cpu.count), round(frames.cpu.medianMs), round(frames.cpu.p95Ms), round(frames.cpu.minMs), round(frames.cpu.maxMs), String(frames.cpu.overBudget)],
        ],
      ),
      '',
      `Budget ${round(frames.interval.budgetMs)} ms; median interval is ${frames.framesPerSecond.toFixed(1)} frames a second.`,
      '',
    );
  }

  const load = report.load;
  if (load !== undefined) {
    parts.push('## Load', '');
    parts.push(
      table(
        ['phase', 'ms'],
        Object.entries(load.phaseMs).map(([phase, ms]) => [phase, round(ms)]),
      ),
      '',
      `Total ${round(totalLoadMs(load))} ms.`,
      '',
    );
  }

  if (report.operations.length > 0) {
    parts.push('## Operations', '');
    parts.push(
      table(
        ['operation', 'objects', 'runs', 'median ms', 'p95 ms', 'budget ms', 'over budget'],
        report.operations.map((item) => [
          item.operation,
          String(item.objectCount),
          String(item.stats.count),
          round(item.stats.medianMs),
          round(item.stats.p95Ms),
          round(item.stats.budgetMs),
          String(item.stats.overBudget),
        ]),
      ),
      '',
    );
  }

  if (report.memory.length > 0) {
    parts.push('## Memory', '');
    parts.push(
      table(
        ['reading', 'heap MB', 'gpu MB', 'note'],
        report.memory.map((item) => [
          item.label,
          item.heapBytes === undefined ? 'not measured' : megabytes(item.heapBytes).toFixed(1),
          item.gpuBytes === undefined ? 'not measured' : megabytes(item.gpuBytes).toFixed(1),
          item.note,
        ]),
      ),
      '',
    );
  }

  return `${parts.join('\n').trimEnd()}\n`;
}

// Where a written report ended up.
export type WrittenReport = { readonly jsonPath: string; readonly markdownPath: string };

// Writes the report as machine-readable JSON beside a readable markdown copy, creating the
// directory if it is not there. The file name is the report's name with spaces replaced.
export async function writeReport(directory: string, report: BenchmarkReport): Promise<WrittenReport> {
  const stem = report.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  if (stem === '') throw new Error(`report name "${report.name}" leaves no file name`);
  await mkdir(directory, { recursive: true });
  const jsonPath = join(directory, `${stem}.json`);
  const markdownPath = join(directory, `${stem}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, formatReport(report), 'utf8');
  return { jsonPath, markdownPath };
}
