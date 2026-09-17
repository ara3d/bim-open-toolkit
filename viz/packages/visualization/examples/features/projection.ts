import { sceneBounds } from '@ara3d/viewer-core';
import { OrthographicCamera } from 'three';
import { fitOrthographicView, type OrthographicView } from '../../src/projection.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const projectionDemo: FeatureDemo = {
  id: 'projection', title: 'Orthographic views',
  description: 'Inspect top, front, side and isometric parallel projections, then return to the existing perspective orbit.',
  source: 'examples/features/projection.ts', tests: 'vitest run test/projection.test.ts; core: vitest run test/viewer.test.ts',
  mount(context) {
    const camera = new OrthographicCamera();
    const previous = context.viewer.renderCamera === context.viewer.camera ? null : context.viewer.renderCamera;
    const bounds = sceneBounds(context.viewer.scene);
    let active = false;
    let view: OrthographicView = 'top';
    const suppressOrbit = (event: Event) => {
      if (!active) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    // Preserve pointer-down/up for picking; suppress orbit motion without disposing host controls.
    context.canvas.addEventListener('pointermove', suppressOrbit, true);
    context.canvas.addEventListener('wheel', suppressOrbit, { capture: true, passive: false });
    const fit = () => {
      if (!bounds) { context.status('No geometry is available for orthographic fitting.'); return; }
      context.viewer.resize(context.canvas.clientWidth, context.canvas.clientHeight, Math.min(devicePixelRatio,2));
      const pose = fitOrthographicView(bounds,{view,aspect:context.viewer.camera.aspect});
      camera.position.set(...pose.position); camera.up.set(...pose.up); camera.lookAt(...pose.target);
      camera.left=pose.left; camera.right=pose.right; camera.top=pose.top; camera.bottom=pose.bottom;
      camera.near=pose.near; camera.far=pose.far; camera.zoom=1; camera.updateProjectionMatrix();
      active=true; context.viewer.setRenderCamera(camera);
      context.status(`${view} orthographic view. Pick objects normally; use Zoom/Fit here. Perspective orbit is paused until restored.`);
    };
    const buttons = (['top','front','side','isometric'] as OrthographicView[]).map(mode => context.button(`${mode[0]!.toUpperCase()}${mode.slice(1)}`, () => { view=mode; fit(); }));
    const zoom = (factor:number) => {
      if(!active) fit();
      if(!active) return;
      camera.zoom=Math.max(0.05,Math.min(100,camera.zoom*factor)); camera.updateProjectionMatrix(); context.viewer.requestRender();
    };
    buttons.push(
      context.button('Zoom in',()=>zoom(1.25)),
      context.button('Zoom out',()=>zoom(0.8)),
      context.button('Fit orthographic',fit),
      context.button('Return to perspective',()=>{active=false;context.viewer.setRenderCamera(previous);context.status('Perspective orbit restored.');}),
    );
    return () => {
      active=false;
      context.canvas.removeEventListener('pointermove',suppressOrbit,true);
      context.canvas.removeEventListener('wheel',suppressOrbit,true);
      context.viewer.setRenderCamera(previous);
      for(const button of buttons) button.remove();
    };
  },
};
