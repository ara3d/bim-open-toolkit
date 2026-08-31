/** Raw triangle mesh geometry as typed arrays. Immutable once created. */
export interface MeshBuffers {
  /** Vertex positions, xyz triples. */
  readonly positions: Float32Array;
  /** Vertex normals, xyz triples; same length as positions. Optional (flat shading is computed if absent). */
  readonly normals?: Float32Array;
  /** Triangle vertex indices. Optional (non-indexed geometry if absent). */
  readonly indices?: Uint32Array;
}

export const vertexCount = (mesh: MeshBuffers): number =>
  mesh.positions.length / 3;

export const triangleCount = (mesh: MeshBuffers): number =>
  (mesh.indices ? mesh.indices.length : vertexCount(mesh)) / 3;

/** Throws if the buffers are inconsistent (bad lengths, out-of-range indices). */
export function validateMeshBuffers(mesh: MeshBuffers): void {
  if (mesh.positions.length % 3 !== 0)
    throw new Error(`positions length ${mesh.positions.length} is not a multiple of 3`);
  if (mesh.normals && mesh.normals.length !== mesh.positions.length)
    throw new Error(`normals length ${mesh.normals.length} != positions length ${mesh.positions.length}`);
  if (mesh.indices) {
    if (mesh.indices.length % 3 !== 0)
      throw new Error(`indices length ${mesh.indices.length} is not a multiple of 3`);
    const n = vertexCount(mesh);
    for (const i of mesh.indices)
      if (i >= n) throw new Error(`index ${i} out of range (vertex count ${n})`);
  }
}
