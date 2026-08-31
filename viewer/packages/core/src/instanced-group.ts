import { MeshBuffers, validateMeshBuffers } from './mesh-buffers.js';
import { MaterialConfig, defaultMaterial } from './material.js';

/** Floats per instance transform (a 4x4 column-major matrix). */
export const TRANSFORM_STRIDE = 16;
/** Floats per instance color (RGBA). */
export const COLOR_STRIDE = 4;

/**
 * One mesh drawn many times: a MeshBuffers plus per-instance 4x4 transforms
 * and per-instance RGBA colors. Instances can be appended incrementally
 * (for progressive loading) and colors updated after creation.
 *
 * Mutations bump version counters so renderers can sync lazily.
 */
export class InstancedGroup {
  readonly mesh: MeshBuffers;
  readonly material: MaterialConfig;

  private _count = 0;
  private _transforms: Float32Array;
  private _colors: Float32Array;
  private _visible = true;
  private _countVersion = 0;
  private _transformsVersion = 0;
  private _colorsVersion = 0;
  private _visibilityVersion = 0;

  constructor(
    mesh: MeshBuffers,
    material: MaterialConfig = defaultMaterial,
    initialCapacity: number = 16,
  ) {
    validateMeshBuffers(mesh);
    this.mesh = mesh;
    this.material = material;
    const cap = Math.max(1, initialCapacity);
    this._transforms = new Float32Array(cap * TRANSFORM_STRIDE);
    this._colors = new Float32Array(cap * COLOR_STRIDE);
  }

  get instanceCount(): number { return this._count; }
  get capacity(): number { return this._colors.length / COLOR_STRIDE; }

  get visible(): boolean { return this._visible; }
  set visible(v: boolean) {
    if (v === this._visible) return;
    this._visible = v;
    this._visibilityVersion++;
  }

  /** Bumped when instances are appended (capacity may have changed too). */
  get countVersion(): number { return this._countVersion; }
  /** Bumped when any transform changes. */
  get transformsVersion(): number { return this._transformsVersion; }
  /** Bumped when any color changes. */
  get colorsVersion(): number { return this._colorsVersion; }
  /** Bumped when visibility toggles. */
  get visibilityVersion(): number { return this._visibilityVersion; }

  /** Live view of the used portion of the transform buffer (16 floats per instance). */
  get transforms(): Float32Array {
    return this._transforms.subarray(0, this._count * TRANSFORM_STRIDE);
  }

  /** Live view of the used portion of the color buffer (RGBA per instance). */
  get colors(): Float32Array {
    return this._colors.subarray(0, this._count * COLOR_STRIDE);
  }

  /**
   * Appends instances. `transforms` is 16 floats per instance (column-major 4x4);
   * `colors` is 4 floats (RGBA) per instance for the same number of instances.
   * Returns the index of the first appended instance.
   */
  append(transforms: Float32Array, colors: Float32Array): number {
    if (transforms.length % TRANSFORM_STRIDE !== 0)
      throw new Error(`transforms length ${transforms.length} is not a multiple of ${TRANSFORM_STRIDE}`);
    const n = transforms.length / TRANSFORM_STRIDE;
    if (colors.length !== n * COLOR_STRIDE)
      throw new Error(`colors length ${colors.length} != ${n * COLOR_STRIDE} (${n} instances)`);
    const start = this._count;
    this.ensureCapacity(start + n);
    this._transforms.set(transforms, start * TRANSFORM_STRIDE);
    this._colors.set(colors, start * COLOR_STRIDE);
    this._count += n;
    this._countVersion++;
    this._transformsVersion++;
    this._colorsVersion++;
    return start;
  }

  /** Sets the RGBA color of one instance. */
  setColor(index: number, r: number, g: number, b: number, a: number): void {
    this.checkIndex(index);
    const o = index * COLOR_STRIDE;
    this._colors[o] = r;
    this._colors[o + 1] = g;
    this._colors[o + 2] = b;
    this._colors[o + 3] = a;
    this._colorsVersion++;
  }

  /** Overwrites RGBA colors for a contiguous range starting at `start`. */
  setColors(start: number, colors: Float32Array): void {
    if (colors.length % COLOR_STRIDE !== 0)
      throw new Error(`colors length ${colors.length} is not a multiple of ${COLOR_STRIDE}`);
    const n = colors.length / COLOR_STRIDE;
    this.checkIndex(start);
    if (start + n > this._count)
      throw new Error(`range [${start}, ${start + n}) exceeds instance count ${this._count}`);
    this._colors.set(colors, start * COLOR_STRIDE);
    this._colorsVersion++;
  }

  /** Returns a copy of one instance's RGBA color. */
  getColor(index: number): Float32Array {
    this.checkIndex(index);
    const o = index * COLOR_STRIDE;
    return this._colors.slice(o, o + COLOR_STRIDE);
  }

  /** Overwrites one instance's 4x4 transform (16 floats, column-major). */
  setTransform(index: number, matrix: Float32Array): void {
    this.checkIndex(index);
    if (matrix.length !== TRANSFORM_STRIDE)
      throw new Error(`matrix length ${matrix.length} != ${TRANSFORM_STRIDE}`);
    this._transforms.set(matrix, index * TRANSFORM_STRIDE);
    this._transformsVersion++;
  }

  /** Returns a copy of one instance's 4x4 transform. */
  getTransform(index: number): Float32Array {
    this.checkIndex(index);
    const o = index * TRANSFORM_STRIDE;
    return this._transforms.slice(o, o + TRANSFORM_STRIDE);
  }

  private checkIndex(index: number): void {
    if (index < 0 || index >= this._count)
      throw new Error(`instance index ${index} out of range (count ${this._count})`);
  }

  private ensureCapacity(needed: number): void {
    let cap = this.capacity;
    if (needed <= cap) return;
    while (cap < needed) cap *= 2;
    const t = new Float32Array(cap * TRANSFORM_STRIDE);
    t.set(this._transforms);
    this._transforms = t;
    const c = new Float32Array(cap * COLOR_STRIDE);
    c.set(this._colors);
    this._colors = c;
  }
}
