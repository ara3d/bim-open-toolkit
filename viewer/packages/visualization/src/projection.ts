import type { Vec3 } from './contracts.js';

export type OrthographicView = 'top' | 'front' | 'side' | 'isometric';
export type OrthographicFit = {
  readonly position: Vec3; readonly target: Vec3; readonly up: Vec3;
  readonly left: number; readonly right: number; readonly top: number; readonly bottom: number;
  readonly near: number; readonly far: number;
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

/** Fit projected box extents to either viewport dimension, preserving parallel projection. */
export function fitOrthographicView(bounds: { readonly min: Vec3; readonly max: Vec3 }, options: { readonly view: OrthographicView; readonly aspect: number; readonly padding?: number }): OrthographicFit {
  const { aspect, view, padding = 1.05 } = options;
  if (!Number.isFinite(aspect) || aspect <= 0 || !Number.isFinite(padding) || padding < 1 || ![...bounds.min,...bounds.max].every(Number.isFinite) || bounds.min.some((value,i)=>value>bounds.max[i]!)) throw new Error('Orthographic fit needs finite ordered bounds, positive aspect and padding >= 1');
  const iso = 1 / Math.sqrt(3);
  const directions: Record<OrthographicView, Vec3> = { top: [0,1,0], front: [0,0,1], side: [1,0,0], isometric: [iso,iso,iso] };
  const direction = directions[view];
  const up: Vec3 = view === 'top' ? [0,0,-1] : [0,1,0];
  const rawRight = cross(up, direction), rightLength = Math.hypot(...rawRight);
  const right = rawRight.map(value => value/rightLength) as unknown as Vec3;
  const vertical = cross(direction, right);
  const extents = bounds.min.map((value,i)=>(bounds.max[i]!-value)/2);
  const project = (axis: Vec3) => extents.reduce((sum,value,i)=>sum+value*Math.abs(axis[i]!),0);
  const halfHeight = Math.max(0.01, project(vertical), project(right)/aspect) * padding;
  const target = bounds.min.map((value,i)=>value/2+bounds.max[i]!/2) as unknown as Vec3;
  const radius = Math.hypot(...extents), depth = project(direction), margin = Math.max(1,radius*0.1);
  const distance = depth + margin * 2;
  const position = target.map((value,i)=>value+direction[i]!*distance) as unknown as Vec3;
  if (![...position,halfHeight, distance+depth+margin].every(Number.isFinite)) throw new Error('Orthographic fit exceeds finite coordinate range');
  return { position, target, up, left: -halfHeight*aspect, right: halfHeight*aspect, top: halfHeight, bottom: -halfHeight, near: margin, far: distance+depth+margin };
}
