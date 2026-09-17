// The only place three.js and the interact package meet: an interact view written onto the
// viewer's camera, and a pointer position turned into the ray the render package picks with.

import { rayThroughNdc, type Ray } from '@bim-open-toolkit/render';
import type { Matrix4, ViewState } from '@bim-open-toolkit/model';
import { Matrix4 as ThreeMatrix4, Vector3, type PerspectiveCamera } from 'three';

// A three matrix as the model package's column-major sixteen. Indexing `elements` is checked, so
// every element is defaulted; there is no conversion in either package.
export const matrixOf = (source: ThreeMatrix4): Matrix4 => {
  const e = source.elements;
  return [
    e[0] ?? 0, e[1] ?? 0, e[2] ?? 0, e[3] ?? 0,
    e[4] ?? 0, e[5] ?? 0, e[6] ?? 0, e[7] ?? 0,
    e[8] ?? 0, e[9] ?? 0, e[10] ?? 0, e[11] ?? 0,
    e[12] ?? 0, e[13] ?? 0, e[14] ?? 0, e[15] ?? 0,
  ];
};

// Writes an interact view onto a perspective camera. An orthographic view would need a different
// camera object, which this page does not create, so its projection is left alone.
export const applyView = (camera: PerspectiveCamera, view: ViewState): void => {
  camera.up.set(view.camera.up[0], view.camera.up[1], view.camera.up[2]);
  camera.position.set(view.camera.position[0], view.camera.position[1], view.camera.position[2]);
  camera.lookAt(new Vector3(view.camera.target[0], view.camera.target[1], view.camera.target[2]));
  if (view.projection.kind === 'perspective') {
    camera.fov = view.projection.fieldOfViewDegrees;
    camera.near = view.projection.near;
    camera.far = view.projection.far;
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
};

// The world ray through a point given in client coordinates, or undefined when the camera's
// matrices cannot be inverted into one.
export const rayThroughPoint = (
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): Ray | undefined => {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return undefined;
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  const inverse = new ThreeMatrix4().multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
  return rayThroughNdc(matrixOf(inverse), x, y);
};
