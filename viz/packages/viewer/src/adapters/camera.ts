// Model view state written onto three cameras, and a pointer turned into a world ray.
//
// The model package's `ViewState` is a pose, a projection and the frame it is reported in. three
// has two camera classes for the two projections, so both are kept and the one the state asks for
// is the one handed to the renderer. That is what lets an overhead orthographic view be shown at
// all; the alpha and the end-to-end slice could only ever draw perspective.

import type { Matrix4, ViewState } from '@bim-open-toolkit/model';
import { rayThroughNdc as rayFromMatrix, type Ray } from '@bim-open-toolkit/render';
import { Matrix4 as ThreeMatrix4, OrthographicCamera, PerspectiveCamera, Vector3, type Camera } from 'three';

// A three matrix as the model package's column-major sixteen. `elements[i]` is optional under
// `noUncheckedIndexedAccess`, so every element is defaulted rather than asserted.
export const matrixOf = (source: ThreeMatrix4): Matrix4 => {
  const e = source.elements;
  return [
    e[0] ?? 0, e[1] ?? 0, e[2] ?? 0, e[3] ?? 0,
    e[4] ?? 0, e[5] ?? 0, e[6] ?? 0, e[7] ?? 0,
    e[8] ?? 0, e[9] ?? 0, e[10] ?? 0, e[11] ?? 0,
    e[12] ?? 0, e[13] ?? 0, e[14] ?? 0, e[15] ?? 0,
  ];
};

// Puts a camera where the pose says, looking where it looks, with the up axis the state declares.
const placeCamera = (camera: Camera, view: ViewState): void => {
  camera.up.set(view.camera.up[0], view.camera.up[1], view.camera.up[2]);
  camera.position.set(view.camera.position[0], view.camera.position[1], view.camera.position[2]);
  camera.lookAt(new Vector3(view.camera.target[0], view.camera.target[1], view.camera.target[2]));
  camera.updateMatrixWorld();
};

// Writes a view state onto the perspective camera and reports whether the state wanted it.
export const applyPerspective = (camera: PerspectiveCamera, view: ViewState, aspect: number): boolean => {
  placeCamera(camera, view);
  camera.aspect = aspect;
  if (view.projection.kind === 'perspective') {
    camera.fov = view.projection.fieldOfViewDegrees;
    camera.near = view.projection.near;
    camera.far = view.projection.far;
  }
  camera.updateProjectionMatrix();
  return view.projection.kind === 'perspective';
};

// Writes a view state onto the orthographic camera. The frame is the projection's height, widened
// by the aspect, so the picture covers the same scene height whatever shape the canvas is.
export const applyOrthographic = (camera: OrthographicCamera, view: ViewState, aspect: number): boolean => {
  placeCamera(camera, view);
  if (view.projection.kind === 'orthographic') {
    const height = Math.max(view.projection.height, Number.EPSILON);
    const width = height * (aspect > 0 ? aspect : 1);
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.near = view.projection.near;
    camera.far = view.projection.far;
  }
  camera.updateProjectionMatrix();
  return view.projection.kind === 'orthographic';
};

// The world ray through a point in normalized device coordinates, for either camera kind.
// `rayThroughNdc` does the perspective divide the model package's affine transform does not.
export const rayThroughCamera = (camera: Camera, x: number, y: number): Ray | undefined => {
  const inverse = new ThreeMatrix4().multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
  return rayFromMatrix(matrixOf(inverse), x, y);
};

// A point in client coordinates as normalized device coordinates in a rectangle, or undefined when
// the rectangle has no area.
export const ndcOf = (
  rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  clientX: number,
  clientY: number,
): { readonly x: number; readonly y: number } | undefined => {
  if (rect.width === 0 || rect.height === 0) return undefined;
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -(((clientY - rect.top) / rect.height) * 2 - 1),
  };
};
