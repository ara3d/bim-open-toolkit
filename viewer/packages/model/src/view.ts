import type { CoordinateContext } from './coordinates.js';
import { metresZUpLocal } from './coordinates.js';
import type { ObjectKey } from './identity.js';
import {
  addVec3, boundsCenter, boundsSize, isEmptyBounds, normalizeVec3, scaleVec3, subVec3, vec3Length,
  type Bounds, type Vec3,
} from './math.js';
import type { StyleRule } from './style.js';

// Where the camera is, what it looks at, and which way is up for it.
export type CameraPose = {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly up: Vec3;
};

// How the camera turns the scene into a picture. Distances are in the view's own units.
export type Projection =
  | { readonly kind: 'perspective'; readonly fieldOfViewDegrees: number; readonly near: number; readonly far: number }
  | { readonly kind: 'orthographic'; readonly height: number; readonly near: number; readonly far: number };

// A camera and its projection, in a declared coordinate frame.
export type ViewState = {
  readonly camera: CameraPose;
  readonly projection: Projection;
  readonly coordinates: CoordinateContext;
};

// A view a user saved: the camera plus the appearance state it was saved with.
// Members are keys rather than sets so a saved view is plain data a document can hold.
export type SavedView = {
  readonly id: string;
  readonly name: string;
  readonly view: ViewState;
  readonly selection: readonly ObjectKey[];
  readonly rules: readonly StyleRule[];
  readonly filter?: readonly ObjectKey[] | undefined;
  readonly savedAt?: string | undefined;
};

// A camera at a position looking at a target.
export const cameraPose = (position: Vec3, target: Vec3, up: Vec3): CameraPose => ({ position, target, up });

// A perspective projection with a vertical field of view in degrees.
export const perspective = (fieldOfViewDegrees = 50, near = 0.1, far = 10000): Projection => ({
  kind: 'perspective',
  fieldOfViewDegrees,
  near,
  far,
});

// An orthographic projection covering the given height in scene units.
export const orthographic = (height: number, near = 0.1, far = 10000): Projection => ({
  kind: 'orthographic',
  height,
  near,
  far,
});

// A view of a camera, a projection and the frame they are reported in.
export const viewState = (
  camera: CameraPose,
  projection: Projection = perspective(),
  coordinates: CoordinateContext = metresZUpLocal,
): ViewState => ({ camera, projection, coordinates });

// The direction the camera looks, not normalised.
export const viewDirection = (pose: CameraPose): Vec3 => subVec3(pose.target, pose.position);

// How far the camera is from what it looks at.
export const viewDistance = (pose: CameraPose): number => vec3Length(viewDirection(pose));

// The camera moved to a new distance from its target along the same direction.
export const atDistance = (pose: CameraPose, distance: number): CameraPose => {
  const direction = normalizeVec3(viewDirection(pose));
  return direction === undefined
    ? pose
    : { ...pose, position: subVec3(pose.target, scaleVec3(direction, distance)) };
};

// The radius of the smallest sphere around the box, or undefined when the box is empty.
export const boundsRadius = (bounds: Bounds): number | undefined => {
  const size = boundsSize(bounds);
  return size === undefined ? undefined : vec3Length(size) / 2;
};

// The vertical field of view in radians, or undefined for an orthographic projection.
const verticalFieldOfView = (projection: Projection): number | undefined =>
  projection.kind === 'perspective' ? (projection.fieldOfViewDegrees * Math.PI) / 180 : undefined;

// The distance at which a sphere of the radius fits the projection, given the viewport aspect.
// The narrower of the vertical and horizontal fields decides, so nothing is cut off.
export const fitDistance = (radius: number, projection: Projection, aspect: number): number => {
  const vertical = verticalFieldOfView(projection);
  if (vertical === undefined) return radius * 2;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * Math.max(aspect, Number.EPSILON));
  return radius / Math.sin(Math.min(vertical, horizontal) / 2);
};

// A view that shows the whole box, looking along the direction, or undefined when the box is empty.
// An orthographic projection is returned sized to the box; a perspective one keeps its field of view.
export const frameBounds = (
  bounds: Bounds,
  direction: Vec3,
  projection: Projection = perspective(),
  aspect = 1,
  up: Vec3 = [0, 0, 1],
): ViewState | undefined => {
  const center = boundsCenter(bounds);
  const radius = boundsRadius(bounds);
  const unit = normalizeVec3(direction);
  if (center === undefined || radius === undefined || unit === undefined || isEmptyBounds(bounds)) return undefined;
  const distance = fitDistance(radius, projection, aspect);
  const position = subVec3(center, scaleVec3(unit, distance));
  const framed: Projection =
    projection.kind === 'orthographic' ? orthographic(radius * 2, projection.near, projection.far) : projection;
  return viewState(cameraPose(position, center, up), framed);
};

// The camera moved by an offset, keeping what it looks at relative to it.
export const panBy = (pose: CameraPose, offset: Vec3): CameraPose => ({
  ...pose,
  position: addVec3(pose.position, offset),
  target: addVec3(pose.target, offset),
});

// A saved view of the current camera and appearance state.
export const savedView = (
  id: string,
  name: string,
  view: ViewState,
  selection: readonly ObjectKey[] = [],
  rules: readonly StyleRule[] = [],
): SavedView => ({ id, name, view, selection, rules });

// The saved view with that id, or undefined when there is none.
export const findSavedView = (views: readonly SavedView[], id: string): SavedView | undefined =>
  views.find((view) => view.id === id);

// The saved views with the given one added, replacing any earlier view of the same id.
export const putSavedView = (views: readonly SavedView[], view: SavedView): readonly SavedView[] =>
  findSavedView(views, view.id) === undefined
    ? [...views, view]
    : views.map((existing) => (existing.id === view.id ? view : existing));

// The saved views without the named one.
export const removeSavedView = (views: readonly SavedView[], id: string): readonly SavedView[] =>
  views.filter((view) => view.id !== id);

// The view a scene starts from before anything is loaded: a metre-scale camera at the origin.
export const defaultView: ViewState = viewState(cameraPose([10, -10, 10], [0, 0, 0], [0, 0, 1]));
