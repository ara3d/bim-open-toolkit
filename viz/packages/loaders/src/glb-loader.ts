import { Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ViewerScene } from '@ara3d/viewer-core';
import { LoadOptions, LoadSource } from './progress.js';
import { toArrayBuffer } from './fetch-buffer.js';
import { convertObject } from './three-convert.js';
import { ConvertResult } from './groups.js';

/** Parses GLB (or embedded glTF) bytes into a three object hierarchy. */
export function parseGlb(buffer: ArrayBuffer): Promise<Object3D> {
  return new Promise((resolve, reject) =>
    new GLTFLoader().parse(buffer, '', (gltf) => resolve(gltf.scene), reject),
  );
}

/**
 * Loads a GLB into the scene: fetch (when `source` is a URL), parse via three's
 * GLTFLoader, then convert to InstancedGroups — baking node transforms and
 * merging reused meshes into instances. Groups are added to `scene` one by one
 * as they are produced; `onProgress` reports each stage.
 */
export async function loadGlb(
  source: LoadSource,
  scene: ViewerScene,
  options: LoadOptions = {},
): Promise<ConvertResult> {
  const onProgress = options.onProgress;
  const buffer = await toArrayBuffer(source, onProgress);
  onProgress?.({ stage: 'parse', loaded: 0, total: 1 });
  const root = await parseGlb(buffer);
  onProgress?.({ stage: 'parse', loaded: 1, total: 1 });
  return convertObject(root, (group, index, total) => {
    scene.addGroup(group);
    onProgress?.({ stage: 'convert', loaded: index + 1, total });
  });
}
