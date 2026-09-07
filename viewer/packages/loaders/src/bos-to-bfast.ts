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
import JSZip from 'jszip'
import * as THREE from 'three'
import { parseBosGeometryFromZip } from './bos-loader.js'
import { BOS_BUFFER_PREFIX } from './bim-data.js'
import { parseBfastModel } from './bfast-loader.js'
import type { BosGeometry } from './bos-geometry.js'
import { INSTANCE_FLOAT_STRIDE, MESH_SLICE_INTS } from './renderModel.js'
import { bytesOf, writeBFast } from './bfast-writer.js'

const VERTEX_SCALE = 1 / 10_000

/** Interleaved float positions, in model units. */
function buildVertices (bg: BosGeometry): Float32Array {
  const n = bg.VertexX.length
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    out[i * 3] = bg.VertexX[i] * VERTEX_SCALE
    out[i * 3 + 1] = bg.VertexY[i] * VERTEX_SCALE
    out[i * 3 + 2] = bg.VertexZ[i] * VERTEX_SCALE
  }
  return out
}

/** BOS stores mesh offsets; a render model stores explicit slices. */
function buildMeshSlices (bg: BosGeometry): Int32Array {
  const meshes = bg.MeshVertexOffset.length
  const out = new Int32Array(meshes * MESH_SLICE_INTS)
  for (let m = 0; m < meshes; m++) {
    const vertexEnd = m + 1 < meshes ? bg.MeshVertexOffset[m + 1] : bg.VertexX.length
    const indexEnd = m + 1 < meshes ? bg.MeshIndexOffset[m + 1] : bg.IndexBuffer.length
    out[m * MESH_SLICE_INTS] = bg.MeshVertexOffset[m]
    out[m * MESH_SLICE_INTS + 1] = vertexEnd - bg.MeshVertexOffset[m]
    out[m * MESH_SLICE_INTS + 2] = bg.MeshIndexOffset[m]
    out[m * MESH_SLICE_INTS + 3] = indexEnd - bg.MeshIndexOffset[m]
  }
  return out
}

/** Local space AABB of each mesh, from its own vertices. */
function buildMeshBounds (bg: BosGeometry, slices: Int32Array): Float32Array {
  const meshes = slices.length / MESH_SLICE_INTS
  const out = new Float32Array(meshes * 6)
  for (let m = 0; m < meshes; m++) {
    const start = slices[m * MESH_SLICE_INTS]
    const end = start + slices[m * MESH_SLICE_INTS + 1]
    const box = new THREE.Box3()
    for (let v = start; v < end; v++) {
      box.expandByPoint(new THREE.Vector3(
        bg.VertexX[v] * VERTEX_SCALE, bg.VertexY[v] * VERTEX_SCALE, bg.VertexZ[v] * VERTEX_SCALE))
    }
    if (box.isEmpty()) box.set(new THREE.Vector3(), new THREE.Vector3())
    box.min.toArray(out, m * 6)
    box.max.toArray(out, m * 6 + 3)
  }
  return out
}

/** 64 byte instance records, plus their world space boxes. */
function buildInstanceData (bg: BosGeometry, meshBounds: Float32Array) {
  const n = bg.InstanceMeshIndex.length
  const floats = new Float32Array(n * INSTANCE_FLOAT_STRIDE)
  const ints = new Int32Array(floats.buffer)
  const bounds = new Float32Array(n * 6)

  const matrix = new THREE.Matrix4()
  const box = new THREE.Box3()

  for (let i = 0; i < n; i++) {
    const t = bg.InstanceTransformIndex[i]
    const mesh = bg.InstanceMeshIndex[i]
    const mat = bg.InstanceMaterialIndex[i]
    // Geometry-free entities may have no transform row at all.
    if (mesh < 0 && (t < 0 || t >= bg.TransformTX.length)) matrix.identity()
    else matrix.compose(
      new THREE.Vector3(bg.TransformTX[t], bg.TransformTY[t], bg.TransformTZ[t]),
      new THREE.Quaternion(bg.TransformQX[t], bg.TransformQY[t], bg.TransformQZ[t], bg.TransformQW[t]),
      new THREE.Vector3(bg.TransformSX[t], bg.TransformSY[t], bg.TransformSZ[t]))

    // The file holds the three rows of a 3x4 matrix; THREE stores columns.
    const e = matrix.elements
    const r = i * INSTANCE_FLOAT_STRIDE
    floats[r + 0] = e[0]; floats[r + 1] = e[4]; floats[r + 2] = e[8]; floats[r + 3] = e[12]
    floats[r + 4] = e[1]; floats[r + 5] = e[5]; floats[r + 6] = e[9]; floats[r + 7] = e[13]
    floats[r + 8] = e[2]; floats[r + 9] = e[6]; floats[r + 10] = e[10]; floats[r + 11] = e[14]

    ints[r + 12] = mesh
    ints[r + 13] = bg.InstanceEntityIndex?.[i] ?? -1
    ints[r + 14] =
      ((bg.MaterialRed[mat] ?? 255) |
      ((bg.MaterialGreen[mat] ?? 255) << 8) |
      ((bg.MaterialBlue[mat] ?? 255) << 16) |
      ((bg.MaterialAlpha[mat] ?? 255) << 24)) | 0
    ints[r + 15] =
      ((bg.InstanceFlags[i] & 0xff) << 8) |
      (((bg.MaterialRoughness[mat] ?? 128) & 0xff) << 16) |
      (((bg.MaterialMetallic[mat] ?? 0) & 0xff) << 24)

    if (mesh < 0) continue
    box.min.fromArray(meshBounds, mesh * 6)
    box.max.fromArray(meshBounds, mesh * 6 + 3)
    box.applyMatrix4(matrix)
    box.min.toArray(bounds, i * 6)
    box.max.toArray(bounds, i * 6 + 3)
  }

  return { floats, bounds }
}

function buildMeta (bg: BosGeometry, slices: Int32Array, instanceBounds: Float32Array) {
  const meta = new ArrayBuffer(48)
  const v = new DataView(meta)
  const box = new THREE.Box3()
  const n = bg.InstanceMeshIndex.length
  let faces = 0
  let vertices = 0
  for (let i = 0; i < n; i++) {
    const mesh = bg.InstanceMeshIndex[i]
    // Only instances that will be drawn: a hidden or empty one placed far from
    // the model would otherwise widen the bounds a camera frames.
    if (mesh < 0) continue
    if (bg.InstanceFlags[i] & 0x1) continue
    if (slices[mesh * MESH_SLICE_INTS + 3] === 0) continue
    box.expandByPoint(new THREE.Vector3().fromArray(instanceBounds, i * 6))
    box.expandByPoint(new THREE.Vector3().fromArray(instanceBounds, i * 6 + 3))
    vertices += slices[mesh * MESH_SLICE_INTS + 1]
    faces += slices[mesh * MESH_SLICE_INTS + 3] / 3
  }
  if (box.isEmpty()) box.set(new THREE.Vector3(), new THREE.Vector3())
  box.min.toArray().forEach((x, i) => v.setFloat32(i * 4, x, true))
  box.max.toArray().forEach((x, i) => v.setFloat32(12 + i * 4, x, true))
  v.setBigInt64(24, BigInt(vertices), true)
  v.setBigInt64(32, BigInt(faces), true)
  v.setInt32(40, 3, true)
  v.setInt32(44, 0, true)
  return new Uint8Array(meta)
}

/** Prepares geometry and retains every original Parquet entry byte-for-byte. */
export async function bosToBfast (input: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(input)
  const bg = await parseBosGeometryFromZip(zip)
  const tables = []
  for (const entry of Object.values(zip.files)) {
    if (!entry.dir && entry.name.toLowerCase().endsWith('.parquet'))
      tables.push({ name: BOS_BUFFER_PREFIX + entry.name, bytes: await entry.async('uint8array') })
  }

  const meshSlices = buildMeshSlices(bg)
  const meshBounds = buildMeshBounds(bg, meshSlices)
  const { floats, bounds } = buildInstanceData(bg, meshBounds)

  const bfast = writeBFast([
    { name: 'VertexData', bytes: bytesOf(buildVertices(bg)) },
    { name: 'IndexData', bytes: bytesOf(Uint32Array.from(bg.IndexBuffer)) },
    { name: 'MeshSliceData', bytes: bytesOf(meshSlices) },
    { name: 'InstanceData', bytes: bytesOf(floats) },
    { name: 'MeshBoundsData', bytes: bytesOf(meshBounds) },
    { name: 'InstanceBoundsData', bytes: bytesOf(bounds) },
    { name: 'Meta', bytes: buildMeta(bg, meshSlices, bounds) },
    ...tables
  ])

  const buffer = bfast.buffer as ArrayBuffer
  parseBfastModel(buffer) // Reject invalid prepared geometry before publishing the container.
  return buffer
}
