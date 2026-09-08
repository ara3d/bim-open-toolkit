import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

// The names a consumer is promised. A name leaving this list is a breaking change, and a new
// export that is not listed here has not been given its line in `src/index.ts`.
const published: readonly string[] = [
  'dot', 'cross', 'perpendicularTo', 'lerpVec3', 'unitSlerp',
  'cameraBasis', 'defaultOrbitLimits', 'orbitAngles', 'poseFromOrbit', 'orbitPose', 'lookPose',
  'dollyPose', 'panPose', 'walkPose', 'viewMatrix', 'overheadPose', 'screenHeading',
  'projectionMatrix', 'frameHeightAt', 'distanceForHeight', 'setProjectionKind',
  'defaultFieldOfViewDegrees', 'zoomProjection', 'defaultZoomLimits', 'fitBounds', 'defaultFitOptions',
  'emptyFrame', 'restFrame', 'isIdle', 'isDragging', 'hasModifiers', 'isKeyDown', 'normalizeKey',
  'mouseButtons', 'heldButton', 'safeViewport', 'aspectOf', 'normalizedDrag', 'pointersOfKind',
  'dragDelta', 'pinchScale',
  'navModes', 'defaultBindings', 'supportedActions', 'validateBindings', 'resolveDrag',
  'resolveWheel', 'resolveMoves',
  'defaultNavSettings', 'navState', 'stepNavigation', 'orbitMode', 'firstPersonMode',
  'overheadMode', 'modeReducers', 'setMode', 'constrainToMode', 'fitState',
  'easings', 'flyTo', 'defaultFlightMs', 'advanceFlight', 'flightFraction', 'isFlightDone',
  'flightView', 'blendPose', 'blendProjection', 'interrupts',
  'navSession', 'isFlying', 'startFlight', 'cancelFlight', 'stepSession',
  'attachNavigation', 'browserFrames',
];

describe('@bim-open-toolkit/interact', () => {
  it('publishes exactly the names it says it does', () => {
    expect([...Object.keys(api)].sort()).toEqual([...published].sort());
  });

  it('has something behind every name and no default export', () => {
    for (const name of published) expect(Reflect.get(api, name)).toBeDefined();
    expect(Reflect.get(api, 'default')).toBeUndefined();
  });
});
