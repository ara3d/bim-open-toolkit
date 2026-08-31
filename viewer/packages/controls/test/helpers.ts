import { InstancedGroup, MeshBuffers } from '@ara3d/viewer-core';

/** A quad in the XY plane spanning [-1,1]^2 at z=0. */
export const quad = (): MeshBuffers => ({
  positions: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
});

export const identity = (): Float32Array =>
  new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export const translation = (x: number, y: number, z: number): Float32Array => {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
};

export const white = (): Float32Array => new Float32Array([1, 1, 1, 1]);

export const quadGroupAt = (
  positions: Array<[number, number, number]>,
  initialCapacity = positions.length,
): InstancedGroup => {
  const g = new InstancedGroup(quad(), undefined, initialCapacity);
  for (const [x, y, z] of positions) g.append(translation(x, y, z), white());
  return g;
};

type Handler = (event: unknown) => void;

/** Fake DOM element: records listeners and lets tests dispatch events. */
export class FakeElement {
  readonly clientHeight = 100;
  readonly captured: number[] = [];
  private listeners = new Map<string, Handler[]>();

  addEventListener(type: string, listener: Handler): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: Handler): void {
    const list = this.listeners.get(type) ?? [];
    const i = list.indexOf(listener);
    if (i >= 0) list.splice(i, 1);
  }

  setPointerCapture(pointerId: number): void {
    this.captured.push(pointerId);
  }

  releasePointerCapture(): void {}

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 100, height: 100 };
  }

  dispatch(type: string, event: object): void {
    for (const l of [...(this.listeners.get(type) ?? [])]) l(event);
  }

  listenerCount(): number {
    let n = 0;
    for (const list of this.listeners.values()) n += list.length;
    return n;
  }
}
