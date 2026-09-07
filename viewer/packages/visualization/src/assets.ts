import { InstancedGroup } from '@ara3d/viewer-core';
import { convertObject, type LoadSource } from '@ara3d/viewer-loaders';
import { LoadingManager, Matrix4 as ThreeMatrix4, Mesh, MeshStandardMaterial, type Object3D, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { identityMatrix, type Diagnostic, type Matrix4, type ModelRef, type ObjectRecord, type Result } from './contracts.js';
import type { LoadedBosModel } from './loading.js';
import type { InstanceBinding } from './render.js';

export type AssetFormat = 'glb' | 'gltf' | 'obj' | 'stl';
export type AssetOptions = {
  readonly signal?: AbortSignal;
  readonly sourceUp?: 'Y' | 'Z';
  readonly resources?: (uri: string, signal?: AbortSignal) => Promise<ArrayBuffer | Blob>;
};
type AssetJson = { buffers?: { uri?: string }[]; images?: { uri?: string }[]; [key: string]: unknown };

async function bytes(source: LoadSource, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (typeof source !== 'string') return source instanceof ArrayBuffer ? source : source.arrayBuffer();
  const response = await fetch(source, signal ? { signal } : {});
  if (!response.ok) throw new Error(`Asset fetch failed: ${response.status}`);
  if (response.headers.get('content-type')?.includes('text/html')) throw new Error('Asset endpoint returned HTML');
  return response.arrayBuffer();
}

function dataUrl(buffer: ArrayBuffer, mime = 'application/octet-stream'): string {
  const values = new Uint8Array(buffer); let binary = '';
  for (let i = 0; i < values.length; i += 32768) binary += String.fromCharCode(...values.subarray(i, i + 32768));
  return `data:${mime};base64,${btoa(binary)}`;
}

function gltfJson(buffer: ArrayBuffer, format: 'glb' | 'gltf'): AssetJson {
  if (format === 'gltf') return JSON.parse(new TextDecoder().decode(buffer)) as AssetJson;
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength)
    throw new Error('Invalid GLB header');
  let json: AssetJson | undefined, binary: ArrayBuffer | undefined;
  for (let offset = 12; offset < buffer.byteLength;) {
    if (offset + 8 > buffer.byteLength) throw new Error('Truncated GLB chunk');
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    offset += 8;
    if (offset + length > buffer.byteLength) throw new Error('Truncated GLB chunk');
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset, length))) as AssetJson;
    if (type === 0x004e4942) binary = buffer.slice(offset, offset + length);
    offset += length;
  }
  if (!json) throw new Error('GLB JSON chunk missing');
  if (binary && json.buffers?.[0] && !json.buffers[0].uri) json.buffers[0].uri = dataUrl(binary);
  return json;
}

async function resolveResources(json: AssetJson, options: AssetOptions): Promise<void> {
  const resolved = new Map<string, string>();
  for (const entry of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (!entry.uri || entry.uri.startsWith('data:')) continue;
    options.signal?.throwIfAborted();
    const uri = entry.uri;
    if (!resolved.has(uri)) {
      if (!options.resources) throw new Error(`Explicit resource resolver required: ${uri}`);
      const resource = await options.resources(uri, options.signal);
      options.signal?.throwIfAborted();
      const mime = resource instanceof Blob && resource.type ? resource.type : /\.png(?:\?|$)/i.test(uri) ? 'image/png' : /\.jpe?g(?:\?|$)/i.test(uri) ? 'image/jpeg' : 'application/octet-stream';
      resolved.set(uri, dataUrl(resource instanceof ArrayBuffer ? resource : await resource.arrayBuffer(), mime));
    }
    entry.uri = resolved.get(uri)!;
  }
}

function disposeObjects(roots: readonly Object3D[]): void {
  const geometries = new Set<Mesh['geometry']>(), materials = new Set<MeshStandardMaterial>(), textures = new Set<Texture>();
  const images = new Set<{ close(): void }>();
  for (const root of roots) root.traverse(object => {
    const mesh = object as Mesh; if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material as MeshStandardMaterial);
      for (const value of Object.values(material)) if ((value as Texture | null)?.isTexture) textures.add(value as Texture);
    }
  });
  for (const texture of textures) {
    const image = texture.image as { close?: () => void } | undefined;
    if (typeof image?.close === 'function') images.add(image as { close(): void });
    texture.dispose();
  }
  for (const image of images) image.close();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

/** Geometry asset ingestion. IDs are generated visual references, never inferred BIM facts. */
export async function loadAssetModel(source: LoadSource, format: AssetFormat, modelRef: ModelRef, options: AssetOptions = {}): Promise<Result<LoadedBosModel>> {
  const roots: Object3D[] = [];
  const diagnostics = new Map<string, Diagnostic>();
  const warn = (code: string, message: string) => diagnostics.set(code, { code, message });
  const check = () => options.signal?.throwIfAborted();
  try {
    check(); const buffer = await bytes(source, options.signal); check();
    let root: Object3D;
    if (format === 'glb' || format === 'gltf') {
      const json = gltfJson(buffer, format);
      await resolveResources(json, options); check();
      const manager = new LoadingManager();
      manager.setURLModifier(url => {
        if (!url.startsWith('data:') && !url.startsWith('blob:')) throw new Error('Unresolved external asset resource blocked');
        return url;
      });
      const parsed = await new GLTFLoader(manager).parseAsync(JSON.stringify(json), '');
      roots.push(...parsed.scenes); root = parsed.scene;
      if (parsed.animations.length) warn('static-pose', 'Animation clips are not transferred; geometry uses its initial pose.');
    } else if (format === 'obj') {
      const text = new TextDecoder().decode(buffer);
      root = new OBJLoader().parse(text); roots.push(root);
      if (/^\s*(mtllib|usemtl)\s/m.test(text)) warn('obj-materials', 'OBJ material libraries are not loaded; neutral fallback materials are used.');
    } else if (format === 'stl') {
      root = new Mesh(new STLLoader().parse(buffer), new MeshStandardMaterial({ color: 0xb0b8c0 })); roots.push(root);
    } else throw new Error('Unsupported asset format');
    check();
    root.traverse(object => {
      const mesh = object as Mesh; if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material) && mesh.material.length > 1) warn('multi-material', 'Core rendering uses the first material for multi-material meshes.');
      if (mesh.geometry.getAttribute('color')) warn('vertex-colors', 'Core rendering does not transfer vertex colors.');
      if ('isSkinnedMesh' in mesh || mesh.morphTargetInfluences?.length) warn('static-pose', 'Skinning and morph animation are not transferred.');
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        if (Object.values(material).some(value => (value as Texture | null)?.isTexture)) warn('textures', 'Textures were loaded but core rendering supports material color only.');
    });
    const converted = convertObject(root);
    if (!converted.instanceCount) throw new Error('Asset contains no supported triangle geometry');
    const matrix = new ThreeMatrix4(), local = new ThreeMatrix4();
    const conversion = options.sourceUp === 'Z' ? new ThreeMatrix4().makeRotationX(-Math.PI / 2) : new ThreeMatrix4();
    const objects: ObjectRecord[] = [], bindings: InstanceBinding[] = [];
    for (const [groupIndex, original] of converted.groups.entries()) {
      const group = original.material.opacity === 1 ? original : new InstancedGroup(original.mesh, { ...original.material, opacity: 1 }, original.instanceCount);
      if (group !== original) group.append(original.transforms, original.colors);
      const transforms = group.transforms, colors = group.colors;
      for (let instanceIndex = 0; instanceIndex < group.instanceCount; instanceIndex++) {
        if (bindings.length && bindings.length % 4096 === 0) { await new Promise<void>(resolve => setTimeout(resolve, 0)); check(); }
        const transform = matrix.multiplyMatrices(conversion, local.fromArray(transforms, instanceIndex * 16)).toArray();
        if (!transform.every(Number.isFinite)) throw new Error('Invalid asset transform');
        const ref = { modelId: modelRef.id, objectId: `visual:${groupIndex}:${instanceIndex}` };
        objects.push({ ref, name: `Visual object ${objects.length + 1}`, transform: identityMatrix, appearance: { color: [1,1,1], opacity: 1, visible: true } });
        const offset = instanceIndex * 4;
        const colorFactor = [colors[offset]!, colors[offset + 1]!, colors[offset + 2]!, colors[offset + 3]!] as const;
        bindings.push({ ref, representationId: ref.objectId, group, instanceIndex, localTransform: Object.freeze(transform) as unknown as Matrix4, colorFactor });
        if (options.sourceUp === 'Z') group.setTransform(instanceIndex, new Float32Array(transform));
      }
    }
    check();
    return { ok: true, value: { model: { ref: { ...modelRef }, coordinates: { units: 'unknown', up: 'Y', registration: 'unknown' }, objects }, bindings }, diagnostics: [...diagnostics.values()] };
  } catch (error) {
    return { ok: false, diagnostics: [{ code: options.signal?.aborted ? 'aborted' : 'asset-load-failed', message: options.signal?.aborted ? 'Asset loading cancelled' : error instanceof Error ? error.message : 'Asset loading failed' }] };
  } finally { disposeObjects(roots); }
}
