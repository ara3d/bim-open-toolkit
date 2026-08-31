import { Vector3 } from 'three';

/** Float parameters of the orbit camera model. All mutable at runtime. */
export interface OrbitParams {
  /** Radians of rotation per normalized drag unit (one viewport height). */
  rotateSpeed: number;
  /** Pan distance per normalized drag unit, as a fraction of orbit distance. */
  panSpeed: number;
  /** Multiplier applied to dolly factors (wheel steps). */
  zoomSpeed: number;
  minDistance: number;
  maxDistance: number;
  /** Polar angle clamp, radians from +Y (0 = looking straight down). */
  minPolar: number;
  maxPolar: number;
}

export const defaultOrbitParams = (): OrbitParams => ({
  rotateSpeed: Math.PI,
  panSpeed: 1.0,
  zoomSpeed: 1.0,
  minDistance: 0.01,
  maxDistance: 1.0e6,
  minPolar: 0.01,
  maxPolar: Math.PI - 0.01,
});

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export interface CameraLike {
  readonly position: Vector3;
  lookAt(target: Vector3): void;
}

/**
 * Orbit camera model: a target point plus spherical coordinates (distance,
 * azimuth theta around +Y from +Z, polar phi from +Y). Input deltas in,
 * camera pose out — no DOM and no rendering (see OrbitControls for the
 * DOM binding).
 */
export class OrbitModel {
  readonly params: OrbitParams;

  private readonly _target = new Vector3();
  private _distance = 20.0;
  private _theta = Math.PI / 4;
  private _phi = Math.PI / 3;

  constructor(params: Partial<OrbitParams> = {}) {
    this.params = { ...defaultOrbitParams(), ...params };
  }

  get target(): Vector3 { return this._target.clone(); }
  get distance(): number { return this._distance; }
  get theta(): number { return this._theta; }
  get phi(): number { return this._phi; }

  /** Camera position implied by the current target + spherical coordinates. */
  get position(): Vector3 {
    const sinPhi = Math.sin(this._phi);
    return new Vector3(
      this._target.x + this._distance * sinPhi * Math.sin(this._theta),
      this._target.y + this._distance * Math.cos(this._phi),
      this._target.z + this._distance * sinPhi * Math.cos(this._theta),
    );
  }

  /** Rotates by normalized drag deltas (fractions of the viewport height). */
  rotate(dx: number, dy: number): void {
    this._theta -= dx * this.params.rotateSpeed;
    this._phi = clamp(
      this._phi - dy * this.params.rotateSpeed,
      this.params.minPolar,
      this.params.maxPolar,
    );
  }

  /** Multiplies the orbit distance (factor < 1 moves closer), clamped. */
  dolly(factor: number): void {
    this._distance = clamp(
      this._distance * factor,
      this.params.minDistance,
      this.params.maxDistance,
    );
  }

  /** Pans the target in camera space by normalized drag deltas. */
  pan(dx: number, dy: number): void {
    const forward = this._target.clone().sub(this.position).normalize();
    const right = forward.clone().cross(new Vector3(0, 1, 0)).normalize();
    const up = right.clone().cross(forward);
    const scale = this._distance * this.params.panSpeed;
    this._target.addScaledVector(right, -dx * scale);
    this._target.addScaledVector(up, dy * scale);
  }

  /** Repositions the orbit to look from `position` at `target`. */
  setPose(position: Vector3, target: Vector3): void {
    this._target.copy(target);
    const offset = position.clone().sub(target);
    this._distance = clamp(
      offset.length() || this.params.minDistance,
      this.params.minDistance,
      this.params.maxDistance,
    );
    this._theta = Math.atan2(offset.x, offset.z);
    this._phi = clamp(
      Math.acos(clamp(offset.y / this._distance, -1, 1)),
      this.params.minPolar,
      this.params.maxPolar,
    );
  }

  /** Moves the orbit target, keeping distance and angles. */
  setTarget(target: Vector3): void {
    this._target.copy(target);
  }

  /** Writes the pose onto a camera (position + lookAt). */
  applyTo(camera: CameraLike): void {
    camera.position.copy(this.position);
    camera.lookAt(this._target);
  }
}
