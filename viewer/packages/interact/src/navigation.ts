import {
  upVector,
  viewDistance,
  type Bounds,
  type CameraPose,
  type Vec3,
  type ViewState,
} from '@bim-open-toolkit/model';
import {
  defaultOrbitLimits,
  dollyPose,
  lookPose,
  orbitPose,
  overheadPose,
  panPose,
  screenHeading,
  walkPose,
  type OrbitLimits,
} from './camera.js';
import {
  defaultZoomLimits,
  fitBounds,
  frameHeightAt,
  setProjectionKind,
  zoomProjection,
  type FitOptions,
  type ZoomLimits,
} from './projection.js';
import {
  dragDelta,
  isDragging,
  normalizedDrag,
  pinchScale,
  pointersOfKind,
  type InputFrame,
} from './input.js';
import {
  defaultBindings,
  resolveDrag,
  resolveMoves,
  resolveWheel,
  supportedActions,
  type Bindings,
  type MoveAction,
  type NavMode,
} from './bindings.js';
import { clamp, finite } from './numbers.js';

// How fast and how far navigation responds. Everything a user can tune lives here, so a viewer
// exposes one object rather than a spread of knobs.
export type NavSettings = {
  // Radians the view turns per viewport height dragged.
  readonly rotateSpeed: number;
  // Screen heights of scene panned per viewport height dragged. One means the scene follows the pointer.
  readonly panSpeed: number;
  // How strongly the wheel dollies, zooms or changes walking speed.
  readonly zoomSpeed: number;
  // Scene units a second while a movement key is held, in first-person navigation.
  readonly moveSpeed: number;
  // What the boost key multiplies the walking speed by.
  readonly boostFactor: number;
  readonly minMoveSpeed: number;
  readonly maxMoveSpeed: number;
  // Reverse the vertical drag of free look, as flight controls do.
  readonly invertLook: boolean;
  readonly orbit: OrbitLimits;
  readonly zoom: ZoomLimits;
};

// Settings suited to a metre-scale building: a half turn per viewport dragged, walking pace movement.
export const defaultNavSettings: NavSettings = {
  rotateSpeed: Math.PI,
  panSpeed: 1,
  zoomSpeed: 1,
  moveSpeed: 5,
  boostFactor: 4,
  minMoveSpeed: 0.05,
  maxMoveSpeed: 500,
  invertLook: false,
  orbit: defaultOrbitLimits,
  zoom: defaultZoomLimits,
};

// Everything a navigating view holds: what it shows, how it responds and how it is bound.
// It is plain data, so it is saved, compared and restored without asking the renderer anything.
export type NavState = {
  readonly view: ViewState;
  readonly mode: NavMode;
  readonly settings: NavSettings;
  readonly bindings: Bindings;
};

// A navigation state over a view, with the mode's default bindings unless another table is given.
export const navState = (
  view: ViewState,
  mode: NavMode = 'orbit',
  settings: NavSettings = defaultNavSettings,
  bindings: Bindings = defaultBindings[mode],
): NavState => constrainToMode({ view, mode, settings, bindings });

// A navigation mode as a pure function of what is showing, what the device did during the step and
// how long the step lasted in seconds. Nothing else is read and nothing outside is changed.
export type ModeReducer = (state: NavState, input: InputFrame, dt: number) => NavState;

// The up axis of the frame the view reports in.
const upOf = (state: NavState): Vec3 => upVector(state.view.coordinates.up);

// The state with a different camera, leaving everything else alone.
const withCamera = (state: NavState, camera: CameraPose): NavState => ({
  ...state,
  view: { ...state.view, camera },
});

// The view held to what its mode requires. Overhead is the only mode that constrains it: the
// camera looks straight down at the heading it already had and the projection becomes
// orthographic, so panning and zooming can never turn the picture. Leaving overhead does not
// undo the projection, because what the user can see is what they asked for.
export const constrainToMode = (state: NavState): NavState => {
  if (state.mode !== 'overhead') return state;
  const up = upOf(state);
  const flat = setProjectionKind(state.view, 'orthographic');
  return { ...state, view: { ...flat, camera: overheadPose(flat.camera, up, screenHeading(state.view.camera, up)) } };
};

// The state switched to another mode, with the view adjusted to what that mode requires.
// The new mode's default bindings come with it; pass a table to keep bindings of your own.
export const setMode = (
  state: NavState,
  mode: NavMode,
  bindings: Bindings = defaultBindings[mode],
): NavState => constrainToMode({ ...state, mode, bindings });

// The state framed on a box, keeping what its mode requires. A box with nothing in it changes nothing.
export const fitState = (state: NavState, bounds: Bounds, options?: FitOptions): NavState => {
  const fitted = options === undefined ? fitBounds(state.view, bounds) : fitBounds(state.view, bounds, options);
  return fitted === undefined ? state : constrainToMode({ ...state, view: fitted });
};

// How far the scene moves for a full viewport height of drag, in scene units.
const panScale = (state: NavState): number =>
  frameHeightAt(state.view.projection, viewDistance(state.view.camera)) * state.settings.panSpeed;

// A wheel or pinch turned into a multiplier: above one means further away or a wider frame.
const wheelFactor = (amount: number, zoomSpeed: number): number => Math.exp(amount * 0.001 * zoomSpeed);

// The state after the drag its bindings resolve to. A hovering pointer is not a drag.
const applyDrag = (state: NavState, input: InputFrame): NavState => {
  const action = resolveDrag(state.bindings, input);
  if (action === undefined || !isDragging(input) || !supportedActions[state.mode].drag.includes(action)) return state;
  const delta = dragDelta(input.pointers);
  const dx = normalizedDrag(finite(delta.dx), input.viewport);
  const dy = normalizedDrag(finite(delta.dy), input.viewport);
  // A held button that has not moved must change nothing at all: rebuilding the pose from its
  // angles is not exactly the identity, and a still hand would otherwise drift over many frames.
  if (dx === 0 && dy === 0) return state;
  const { rotateSpeed, invertLook, orbit } = state.settings;
  const up = upOf(state);
  const camera = state.view.camera;
  switch (action) {
    // Dragging right swings the camera left, so the scene follows the pointer; dragging down
    // lifts the camera, so the top of the scene tips toward the viewer.
    case 'orbit':
      return withCamera(state, orbitPose(camera, up, -dx * rotateSpeed, -dy * rotateSpeed, orbit));
    // Dragging right turns the view right, as mouse look does, unless the look is inverted.
    case 'look':
      return withCamera(
        state,
        lookPose(camera, up, -dx * rotateSpeed, (invertLook ? -dy : dy) * rotateSpeed, orbit),
      );
    // The scene follows the pointer, so the camera moves the other way.
    case 'pan':
      return withCamera(state, panPose(camera, -dx * panScale(state), dy * panScale(state)));
    case 'dolly':
      return withCamera(state, dollyPose(camera, Math.exp(dy * state.settings.zoomSpeed), orbit));
  }
};

// The state after two fingers spread or closed. Spreading looks closer.
const applyPinch = (state: NavState, input: InputFrame): NavState => {
  const scale = pinchScale(pointersOfKind(input, 'touch'));
  const action = state.bindings.pinch;
  if (scale === 1 || action === 'none' || !supportedActions[state.mode].pinch.includes(action)) return state;
  const factor = 1 / scale;
  return action === 'zoom'
    ? { ...state, view: { ...state.view, projection: zoomProjection(state.view.projection, factor, state.settings.zoom) } }
    : withCamera(state, dollyPose(state.view.camera, factor, state.settings.orbit));
};

// The state after the wheel turned. Zooming a perspective view has no frame to scale, so it moves
// the camera instead, which is what a user means by zoom either way.
const applyWheel = (state: NavState, input: InputFrame): NavState => {
  const action = resolveWheel(state.bindings, input);
  if (action === undefined || action === 'none' || !supportedActions[state.mode].wheel.includes(action)) return state;
  const amount = finite(input.wheel);
  const factor = wheelFactor(amount, state.settings.zoomSpeed);
  if (action === 'speed') {
    const { minMoveSpeed, maxMoveSpeed } = state.settings;
    const moveSpeed = clamp(state.settings.moveSpeed / factor, minMoveSpeed, maxMoveSpeed);
    return { ...state, settings: { ...state.settings, moveSpeed } };
  }
  if (action === 'zoom' && state.view.projection.kind === 'orthographic') {
    return { ...state, view: { ...state.view, projection: zoomProjection(state.view.projection, factor, state.settings.zoom) } };
  }
  return withCamera(state, dollyPose(state.view.camera, factor, state.settings.orbit));
};

// How far each way the held movement keys ask to go, as a unit direction so a diagonal is not faster.
const moveDirection = (moves: readonly MoveAction[]): { readonly forward: number; readonly right: number; readonly up: number } => {
  const axis = (positive: MoveAction, negative: MoveAction): number =>
    (moves.includes(positive) ? 1 : 0) - (moves.includes(negative) ? 1 : 0);
  const direction = { forward: axis('forward', 'back'), right: axis('right', 'left'), up: axis('rise', 'fall') };
  const length = Math.hypot(direction.forward, direction.right, direction.up);
  return length === 0
    ? direction
    : { forward: direction.forward / length, right: direction.right / length, up: direction.up / length };
};

// The state after the movement keys were held for that long. First-person walking moves at the
// settings' speed in scene units; overhead panning moves a screen height a second, so it stays
// usable however far out the view is zoomed.
const applyMoves = (state: NavState, input: InputFrame, dt: number): NavState => {
  const moves = resolveMoves(state.bindings, input).filter((move) => supportedActions[state.mode].move.includes(move));
  const direction = moveDirection(moves);
  if (direction.forward === 0 && direction.right === 0 && direction.up === 0) return state;
  const boost = moves.includes('boost') ? state.settings.boostFactor : 1;
  const speed = (state.mode === 'overhead' ? panScale(state) : state.settings.moveSpeed * boost) * dt;
  return withCamera(
    state,
    walkPose(state.view.camera, upOf(state), direction.forward * speed, direction.right * speed, direction.up * speed),
  );
};

// One step of navigation in whichever mode the state is in.
export const stepNavigation: ModeReducer = (state, input, dt) => {
  const seconds = Math.max(finite(dt), 0);
  return constrainToMode(applyMoves(applyWheel(applyPinch(applyDrag(state, input), input), input), input, seconds));
};

// The three modes as named reducers. Each pins the state to its own mode first, keeping whatever
// bindings the state carries; `setMode` is the call that also takes the new mode's default table.

// Orbit navigation: a drag swings the camera around a target it keeps, the wheel moves closer.
export const orbitMode: ModeReducer = (state, input, dt) =>
  stepNavigation(state.mode === 'orbit' ? state : setMode(state, 'orbit', state.bindings), input, dt);

// First-person navigation: a drag turns the view in place and the movement keys walk.
export const firstPersonMode: ModeReducer = (state, input, dt) =>
  stepNavigation(state.mode === 'first-person' ? state : setMode(state, 'first-person', state.bindings), input, dt);

// Overhead navigation: a top-down orthographic view that only pans and zooms, never turning.
export const overheadMode: ModeReducer = (state, input, dt) =>
  stepNavigation(state.mode === 'overhead' ? state : setMode(state, 'overhead', state.bindings), input, dt);

// The reducer for each mode, for a caller that holds the mode as data.
export const modeReducers: Readonly<Record<NavMode, ModeReducer>> = {
  orbit: orbitMode,
  'first-person': firstPersonMode,
  overhead: overheadMode,
};
