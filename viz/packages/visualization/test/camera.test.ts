import { describe, expect, it } from 'vitest';
import { fitPerspectivePose, overheadPose } from '../src/camera.js';

describe('perspective camera poses', () => {
  const bounds = { min: [-1, -1, -1] as const, max: [1, 1, 1] as const };
  it('fits the sphere within the smaller field of view, preserving direction', () => {
    const options = { verticalFov: Math.PI / 2, aspect: 0.5, padding: 1, direction: [0, 0, 1] as const };
    const pose = fitPerspectivePose(bounds, options);
    expect(pose.target).toEqual([0, 0, 0]);
    expect(pose.position[2]).toBeCloseTo(Math.sqrt(3) / Math.sin(Math.atan(0.5)));
    expect(pose.position.slice(0, 2)).toEqual([0, 0]);
    expect(fitPerspectivePose(bounds, { ...options, aspect: 2 }).position[2]).toBeLessThan(pose.position[2]);
    expect(bounds.min).toEqual([-1, -1, -1]);
  });
  it('handles point bounds and rejects invalid inputs', () => {
    const options = { verticalFov: 1, aspect: 1 };
    expect(fitPerspectivePose({ min: [2, 2, 2], max: [2, 2, 2] }, options).position.every(Number.isFinite)).toBe(true);
    for (const aspect of [0, -1, Infinity, NaN]) expect(() => fitPerspectivePose(bounds, { ...options, aspect })).toThrow();
    expect(() => fitPerspectivePose(bounds, { ...options, direction: [0, 0, 0] })).toThrow();
    expect(() => fitPerspectivePose({ min: [1, 0, 0], max: [0, 0, 0] }, options)).toThrow();
  });
  it('creates an overhead pose with the requested radius and no pole singularity', () => {
    const target = [4, 5, 6] as const;
    const pose = overheadPose(target, 10);
    expect(Math.hypot(...pose.position.map((value, i) => value - target[i]!))).toBeCloseTo(10);
    expect(pose.position[1]).toBeGreaterThan(14.99);
    expect(pose.position[2]).toBeGreaterThan(6);
    expect(() => overheadPose(target, 0)).toThrow();
  });
});
