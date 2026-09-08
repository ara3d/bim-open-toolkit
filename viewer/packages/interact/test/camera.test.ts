import { describe, expect, it } from 'vitest';
import { cameraPose, viewDistance, type CameraPose, type Vec3 } from '@bim-open-toolkit/model';
import {
  cameraBasis,
  defaultOrbitLimits,
  dollyPose,
  lookPose,
  orbitAngles,
  orbitPose,
  overheadHeading,
  overheadPose,
  panPose,
  perpendicularTo,
  poseFromOrbit,
  viewMatrix,
  walkPose,
} from '../src/camera.js';

const zUp: Vec3 = [0, 0, 1];
const yUp: Vec3 = [0, 1, 0];

// A camera ten units along +x from the origin, upright about z.
const eastward = (): CameraPose => cameraPose([10, 0, 0], [0, 0, 0], zUp);

const closeToVec = (actual: Vec3, expected: Vec3, digits = 10): void => {
  for (const axis of [0, 1, 2] as const) expect(actual[axis]).toBeCloseTo(expected[axis], digits);
};

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('perpendicularTo', () => {
  it('returns a unit vector at right angles to any axis', () => {
    const axes: readonly Vec3[] = [[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 1], [-3, 0.5, 2]];
    for (const v of axes) {
      const p = perpendicularTo(v);
      expect(Math.hypot(...p)).toBeCloseTo(1, 12);
      expect(dot(p, v)).toBeCloseTo(0, 12);
    }
  });

  it('is deterministic and falls back to x for a zero direction', () => {
    expect(perpendicularTo([0, 0, 0])).toEqual([1, 0, 0]);
    expect(perpendicularTo([0, 0, 5])).toEqual(perpendicularTo([0, 0, 1]));
  });
});

describe('cameraBasis', () => {
  it('is orthonormal and right-handed', () => {
    const { forward, right, up } = cameraBasis(cameraPose([4, 5, 6], [1, 1, 1], zUp));
    for (const v of [forward, right, up]) expect(Math.hypot(...v)).toBeCloseTo(1, 12);
    expect(dot(forward, right)).toBeCloseTo(0, 12);
    expect(dot(forward, up)).toBeCloseTo(0, 12);
    expect(dot(right, up)).toBeCloseTo(0, 12);
  });

  it('puts right to the right: looking along +x with z up, right is -y', () => {
    closeToVec(cameraBasis(cameraPose([-1, 0, 0], [0, 0, 0], zUp)).right, [0, -1, 0]);
  });

  it('stays orthonormal when the camera looks straight along its own up hint', () => {
    const { forward, right, up } = cameraBasis(cameraPose([0, 0, 10], [0, 0, 0], zUp));
    closeToVec(forward, [0, 0, -1]);
    expect(dot(right, up)).toBeCloseTo(0, 12);
    expect(Math.hypot(...right)).toBeCloseTo(1, 12);
  });

  it('stays orthonormal when position and target coincide', () => {
    const { forward, right } = cameraBasis(cameraPose([2, 2, 2], [2, 2, 2], zUp));
    expect(Math.hypot(...forward)).toBeCloseTo(1, 12);
    expect(dot(forward, right)).toBeCloseTo(0, 12);
  });
});

describe('orbit angles', () => {
  it('round-trips a pose through angles and back', () => {
    const pose = cameraPose([3, -4, 5], [1, 1, 1], zUp);
    const angles = orbitAngles(pose, zUp);
    closeToVec(poseFromOrbit(pose.target, zUp, angles).position, pose.position);
  });

  it('reports the distance, and a polar of zero looking straight down', () => {
    const angles = orbitAngles(cameraPose([0, 0, 7], [0, 0, 0], zUp), zUp);
    expect(angles.distance).toBeCloseTo(7);
    expect(angles.polar).toBeCloseTo(0);
  });

  it('measures the polar angle from whichever axis is up', () => {
    const pose = cameraPose([0, 7, 0], [0, 0, 0], yUp);
    expect(orbitAngles(pose, yUp).polar).toBeCloseTo(0);
    expect(orbitAngles(pose, zUp).polar).toBeCloseTo(Math.PI / 2);
  });
});

describe('orbitPose', () => {
  it('turns the camera about the up axis, keeping target and distance', () => {
    const turned = orbitPose(eastward(), zUp, Math.PI / 2, 0);
    expect(viewDistance(turned)).toBeCloseTo(10);
    closeToVec(turned.target, [0, 0, 0]);
    expect(orbitAngles(turned, zUp).azimuth - orbitAngles(eastward(), zUp).azimuth).toBeCloseTo(Math.PI / 2);
  });

  it('works with a y up axis as well as z', () => {
    const pose = cameraPose([10, 0, 0], [0, 0, 0], yUp);
    const raised = orbitPose(pose, yUp, 0, -Math.PI / 4);
    expect(raised.position[1]).toBeGreaterThan(0);
    expect(raised.position[2]).toBeCloseTo(0);
  });

  it('clamps the polar angle at both poles', () => {
    const up = orbitPose(eastward(), zUp, 0, -10);
    expect(orbitAngles(up, zUp).polar).toBeCloseTo(defaultOrbitLimits.minPolar);
    const down = orbitPose(eastward(), zUp, 0, 10);
    expect(orbitAngles(down, zUp).polar).toBeCloseTo(defaultOrbitLimits.maxPolar);
  });

  it('never flips the camera over a pole', () => {
    let pose = eastward();
    for (let i = 0; i < 40; i++) pose = orbitPose(pose, zUp, 0, -0.3);
    expect(orbitAngles(pose, zUp).polar).toBeGreaterThan(0);
    expect(pose.position[0]).toBeGreaterThan(0);
  });

  it('leaves the camera upright about the up axis', () => {
    closeToVec(orbitPose(overheadPose(eastward(), zUp), zUp, 1, 0.5).up, zUp);
  });
});

describe('lookPose', () => {
  it('turns what the camera looks at, keeping its position and view distance', () => {
    const looked = lookPose(eastward(), zUp, Math.PI / 2, 0);
    closeToVec(looked.position, [10, 0, 0]);
    expect(viewDistance(looked)).toBeCloseTo(10);
    closeToVec(looked.target, [10, -10, 0], 8);
  });

  it('clamps how far up and down the camera can look', () => {
    let pose = eastward();
    for (let i = 0; i < 20; i++) pose = lookPose(pose, zUp, 0, -0.5);
    const forward = cameraBasis(pose).forward;
    expect(forward[2]).toBeLessThan(1);
    expect(Math.hypot(forward[0], forward[1])).toBeGreaterThan(0);
  });
});

describe('dollyPose', () => {
  it('multiplies the distance to the target', () => {
    expect(viewDistance(dollyPose(eastward(), 0.5))).toBeCloseTo(5);
  });

  it('clamps to the distance limits', () => {
    const limits = { ...defaultOrbitLimits, minDistance: 1, maxDistance: 100 };
    expect(viewDistance(dollyPose(eastward(), 1e-9, limits))).toBeCloseTo(1);
    expect(viewDistance(dollyPose(eastward(), 1e9, limits))).toBeCloseTo(100);
  });

  it('keeps the target and the direction', () => {
    const closer = dollyPose(eastward(), 0.25);
    closeToVec(closer.target, [0, 0, 0]);
    closeToVec(closer.position, [2.5, 0, 0]);
  });

  it('returns a pose with no view direction unchanged', () => {
    const degenerate = cameraPose([1, 1, 1], [1, 1, 1], zUp);
    expect(dollyPose(degenerate, 0.5)).toEqual(degenerate);
  });
});

describe('panPose', () => {
  it('slides camera and target together in the screen plane', () => {
    const panned = panPose(eastward(), 2, 3);
    closeToVec(panned.position, [10, 2, 3]);
    closeToVec(panned.target, [0, 2, 3]);
  });
});

describe('walkPose', () => {
  it('moves along the ground plane and the up axis', () => {
    const walked = walkPose(eastward(), zUp, 4, 0, 1);
    closeToVec(walked.position, [6, 0, 1]);
    closeToVec(walked.target, [-4, 0, 1]);
  });

  it('does not sink when the camera looks downward', () => {
    const looking = cameraPose([10, 0, 10], [0, 0, 0], zUp);
    const walked = walkPose(looking, zUp, 5, 0, 0);
    expect(walked.position[2]).toBeCloseTo(10);
    expect(walked.position[0]).toBeCloseTo(5);
  });

  it('still moves when the camera looks straight down', () => {
    const straightDown = overheadPose(cameraPose([0, 0, 10], [0, 0, 0], zUp), zUp);
    const walked = walkPose(straightDown, zUp, 3, 0, 0);
    expect(Math.hypot(walked.position[0], walked.position[1])).toBeCloseTo(3);
    expect(walked.position[2]).toBeCloseTo(10);
  });
});

describe('viewMatrix', () => {
  it('takes the camera position to the origin', () => {
    const m = viewMatrix(eastward());
    const [x, y, z] = [10, 0, 0];
    const camera: Vec3 = [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
    closeToVec(camera, [0, 0, 0]);
  });

  it('puts the target down the negative z axis of camera space', () => {
    const m = viewMatrix(eastward());
    expect(m[12]).toBeCloseTo(0);
    expect(m[13]).toBeCloseTo(0);
    expect(m[14]).toBeCloseTo(-10);
  });

  it('is column-major: the last column carries the translation', () => {
    const m = viewMatrix(cameraPose([1, 2, 3], [1, 2, 0], zUp));
    expect(m[3]).toBe(0);
    expect(m[7]).toBe(0);
    expect(m[11]).toBe(0);
    expect(m[15]).toBe(1);
  });
});

describe('overheadPose', () => {
  it('looks straight down the up axis from the same distance', () => {
    const overhead = overheadPose(cameraPose([10, 10, 1], [0, 0, 0], zUp), zUp);
    expect(viewDistance(overhead)).toBeCloseTo(Math.hypot(10, 10, 1));
    closeToVec(cameraBasis(overhead).forward, [0, 0, -1]);
  });

  it('holds its heading and reports it back', () => {
    for (const heading of [0, 0.7, -2.5, Math.PI / 2]) {
      expect(overheadHeading(overheadPose(eastward(), zUp, heading), zUp)).toBeCloseTo(heading);
    }
  });

  it('keeps a usable basis at every heading', () => {
    const basis = cameraBasis(overheadPose(eastward(), zUp, 1.2));
    expect(dot(basis.right, basis.up)).toBeCloseTo(0, 12);
    expect(Math.hypot(...basis.right)).toBeCloseTo(1, 12);
  });

  it('reports no heading for a camera that is not looking down the up axis', () => {
    expect(overheadHeading(eastward(), zUp)).toBe(0);
  });
});
