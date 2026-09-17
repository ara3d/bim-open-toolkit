import { expect, it } from 'vitest';
import { OrthographicCamera, Vector3 } from 'three';
import { fitOrthographicView, type OrthographicView } from '../src/projection.js';

it.each(['top','front','side','isometric'] as OrthographicView[])('fits every bounds corner in the %s orthographic view', view => {
  const bounds = { min: [-2,-1,-3] as const, max: [2,1,3] as const };
  for (const aspect of [0.5, 2]) {
    const fit = fitOrthographicView(bounds,{view,aspect});
    const camera = new OrthographicCamera(fit.left,fit.right,fit.top,fit.bottom,fit.near,fit.far);
    camera.position.set(...fit.position); camera.up.set(...fit.up); camera.lookAt(...fit.target); camera.updateMatrixWorld();
    for (const x of [-2,2]) for (const y of [-1,1]) for (const z of [-3,3]) {
      const ndc = new Vector3(x,y,z).project(camera);
      expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(ndc.z)).toBeLessThanOrEqual(1);
    }
    expect((fit.right-fit.left)/(fit.top-fit.bottom)).toBeCloseTo(aspect);
  }
});

it('handles point bounds and rejects invalid ranges and aspect', () => {
  const bounds = { min: [1,1,1] as const, max: [1,1,1] as const };
  expect(fitOrthographicView(bounds,{view:'top',aspect:1}).far).toBeGreaterThan(0);
  expect(()=>fitOrthographicView(bounds,{view:'front',aspect:0})).toThrow();
  expect(()=>fitOrthographicView({min:[2,0,0],max:[1,0,0]},{view:'front',aspect:1})).toThrow();
});
