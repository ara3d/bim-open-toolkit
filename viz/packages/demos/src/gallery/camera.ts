// The only place the interact package and three.js meet: a view state written onto the camera
// viewer-core owns, the world ray under a pointer, and the world-to-canvas projection a HUD needs.
//
// The slice wrote these three by hand in `src/slice/camera.ts` and had no projection at all. They
// are here so `viewer.ts` holds no three.js, and so the sixteen `?? 0`s that
// `noUncheckedIndexedAccess` forces on a matrix conversion are written once rather than per caller.

import { projectToScreen, rayThroughNdc, type Ray } from '@bim-open-toolkit/render';
import type { Matrix4, Vec2, Vec3, ViewState } from '@bim-open-toolkit/model';
import { Matrix4 as ThreeMatrix4, Vector3, type PerspectiveCamera } from 'three';

// A size in CSS pixels. Zero on either axis means the element is not laid out yet.
export type PixelSize = { readonly width: number; readonly height: number };

// Sixteen numbers in column-major order as the model package's matrix, whatever they arrive in.
export const matrix4From = (values: ArrayLike<number>): Matrix4 => [
  values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 0,
  values[4] ?? 0, values[5] ?? 0, values[6] ?? 0, values[7] ?? 0,
  values[8] ?? 0, values[9] ?? 0, values[10] ?? 0, values[11] ?? 0,
  values[12] ?? 0, values[13] ?? 0, values[14] ?? 0, values[15] ?? 0,
];

// Writes a view onto a perspective camera. An orthographic view keeps the camera's own projection,
// because viewer-core owns one perspective camera and swapping it is not this host's to do.
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

// World to clip: the camera's projection times its inverse world transform.
export const viewProjectionOf = (camera: PerspectiveCamera): Matrix4 =>
  matrix4From(new ThreeMatrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements);

// Clip to world, for turning a point on the picture back into a ray.
export const inverseViewProjectionOf = (camera: PerspectiveCamera): Matrix4 =>
  matrix4From(new ThreeMatrix4().multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse).elements);

// A world point as canvas pixels, or undefined when it is behind the camera or outside the depth
// range. The size is in CSS pixels, so the answer is where a positioned element goes.
export const projectPointOnto = (camera: PerspectiveCamera, size: PixelSize, point: Vec3): Vec2 | undefined => {
  if (size.width === 0 || size.height === 0) return undefined;
  const screen = projectToScreen(viewProjectionOf(camera), point, size.width, size.height);
  return screen === undefined ? undefined : [screen.x, screen.y];
};

// The world ray through a point given in client coordinates, or undefined when the element has no
// area on the page.
export const rayThroughClientPoint = (
  camera: PerspectiveCamera,
  element: Element,
  clientX: number,
  clientY: number,
): Ray | undefined => {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return undefined;
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  return rayThroughNdc(inverseViewProjectionOf(camera), x, y);
};
