// Public API of @bim-open-toolkit/interact: camera state, navigation modes, input bindings and
// camera animation. Pure except for `dom.ts`, and free of any renderer or DOM types elsewhere.

// A unit vector at right angles to a direction, chosen the same way for a given input.
export { perpendicularTo } from './camera.js';
// The camera's own orthonormal axes, safe for degenerate poses.
export { cameraBasis, type CameraBasis } from './camera.js';
// Tilt and distance limits for an orbiting camera, and a default that keeps it off both poles.
export { defaultOrbitLimits, type OrbitLimits } from './camera.js';
// A camera's position relative to its target as a distance and two angles, and its inverse.
export { orbitAngles, poseFromOrbit, type OrbitAngles } from './camera.js';
// Swing the camera around its target about a given up axis.
export { orbitPose } from './camera.js';
// Turn the camera in place, keeping its position: free look.
export { lookPose } from './camera.js';
// Move the camera toward or away from its target by a multiplicative factor.
export { dollyPose } from './camera.js';
// Slide the camera and its target in the plane of the screen.
export { panPose } from './camera.js';
// Move the camera and its target along the ground plane and the up axis, as a walker does.
export { walkPose } from './camera.js';
// The world-to-camera transform as a column-major matrix.
export { viewMatrix } from './camera.js';
// A camera looking straight down the up axis at a fixed heading, and the heading of such a camera.
export { overheadPose, overheadHeading } from './camera.js';

// Which of the two ways of projecting a view uses.
export { type ProjectionKind } from './projection.js';
// The camera-to-clip transform as a column-major matrix.
export { projectionMatrix } from './projection.js';
// How much of the scene a projection covers at a distance, and the distance that covers a height.
export { frameHeightAt, distanceForHeight } from './projection.js';
// Switch a view between perspective and orthographic while it keeps showing about the same thing.
export { setProjectionKind, defaultFieldOfViewDegrees } from './projection.js';
// Scale an orthographic frame within limits; perspective zooms by moving instead.
export { zoomProjection, defaultZoomLimits, type ZoomLimits } from './projection.js';
// Place a camera so a box fills the picture, re-cutting the depth planes around it.
export { fitBounds, defaultFitOptions, type FitOptions } from './projection.js';

// The normalised input record the navigation reducers read, and what a pointer looks like in it.
export { type InputFrame, type PointerSample, type PointerKind, type Viewport } from './input.js';
// The names bindings use for buttons and modifier keys.
export { type MouseButton, type ModifierName } from './input.js';
// Build a frame with nothing happening, and clear the movement out of one after a step.
export { emptyFrame, restFrame } from './input.js';
// Whether anything is happening, and whether a pointer is actually pressed rather than hovering.
export { isIdle, isDragging } from './input.js';
// Read what is held: modifiers, keys and mouse buttons.
export { hasModifiers, isKeyDown, normalizeKey, mouseButtons, heldButton } from './input.js';
// Viewport arithmetic: a size that is never zero, its aspect, and a drag measured against it.
export { safeViewport, aspectOf, normalizedDrag } from './input.js';
// Gesture arithmetic over the pointers of a frame: which ones, how they moved, how they spread.
export { pointersOfKind, dragDelta, pinchScale } from './input.js';

// The three ways a view responds to input, and the list of them for a user interface to offer.
export { type NavMode, navModes } from './bindings.js';
// The named things navigation can be asked to do by a drag, a wheel, a pinch or a held key.
export { type DragAction, type WheelAction, type PinchAction, type MoveAction } from './bindings.js';
// The configurable map from device input to those actions, entry by entry.
export {
  type Bindings,
  type DragBinding,
  type WheelBinding,
  type KeyBinding,
  type TouchBinding,
} from './bindings.js';
// The table each mode starts with, and which actions each mode acts on.
export { defaultBindings, supportedActions, type SupportedActions } from './bindings.js';
// Check a rebound table against a mode: repeats are errors, actions the mode ignores are warnings.
export { validateBindings } from './bindings.js';
// Read a frame through a binding table.
export { resolveDrag, resolveWheel, resolveMoves } from './bindings.js';
