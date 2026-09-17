import { expect, it } from 'vitest';
import { linkCameraViews } from '../src/view-link.js';
import type { CameraState } from '../src/contracts.js';

const pose = (x: number): CameraState => ({ position: [x, 2, 3], target: [0, 0, 0], up: [0, 1, 0], projection: 'perspective', zoom: 1 });
function endpoint(initial: CameraState) {
  let current = initial;
  let writes = 0;
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of listeners) listener(); };
  return {
    read: () => current,
    write(value: CameraState) { current = value; writes++; emit(); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    change(value: CameraState) { current = value; emit(); },
    emit,
    get writes() { return writes; },
    get listeners() { return listeners.size; },
  };
}

it('copies initial camera and propagates both ways without synchronous or delayed echoes', () => {
  const a = endpoint(pose(1));
  const b = endpoint(pose(2));
  const stop = linkCameraViews(a, b);
  expect(b.read()).toEqual(a.read());
  expect(b.read()).not.toBe(a.read());
  expect(a.writes).toBe(0);
  expect(b.writes).toBe(1);
  b.emit();
  expect(a.writes).toBe(0);
  b.change(pose(7));
  expect(a.read()).toEqual(pose(7));
  expect(a.writes).toBe(1);
  expect(b.writes).toBe(1);
  stop(); stop();
  expect(a.listeners + b.listeners).toBe(0);
  a.change(pose(8));
  expect(b.read()).toEqual(pose(7));
});

it('supports independent initial poses and reverse initial synchronization', () => {
  const a = endpoint(pose(1));
  const b = endpoint(pose(2));
  const stop = linkCameraViews(a, b, { initial: false });
  expect(a.writes + b.writes).toBe(0);
  a.change({ ...pose(1), zoom: 2 });
  expect(b.read().zoom).toBe(2);
  stop();
  b.change(pose(10));
  linkCameraViews(a, b, { initial: 'b' })();
  expect(a.read()).toEqual(pose(10));
});

it('cleans up subscriptions when initial synchronization fails', () => {
  const a = endpoint(pose(1));
  const b = endpoint(pose(2));
  expect(() => linkCameraViews(a, { ...b, write: () => { throw new Error('unavailable'); } })).toThrow('unavailable');
  expect(a.listeners + b.listeners).toBe(0);
});
