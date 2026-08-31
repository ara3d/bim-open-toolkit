import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitModel } from '../src/orbit-model.js';

describe('OrbitModel', () => {
  it('computes position from spherical coordinates', () => {
    const m = new OrbitModel();
    m.setPose(new Vector3(0, 0, 10), new Vector3(0, 0, 0));
    expect(m.distance).toBeCloseTo(10);
    expect(m.theta).toBeCloseTo(0);
    expect(m.phi).toBeCloseTo(Math.PI / 2);
    const p = m.position;
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(10);
  });

  it('rotate changes azimuth and clamps polar angle', () => {
    const m = new OrbitModel({ rotateSpeed: 1 });
    m.setPose(new Vector3(0, 0, 10), new Vector3());
    m.rotate(0.5, 0);
    expect(m.theta).toBeCloseTo(-0.5);
    m.rotate(0, -10); // huge downward drag: phi grows but clamps
    expect(m.phi).toBeCloseTo(m.params.maxPolar);
    m.rotate(0, 10);
    expect(m.phi).toBeCloseTo(m.params.minPolar);
  });

  it('dolly is multiplicative and clamps to min/max distance', () => {
    const m = new OrbitModel({ minDistance: 1, maxDistance: 100 });
    m.setPose(new Vector3(0, 0, 10), new Vector3());
    m.dolly(0.5);
    expect(m.distance).toBeCloseTo(5);
    m.dolly(1e-9);
    expect(m.distance).toBe(1);
    m.dolly(1e9);
    expect(m.distance).toBe(100);
  });

  it('setPose clamps distance into range', () => {
    const m = new OrbitModel({ minDistance: 5, maxDistance: 50 });
    m.setPose(new Vector3(0, 0, 1000), new Vector3());
    expect(m.distance).toBe(50);
  });

  it('pan moves the target in camera space, scaled by distance', () => {
    const m = new OrbitModel({ panSpeed: 1 });
    m.setPose(new Vector3(0, 0, 10), new Vector3()); // looking down -z
    m.pan(0.1, 0);
    // camera right is +x when looking down -z; dragging right moves target left
    expect(m.target.x).toBeCloseTo(-1);
    expect(m.target.y).toBeCloseTo(0);
    m.pan(0, 0.1);
    expect(m.target.y).toBeCloseTo(1);
  });

  it('applyTo points a real camera at the target', () => {
    const m = new OrbitModel();
    m.setTarget(new Vector3(1, 2, 3));
    const camera = new PerspectiveCamera();
    m.applyTo(camera);
    expect(camera.position.distanceTo(m.position)).toBeCloseTo(0);
    const forward = new Vector3();
    camera.getWorldDirection(forward);
    const toTarget = new Vector3(1, 2, 3).sub(camera.position).normalize();
    expect(forward.distanceTo(toTarget)).toBeCloseTo(0, 5);
  });
});
