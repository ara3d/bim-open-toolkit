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
 * BFAST serialization adapted from ara3d-webgl/tests/writeBFast.mts.
 */
const ALIGNMENT = 64
const PREAMBLE_BYTES = 32
const RANGE_BYTES = 16

const align = (n: number) => Math.ceil(n / ALIGNMENT) * ALIGNMENT

/** Packs named buffers into BFAST bytes, 64-byte aligning each one. */
export function writeBFast (buffers: { name: string; bytes: Uint8Array }[]): Uint8Array {
  if (buffers.some(b => !b.name || b.name.includes('\0')) || new Set(buffers.map(b => b.name)).size !== buffers.length)
    throw new Error('BFAST buffer names must be nonempty, unique and contain no NUL');
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
