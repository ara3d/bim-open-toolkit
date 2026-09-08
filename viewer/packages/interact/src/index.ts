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
