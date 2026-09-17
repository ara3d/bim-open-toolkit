// Public API of @bim-open-toolkit/interact: camera state, navigation modes, input bindings and
// camera animation. Pure except for `dom.ts`, and free of any renderer or DOM types elsewhere.

// Vector arithmetic model does not carry: scalar and vector products.
export { dot, cross } from './vec.js';
// A unit vector at right angles to a direction, chosen the same way for a given input.
export { perpendicularTo } from './vec.js';
// Blend two points along a straight line, and turn one direction toward another along the shorter arc.
export { lerpVec3, unitSlerp } from './vec.js';
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
// A camera looking straight down the up axis at a fixed heading, and which way is up the screen.
export { overheadPose, screenHeading } from './camera.js';

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

// How fast and how far navigation responds, and a set of values suited to a metre-scale building.
export { type NavSettings, defaultNavSettings } from './navigation.js';
// Everything a navigating view holds, as plain data that can be saved and restored.
export { type NavState, navState } from './navigation.js';
// A navigation mode: what shows, what the device did, how long the step lasted, what shows next.
export { type ModeReducer } from './navigation.js';
// One step of navigation in whichever mode the state is in.
export { stepNavigation } from './navigation.js';
// The three modes as reducers of their own, and the reducer for a mode held as data.
export { orbitMode, firstPersonMode, overheadMode, modeReducers } from './navigation.js';
// Switch mode, and hold a view to what its mode requires.
export { setMode, constrainToMode } from './navigation.js';
// Frame a box, keeping what the mode requires.
export { fitState } from './navigation.js';

// The curves an animation runs on, by name and as functions.
export { type Ease, type EaseName, easings } from './animation.js';
// A camera flight as plain data, and how long one lasts when nobody says.
export { type CameraFlight, flyTo, defaultFlightMs } from './animation.js';
// Step a flight on a clock the caller owns, and ask where it has got to.
export { advanceFlight, flightFraction, isFlightDone, flightView } from './animation.js';
// Blend a pose or a projection directly, for a caller composing its own animation.
export { blendPose, blendProjection } from './animation.js';
// Whether the user did something that should take the camera back from a flight.
export { interrupts } from './animation.js';

// Navigation and an optional flight together: the whole interactive state of one view.
export { type NavSession, navSession, isFlying } from './session.js';
// Start a flight to a view, or drop the one running and keep where it reached.
export { startFlight, cancelFlight } from './session.js';
// One step of the whole view, in milliseconds.
export { stepSession } from './session.js';

// Attach navigation to an element: the only impure part of this package.
export { attachNavigation, type NavController, type NavOptions } from './dom.js';
// What the adapter needs from an element and from an event; a real element has all of it.
export { type NavElement, type NavEvent } from './dom.js';
// Where frames come from: the browser's own, or a clock a test winds by hand.
export { browserFrames, type FrameScheduler } from './dom.js';
