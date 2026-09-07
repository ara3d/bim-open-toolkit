import type { CameraState, Vec3 } from './contracts.js';

export type CameraBounds = { readonly min: Vec3; readonly max: Vec3 };
export type PerspectiveFitOptions = {
  /** Vertical field of view in radians, before camera zoom. */
  readonly verticalFov: number;
  readonly aspect: number;
  /** Vector from target toward camera; defaults to [1, 1, 1]. */
  readonly direction?: Vec3;
  readonly padding?: number;
};

/** Fit the entire bounds sphere in both viewport dimensions, with a Y-up pose. */
export function fitPerspectivePose(bounds: CameraBounds, options: PerspectiveFitOptions): CameraState {
  const { verticalFov, aspect, direction = [1, 1, 1], padding = 1.05 } = options;
  if (!Number.isFinite(verticalFov) || verticalFov <= 0 || verticalFov >= Math.PI || !Number.isFinite(aspect) || aspect <= 0 || !Number.isFinite(padding) || padding < 1)
    throw new Error('Fit requires a finite positive aspect, field of view below pi, and padding >= 1');
  if (![...bounds.min, ...bounds.max, ...direction].every(Number.isFinite) || bounds.min.some((value, i) => value > bounds.max[i]!))
    throw new Error('Fit bounds and direction must be finite, with ordered bounds');
  const length = Math.hypot(...direction);
  if (length === 0) throw new Error('Fit direction must be nonzero');
  const target = bounds.min.map((value, i) => value / 2 + bounds.max[i]! / 2) as unknown as Vec3;
  const radius = Math.hypot(...bounds.min.map((value, i) => (bounds.max[i]! - value) / 2));
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const distance = Math.max(0.01, radius * padding / Math.sin(Math.min(verticalFov, horizontalFov) / 2));
  const position = target.map((value, i) => value + direction[i]! / length * distance) as unknown as Vec3;
  if (!position.every(Number.isFinite)) throw new Error('Fit exceeds finite coordinate range');
  return { position, target, up: [0, 1, 0], projection: 'perspective', zoom: 1 };
}

/** Near-overhead Y-up pose avoids the orbit model's singular pole. */
export function overheadPose(target: Vec3, distance: number): CameraState {
  if (!target.every(Number.isFinite) || !Number.isFinite(distance) || distance <= 0)
    throw new Error('Overhead pose requires a finite target and positive distance');
  const polar = 0.01;
  return { position: [target[0], target[1] + distance * Math.cos(polar), target[2] + distance * Math.sin(polar)], target: [...target], up: [0, 1, 0], projection: 'perspective', zoom: 1 };
}
