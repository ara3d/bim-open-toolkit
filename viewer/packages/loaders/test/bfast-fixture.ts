/*
Adapted from https://github.com/ara3d/ara3d-webgl (src/loader).
MIT License

Copyright (c) 2025 Ara 3D Inc.
Copyright (c) 2021 VIMaec LLC.
Copyright (c) 2018 Ara 3D Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
/**
 * Minimal BFAST writer, used by the tests to produce fixtures.
 * The library only reads BFAST, so this deliberately lives outside `src`.
 */
const ALIGNMENT = 64
const PREAMBLE_BYTES = 32
const RANGE_BYTES = 16

const align = (n: number) => (n + ALIGNMENT - 1) & ~(ALIGNMENT - 1)

/** Packs named buffers into BFAST bytes, 64-byte aligning each one. */
export function writeBFast (buffers: { name: string; bytes: Uint8Array }[]): Uint8Array {
  const nameBytes = new TextEncoder().encode(buffers.map((b) => b.name).join('\0') + '\0')
  const payloads = [nameBytes, ...buffers.map((b) => b.bytes)]
  const count = payloads.length

  const ranges: [number, number][] = []
  let at = align(PREAMBLE_BYTES + count * RANGE_BYTES)
  for (const p of payloads) {
    ranges.push([at, at + p.byteLength])
    at = align(at + p.byteLength)
  }

  const out = new Uint8Array(align(ranges[ranges.length - 1][1]))
  const view = new DataView(out.buffer)
  view.setBigInt64(0, BigInt(0xbfa5), true)
  view.setBigInt64(8, BigInt(ranges[0][0]), true)
  view.setBigInt64(16, BigInt(ranges[ranges.length - 1][1]), true)
  view.setBigInt64(24, BigInt(count), true)

  ranges.forEach(([begin, end], i) => {
    view.setBigInt64(PREAMBLE_BYTES + i * RANGE_BYTES, BigInt(begin), true)
    view.setBigInt64(PREAMBLE_BYTES + i * RANGE_BYTES + 8, BigInt(end), true)
  })

  payloads.forEach((p, i) => out.set(p, ranges[i][0]))
  return out
}

export const bytesOf = (a: ArrayBufferView) =>
  new Uint8Array(a.buffer, a.byteOffset, a.byteLength)

/** Triangle with opaque/transparent placements, plus hidden and geometry-free entities. */
export function bfastFixture(mutate?: (buffers: Map<string, Uint8Array>) => void): ArrayBuffer {
  const instances = new Float32Array(4 * 16);
  const ints = new Int32Array(instances.buffer);
  for (let i = 0; i < 4; i++) {
    instances.set([1, 0, 0, 10 + i, 0, 2, 0, 20, 0, 0, 3, 30], i * 16);
    ints[i * 16 + 12] = i === 3 ? -1 : 0;
    ints[i * 16 + 13] = i === 1 ? 0 : i;
    ints[i * 16 + 14] = i === 1 ? 0x80402010 : -1;
    ints[i * 16 + 15] = (64 << 24) | (128 << 16) | (i === 2 ? 256 : 0);
  }
  const meta = new Uint8Array(48);
  new DataView(meta.buffer).setInt32(40, 3, true);
  const buffers = new Map([
    ['VertexData', bytesOf(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))],
    ['IndexData', bytesOf(new Uint32Array([0, 1, 2]))],
    ['MeshSliceData', bytesOf(new Int32Array([0, 3, 0, 3]))],
    ['InstanceData', bytesOf(instances)],
    ['MeshBoundsData', bytesOf(new Float32Array(6))],
    ['InstanceBoundsData', bytesOf(new Float32Array(24))],
    ['Meta', meta],
  ]);
  mutate?.(buffers);
  return writeBFast([...buffers].map(([name, bytes]) => ({ name, bytes }))).buffer as ArrayBuffer;
}
