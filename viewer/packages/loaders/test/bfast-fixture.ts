import { bytesOf, writeBFast } from '../src/bfast-writer.js';
export { bytesOf, writeBFast } from '../src/bfast-writer.js';

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
