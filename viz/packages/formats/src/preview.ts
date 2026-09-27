// A box preview of a prepared BFAST: one world box per drawn placement, read from the stored
// per-instance boxes without touching any vertex or index buffer.
//
// A prepared BFAST already carries a world-space AABB per instance, `InstanceBoundsData`, computed by
// the converter as the placement's mesh box transformed by its matrix. Reading that table plus the
// small instance and mesh-slice tables costs nothing next to parsing and validating the geometry
// itself, which is why this can run before the full parse.
import {
  emptyBounds,
  expandBounds,
  isEmptyBounds,
  type Bounds,
  type CoordinateContext,
} from '@bim-open-toolkit/model';
import {
  instanceTransformFinite,
  readBFast,
  readRenderModelTables,
  type RenderModelTables,
} from '@ara3d/viewer-loaders';
import { bfastCoordinates } from './bfast.js';
import { colorWord, flagsWord, hiddenFlag, instanceWords, meshSliceInts, meshWord } from './bfast-layout.js';
import { fail, formatCode } from './diagnostics.js';

/** Floats per box in `BoxPreview.boxes`: min xyz, then max xyz. */
export const previewBoxStride = 6;

/** A coarse stand-in for a model: one world box per drawn placement, in source colour, built without reading geometry. */
export type BoxPreview = {
  /** `previewBoxStride` floats per box, world coordinates. */
  readonly boxes: Float32Array;
  /** RGBA per box, 0 to 1: the placement's source colour. */
  readonly colors: Float32Array;
  readonly count: number;
  /** Union over every placement the full model binds (alpha 0 included, hidden excluded), so a camera fitted to it stays put on refinement. */
  readonly bounds: Bounds;
  readonly coordinates: CoordinateContext;
  /** Drawn placements left out because their box exceeds `maxVolumeFraction` of the bounds' volume. */
  readonly oversized: number;
};

export type BoxPreviewOptions = {
  /** Defaults to `bfastCoordinates`. */
  readonly coordinates?: CoordinateContext;
  /** Default 0.001. Not applied when the bounds have zero volume. */
  readonly maxVolumeFraction?: number;
};

const defaultMaxVolumeFraction = 0.001;

/** The box preview of a prepared BFAST. Raises a FormatError when the bytes are not a BFAST render model or its instance tables disagree in length. */
export function readBoxPreview(bytes: Uint8Array, options: BoxPreviewOptions = {}): BoxPreview {
  const tables = readTables(bytes);
  const coordinates = options.coordinates ?? bfastCoordinates;
  const maxVolumeFraction = options.maxVolumeFraction ?? defaultMaxVolumeFraction;

  const recordCount = Math.floor(tables.instanceInts.length / instanceWords);
  const boundsRecordCount = Math.floor(tables.instanceBounds.length / previewBoxStride);
  if (recordCount !== boundsRecordCount) {
    fail(
      formatCode.invalidBfast,
      `BFAST has ${recordCount} instance records but ${boundsRecordCount} instance bounds`,
    );
  }

  // Every placement the model binds: a mesh with vertices, not hidden, and a finite transform. Alpha
  // plays no part here, so a bound alpha-0 placement still widens `bounds`, matching the full binding.
  const boundRows: number[] = [];
  let bounds: Bounds = emptyBounds;
  for (let row = 0; row < recordCount; row += 1) {
    if (!isBound(tables, row)) continue;
    bounds = unionBox(bounds, tables.instanceBounds, row);
    boundRows.push(row);
  }

  const volume = boundsVolume(bounds);
  const cap = volume > 0 ? volume * maxVolumeFraction : undefined;

  const boxes = new Float32Array(boundRows.length * previewBoxStride);
  const colors = new Float32Array(boundRows.length * 4);
  let count = 0;
  let oversized = 0;
  for (const row of boundRows) {
    const alpha = instanceAlpha(tables, row);
    if (alpha === 0) continue;
    if (cap !== undefined && boxVolume(tables.instanceBounds, row) > cap) {
      oversized += 1;
      continue;
    }
    boxes.set(
      tables.instanceBounds.subarray(row * previewBoxStride, row * previewBoxStride + previewBoxStride),
      count * previewBoxStride,
    );
    writeColor(tables, row, alpha, colors, count * 4);
    count += 1;
  }

  return {
    boxes: boxes.subarray(0, count * previewBoxStride),
    colors: colors.subarray(0, count * 4),
    count,
    bounds,
    coordinates,
    oversized,
  };
}

// Reads the BFAST header and its render tables, turning the loader's own errors into a `FormatError`
// so a caller of this package never sees a plain `Error` from a dependency.
function readTables(bytes: Uint8Array): RenderModelTables {
  try {
    const bfast = readBFast(bytes.buffer, bytes.byteOffset);
    return readRenderModelTables((name) => bfast.get(name));
  } catch (error) {
    return fail(formatCode.invalidBfast, error instanceof Error ? error.message : String(error));
  }
}

// A placement the full model binds: a mesh with vertices, not hidden, and a finite transform.
function isBound(tables: RenderModelTables, row: number): boolean {
  const at = row * instanceWords;
  const mesh = tables.instanceInts[at + meshWord] ?? -1;
  if (mesh < 0) return false;
  const vertices = tables.meshSlices[mesh * meshSliceInts + 1] ?? 0;
  if (vertices <= 0) return false;
  if (isHidden(tables, row)) return false;
  return instanceTransformFinite(tables, row);
}

// Byte 1 of the flags word holds the instance flags; bit 0 of those means the instance is not drawn.
function isHidden(tables: RenderModelTables, row: number): boolean {
  const flags = tables.instanceInts[row * instanceWords + flagsWord] ?? 0;
  return ((flags >>> 8) & hiddenFlag) !== 0;
}

// The alpha byte of the packed RGBA colour, 0 to 255.
function instanceAlpha(tables: RenderModelTables, row: number): number {
  const packed = tables.instanceInts[row * instanceWords + colorWord] ?? 0;
  return (packed >>> 24) & 0xff;
}

// Writes the placement's source colour, 0 to 1 per channel, at `at` in `out`.
function writeColor(tables: RenderModelTables, row: number, alpha: number, out: Float32Array, at: number): void {
  const packed = tables.instanceInts[row * instanceWords + colorWord] ?? 0;
  out[at] = (packed & 0xff) / 255;
  out[at + 1] = ((packed >>> 8) & 0xff) / 255;
  out[at + 2] = ((packed >>> 16) & 0xff) / 255;
  out[at + 3] = alpha / 255;
}

// The union of `bounds` and the instance's stored world box, read directly rather than recomputed
// from the mesh box and the transform: the converter already did that work once.
function unionBox(bounds: Bounds, instanceBounds: Float32Array, row: number): Bounds {
  const at = row * previewBoxStride;
  const min: readonly [number, number, number] = [
    instanceBounds[at] ?? 0,
    instanceBounds[at + 1] ?? 0,
    instanceBounds[at + 2] ?? 0,
  ];
  const max: readonly [number, number, number] = [
    instanceBounds[at + 3] ?? 0,
    instanceBounds[at + 4] ?? 0,
    instanceBounds[at + 5] ?? 0,
  ];
  return expandBounds(expandBounds(bounds, min), max);
}

// The volume of one stored instance box.
function boxVolume(instanceBounds: Float32Array, row: number): number {
  const at = row * previewBoxStride;
  const dx = (instanceBounds[at + 3] ?? 0) - (instanceBounds[at] ?? 0);
  const dy = (instanceBounds[at + 4] ?? 0) - (instanceBounds[at + 1] ?? 0);
  const dz = (instanceBounds[at + 5] ?? 0) - (instanceBounds[at + 2] ?? 0);
  return dx * dy * dz;
}

// The volume of `bounds`, or 0 when it is empty, so the cap can be skipped rather than divide by it.
function boundsVolume(bounds: Bounds): number {
  if (isEmptyBounds(bounds)) return 0;
  return (bounds.max[0] - bounds.min[0]) * (bounds.max[1] - bounds.min[1]) * (bounds.max[2] - bounds.min[2]);
}
