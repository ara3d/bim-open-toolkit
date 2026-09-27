import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bosToBfast, instanceTransformFinite, readBFast, readRenderModelTables } from '@ara3d/viewer-loaders';
import { describe, expect, it } from 'vitest';
import { colorWord, flagsWord, hiddenFlag, instanceWords, meshSliceInts, meshWord } from '../src/bfast-layout.js';
import { formatCode, FormatError } from '../src/diagnostics.js';
import { previewBoxStride, readBoxPreview } from '../src/preview.js';
import { bfastModel, previewSample, triangleMesh, translationRows, writeBfast } from './fixtures.js';

describe('readBoxPreview', () => {
  it('reads the worked example: two drawn boxes, their colours, and the bounds of every bound placement', () => {
    const preview = readBoxPreview(previewSample());

    expect(preview.count).toBe(2);
    expect(Array.from(preview.boxes)).toEqual([0, 0, 0, 1, 1, 0, 5, 0, 0, 7, 2, 0]);
    expect(Array.from(preview.colors)).toEqual([1, 1, 1, 1, 1, 0, 0, Math.fround(128 / 255)]);
    expect(preview.bounds).toEqual({ min: [-3, 0, 0], max: [7, 2, 0] });
    expect(preview.oversized).toBe(0);
  });

  it('leaves out a drawn box that exceeds the volume cap, and keeps one that does not', () => {
    // A big box (volume 1000) and a small one (volume 0.125) inside it. Both are drawn opaque, so both
    // are bound and widen the bounds; only the big one is more than 0.1% of the bounds' own volume.
    const bigMesh = { positions: [0, 0, 0, 10, 10, 10], indices: [0, 1, 0] };
    const smallMesh = { positions: [0, 0, 0, 0.5, 0.5, 0.5], indices: [0, 1, 0] };
    const bytes = bfastModel({
      meshes: [bigMesh, smallMesh],
      instances: [
        { mesh: 0, entity: 0 },
        { mesh: 1, entity: 1 },
      ],
    });

    const preview = readBoxPreview(bytes);

    expect(preview.bounds).toEqual({ min: [0, 0, 0], max: [10, 10, 10] });
    expect(preview.oversized).toBe(1);
    expect(preview.count).toBe(1);
    expect(Array.from(preview.boxes)).toEqual([0, 0, 0, 0.5, 0.5, 0.5]);
  });

  it('raises a FormatError when the instance tables disagree in length', () => {
    const original = bfastModel({
      meshes: [triangleMesh()],
      instances: [
        { mesh: 0, entity: 0 },
        { mesh: 0, entity: 1, rows: translationRows(1, 0, 0) },
      ],
    });
    const bfast = readBFast(original.buffer, original.byteOffset);
    const shortened = writeBfast(
      bfast.buffers.map((buffer) => ({
        name: buffer.name,
        // Two instances, one instance bound: the tables disagree in length.
        bytes: buffer.name === 'InstanceBoundsData' ? buffer.bytes.slice(0, previewBoxStride * 4) : buffer.bytes,
      })),
    );

    let error: unknown;
    try {
      readBoxPreview(shortened);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(FormatError);
    expect((error as FormatError).code).toBe(formatCode.invalidBfast);
  });
});

// The private Duplex sample. Never used to validate anything but the box preview here, and skipped
// by name when the checkout does not carry `samples/`.
const duplexPath = fileURLToPath(new URL('../../../../samples/nrc/duplex-enriched.bos', import.meta.url));

describe.skipIf(!existsSync(duplexPath))(
  'Duplex (skipped: samples/nrc/duplex-enriched.bos is not on this machine)',
  () => {
    it(
      'matches the drawn alpha>0 row count and the union of every bound row\'s box',
      async () => {
        const bos = readFileSync(duplexPath);
        const prepared = await bosToBfast(bos.buffer.slice(bos.byteOffset, bos.byteOffset + bos.byteLength));

        // The volume cap is a separate, deliberate exclusion (covered by its own fixture test above);
        // disabling it here keeps this check to what the acceptance criteria ask for: that the drawn,
        // alpha>0 row count and the bounds union match a ground truth read of the raw tables.
        const preview = readBoxPreview(new Uint8Array(prepared), { maxVolumeFraction: Infinity });

        // An independent pass over the raw tables, so the test does not just repeat `readBoxPreview`'s
        // own logic back at it.
        const bfast = readBFast(prepared);
        const tables = readRenderModelTables((name) => bfast.get(name));
        const recordCount = Math.floor(tables.instanceInts.length / instanceWords);
        let expectedCount = 0;
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        for (let row = 0; row < recordCount; row += 1) {
          const at = row * instanceWords;
          const mesh = tables.instanceInts[at + meshWord] ?? -1;
          if (mesh < 0) continue;
          const vertices = tables.meshSlices[mesh * meshSliceInts + 1] ?? 0;
          if (vertices <= 0) continue;
          const flags = tables.instanceInts[at + flagsWord] ?? 0;
          if (((flags >>> 8) & hiddenFlag) !== 0) continue;
          if (!instanceTransformFinite(tables, row)) continue;

          const boxAt = row * previewBoxStride;
          for (let axis = 0; axis < 3; axis += 1) {
            min[axis] = Math.min(min[axis] ?? 0, tables.instanceBounds[boxAt + axis] ?? 0);
            max[axis] = Math.max(max[axis] ?? 0, tables.instanceBounds[boxAt + 3 + axis] ?? 0);
          }
          const packed = tables.instanceInts[at + colorWord] ?? 0;
          if (((packed >>> 24) & 0xff) > 0) expectedCount += 1;
        }

        expect(preview.count).toBe(expectedCount);
        for (let axis = 0; axis < 3; axis += 1) {
          expectRelative(preview.bounds.min[axis] ?? 0, min[axis] ?? 0);
          expectRelative(preview.bounds.max[axis] ?? 0, max[axis] ?? 0);
        }
      },
      60_000,
    );
  },
);

// Compares two numbers within 1e-4 of each other, relative to the expected value's own scale.
function expectRelative(actual: number, expected: number, tolerance = 1e-4): void {
  const scale = Math.max(Math.abs(expected), 1e-9);
  expect(Math.abs(actual - expected) / scale).toBeLessThanOrEqual(tolerance);
}
