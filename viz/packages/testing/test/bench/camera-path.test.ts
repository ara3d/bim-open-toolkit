import { describe, expect, it } from 'vitest';
import { cameraPose, metresZUpLocal, perspective, viewState, type Bounds } from '@bim-open-toolkit/model';
import {
  cameraPath,
  defaultOrbitPathOptions,
  keyAtMs,
  orbitCameraPath,
  pathDurationMs,
  recordCameraPath,
} from '../../src/bench/camera-path.js';

const view = (x: number): ReturnType<typeof viewState> =>
  viewState(cameraPose([x, 0, 0], [0, 0, 0], [0, 0, 1]), perspective(), metresZUpLocal);

const box: Bounds = { min: [-5, -5, 0], max: [5, 5, 10] };

describe('a camera path', () => {
  it('rejects an empty path and one whose times go backwards', () => {
    expect(() => cameraPath('empty', [])).toThrow(/no keys/);
    expect(() =>
      cameraPath('backwards', [{ timeMs: 10, view: view(1) }, { timeMs: 5, view: view(2) }]),
    ).toThrow(/goes back in time/);
  });

  it('reports the time from its first key to its last', () => {
    const path = cameraPath('two', [{ timeMs: 100, view: view(1) }, { timeMs: 400, view: view(2) }]);
    expect(pathDurationMs(path)).toBe(300);
  });

  it('reads back the last key at or before a time', () => {
    const path = cameraPath('three', [
      { timeMs: 0, view: view(1) },
      { timeMs: 10, view: view(2) },
      { timeMs: 20, view: view(3) },
    ]);
    expect(keyAtMs(path, -1).timeMs).toBe(0);
    expect(keyAtMs(path, 15).timeMs).toBe(10);
    expect(keyAtMs(path, 500).timeMs).toBe(20);
  });

  it('records what a session showed', () => {
    const recorder = recordCameraPath('recorded');
    recorder.record(0, view(1));
    recorder.record(33, view(2));
    const path = recorder.finish();
    expect(path.name).toBe('recorded');
    expect(path.keys.map((key) => key.timeMs)).toEqual([0, 33]);
  });
});

describe('a generated orbit', () => {
  const path = orbitCameraPath('orbit', box);

  it('holds one key per frame at the frame interval', () => {
    expect(path.keys.length).toBe(defaultOrbitPathOptions.frames);
    expect(pathDurationMs(path)).toBeCloseTo(defaultOrbitPathOptions.intervalMs * (defaultOrbitPathOptions.frames - 1));
  });

  it('looks at the centre of the box from every frame', () => {
    for (const key of path.keys) expect(key.view.camera.target).toEqual([0, 0, 5]);
  });

  it('keeps the camera the same distance from the centre all the way round', () => {
    const distances = path.keys.map((key) => {
      const [x, y, z] = key.view.camera.position;
      return Math.hypot(x - 0, y - 0, z - 5);
    });
    const first = distances[0] ?? 0;
    for (const distance of distances) expect(distance).toBeCloseTo(first, 6);
    expect(first).toBeGreaterThan(0);
  });

  it('is the same path every time, so two runs are comparable', () => {
    expect(orbitCameraPath('orbit', box)).toEqual(path);
  });

  it('is on the opposite side of the box half a turn along', () => {
    const quarters = orbitCameraPath('quarters', box, { frames: 4, turns: 1 });
    const start = quarters.keys[0]?.view.camera.position;
    const half = quarters.keys[2]?.view.camera.position;
    if (start === undefined || half === undefined) throw new Error('the orbit lost a frame');
    expect(half[0] - 0).toBeCloseTo(-(start[0] - 0), 6);
    expect(half[1] - 0).toBeCloseTo(-(start[1] - 0), 6);
    expect(half[2]).toBeCloseTo(start[2], 6);
  });

  it('works about a y up axis as well as z', () => {
    const yUp = orbitCameraPath('y', box, { up: [0, 1, 0], frames: 4 });
    for (const key of yUp.keys) expect(key.view.camera.up).toEqual([0, 1, 0]);
  });

  it('refuses empty bounds and a frame count that is not a positive whole number', () => {
    expect(() => orbitCameraPath('none', { min: [1, 1, 1], max: [-1, -1, -1] })).toThrow(/empty bounds/);
    expect(() => orbitCameraPath('none', box, { frames: 0 })).toThrow(/positive integer/);
  });
});
