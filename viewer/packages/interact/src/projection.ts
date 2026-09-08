import {
  atDistance,
  boundsCenter,
  boundsRadius,
  fitDistance,
  isEmptyBounds,
  normalizeVec3,
  orthographic,
  perspective,
  scaleVec3,
  subVec3,
  viewDirection,
  viewDistance,
  viewState,
  type Bounds,
  type Matrix4,
  type Projection,
  type Vec3,
  type ViewState,
} from '@bim-open-toolkit/model';
import { cameraBasis } from './camera.js';
import { clamp } from './numbers.js';

// Which of the two ways of projecting a view uses.
export type ProjectionKind = Projection['kind'];

// The vertical field of view in radians, for a perspective projection.
const radians = (degrees: number): number => (degrees * Math.PI) / 180;

// The transform taking camera coordinates into clip coordinates, column-major, right-handed, with
// depth mapped to the range -1 to 1 as WebGL expects. `aspect` is viewport width over height.
export const projectionMatrix = (projection: Projection, aspect: number): Matrix4 => {
  const { near, far } = projection;
  if (projection.kind === 'perspective') {
    const focal = 1 / Math.tan(radians(projection.fieldOfViewDegrees) / 2);
    return [
      focal / aspect, 0, 0, 0,
      0, focal, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0,
    ];
  }
  const halfHeight = projection.height / 2;
  const halfWidth = halfHeight * aspect;
  return [
    1 / halfWidth, 0, 0, 0,
    0, 1 / halfHeight, 0, 0,
    0, 0, -2 / (far - near), 0,
    0, 0, -(far + near) / (far - near), 1,
  ];
};

// How tall a slice of the scene the projection covers at that distance in front of the camera.
// An orthographic projection covers the same height everywhere, so the distance does not matter.
export const frameHeightAt = (projection: Projection, distance: number): number =>
  projection.kind === 'orthographic'
    ? projection.height
    : 2 * distance * Math.tan(radians(projection.fieldOfViewDegrees) / 2);

// The distance at which a perspective projection covers that height, or undefined for orthographic.
export const distanceForHeight = (projection: Projection, height: number): number | undefined =>
  projection.kind === 'orthographic'
    ? undefined
    : height / 2 / Math.tan(radians(projection.fieldOfViewDegrees) / 2);

// The field of view a perspective projection reverts to when a view has never had one.
export const defaultFieldOfViewDegrees = 50;

// The view projected the other way while showing about the same amount of the scene.
// Turning perspective off keeps the camera where it is and sizes the orthographic frame to what it
// saw at the target. Turning it on keeps the target and moves the camera to the matching distance.
// Switching to the kind the view already uses changes nothing.
export const setProjectionKind = (
  view: ViewState,
  kind: ProjectionKind,
  fieldOfViewDegrees = defaultFieldOfViewDegrees,
): ViewState => {
  const { projection, camera } = view;
  if (projection.kind === kind) return view;
  const distance = viewDistance(camera);
  if (kind === 'orthographic') {
    return { ...view, projection: orthographic(frameHeightAt(projection, distance), projection.near, projection.far) };
  }
  const wanted = perspective(fieldOfViewDegrees, projection.near, projection.far);
  const moved = distanceForHeight(wanted, frameHeightAt(projection, distance)) ?? distance;
  return { ...view, camera: atDistance(camera, moved), projection: wanted };
};

// How far a view may zoom out or in, as a frame height for orthographic and a distance otherwise.
export type ZoomLimits = {
  readonly minHeight: number;
  readonly maxHeight: number;
};

// Limits that keep an orthographic frame within a millimetre-to-planet range.
export const defaultZoomLimits: ZoomLimits = { minHeight: 0.001, maxHeight: 1.0e7 };

// The projection scaled by a factor below one to show less. Only an orthographic frame changes;
// a perspective view zooms by moving its camera, which `dollyPose` does.
export const zoomProjection = (
  projection: Projection,
  factor: number,
  limits: ZoomLimits = defaultZoomLimits,
): Projection =>
  projection.kind === 'orthographic'
    ? orthographic(clamp(projection.height * factor, limits.minHeight, limits.maxHeight), projection.near, projection.far)
    : projection;

// How to place a camera so that a box fills the picture.
export type FitOptions = {
  // Viewport width over height. Both dimensions are respected, so nothing is cut off.
  readonly aspect: number;
  // Extra room around the box, as a multiple of the fitted size. One means a tight fit.
  readonly padding: number;
  // Where the camera looks from, toward the box. Defaults to the direction the view already looks.
  readonly direction?: Vec3 | undefined;
};

// A tight fit in a square viewport, with a little room around the box.
export const defaultFitOptions: FitOptions = { aspect: 1, padding: 1.05 };

// The near and far planes that bracket a sphere of that radius seen from that distance.
const depthRange = (distance: number, radius: number): { readonly near: number; readonly far: number } => {
  const margin = Math.max(radius * 0.1, 0.001);
  return { near: Math.max(distance - radius - margin, radius * 1.0e-4, 0.001), far: distance + radius + margin };
};

// The view moved so the box fills the picture, keeping the projection kind and the up axis.
// The near and far planes are re-cut around the box so nothing is clipped and depth stays precise.
// An empty box has nothing to fit, so the result is undefined and the caller keeps its view.
export const fitBounds = (
  view: ViewState,
  bounds: Bounds,
  options: FitOptions = defaultFitOptions,
): ViewState | undefined => {
  const center = boundsCenter(bounds);
  const radius = boundsRadius(bounds);
  if (center === undefined || radius === undefined || isEmptyBounds(bounds)) return undefined;
  const aspect = options.aspect > 0 ? options.aspect : 1;
  const padding = Math.max(options.padding, 1);
  const forward =
    normalizeVec3(options.direction ?? viewDirection(view.camera)) ?? cameraBasis(view.camera).forward;
  const size = Math.max(radius, Number.EPSILON) * padding;
  const distance =
    view.projection.kind === 'orthographic'
      ? size * 2
      : Math.max(fitDistance(size, view.projection, aspect), Number.EPSILON);
  const range = depthRange(distance, size);
  const projection =
    view.projection.kind === 'orthographic'
      ? orthographic(size * 2 * Math.max(1, 1 / aspect), range.near, range.far)
      : perspective(view.projection.fieldOfViewDegrees, range.near, range.far);
  const position = subVec3(center, scaleVec3(forward, distance));
  return viewState({ position, target: center, up: view.camera.up }, projection, view.coordinates);
};
