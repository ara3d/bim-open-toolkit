import { Viewer, sceneBounds } from '@ara3d/viewer-core';
import { OrbitControls } from '@ara3d/viewer-controls';
import { Vector3 } from 'three';
import { observeResize } from '../observe-resize.js';
import { fitPerspectivePose } from '../../src/camera.js';
import { linkCameraViews, type CameraEndpoint } from '../../src/view-link.js';
import type { FeatureDemo } from '../gallery/contracts.js';
import type { Vec3 } from '../../src/contracts.js';

function endpoint(viewer: Viewer, controls: OrbitControls): CameraEndpoint {
  const vector = (value: Vector3): Vec3 => [value.x, value.y, value.z];
  return {
    read: () => ({ position: vector(viewer.camera.position), target: vector(controls.model.target), up: vector(viewer.camera.up), zoom: viewer.camera.zoom, projection: 'perspective' }),
    write(pose) {
      viewer.camera.up.set(...pose.up);
      viewer.camera.zoom = pose.zoom;
      viewer.camera.updateProjectionMatrix();
      controls.model.setPose(new Vector3(...pose.position), new Vector3(...pose.target));
      controls.update();
    },
    subscribe: listener => controls.subscribe(listener),
  };
}

export const comparisonDemo: FeatureDemo = {
  id: 'comparison', title: 'Two independent views',
  description: 'Open a second view of the same model, with independent cameras or explicitly linked navigation.',
  source: 'examples/features/comparison.ts', tests: 'vitest run test/view-link.test.ts',
  mount(context) {
    let removeSecond: (() => void) | undefined;
    let stopLink: (() => void) | undefined;
    let other: CameraEndpoint | undefined;
    const first = endpoint(context.viewer, context.controls);
    const originalWidth = context.canvas.style.width;
    const resizeFirst = () => context.viewer.resize(context.canvas.clientWidth, context.canvas.clientHeight, Math.min(devicePixelRatio, 2));
    const unlink = () => { stopLink?.(); stopLink = undefined; linkButton.textContent = 'Link cameras'; linkButton.setAttribute('aria-pressed', 'false'); };
    const addButton = context.button('Add second view', () => {
      if (removeSecond) return;
      const parent = context.canvas.parentElement;
      if (!parent) return;
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-label', 'Second comparison viewer');
      Object.assign(canvas.style, { position: 'absolute', right: '0', top: '0', width: '50%', height: '100%' });
      const viewer = new Viewer({ background: 0xdce4e9, near: context.viewer.camera.near, far: context.viewer.camera.far, fov: context.viewer.camera.fov });
      const controls = new OrbitControls(viewer);
      let stopResize = () => {};
      removeSecond = () => {
        unlink(); other = undefined;
        stopResize(); controls.dispose(); viewer.dispose(); canvas.remove();
        context.canvas.style.width = originalWidth; resizeFirst();
        removeSecond = undefined;
        addButton.disabled = false; removeButton.disabled = true; linkButton.disabled = true;
      };
      try {
        context.canvas.style.width = '50%';
        parent.insertBefore(canvas, context.canvas.nextSibling);
        viewer.attach(canvas);
        for (const group of context.viewer.scene.groups) viewer.scene.addGroup(group);
        controls.attach({
          addEventListener: (type, listener) => canvas.addEventListener(type, listener as EventListener),
          removeEventListener: (type, listener) => canvas.removeEventListener(type, listener as EventListener),
          get clientHeight() { return canvas.clientHeight; }, style: canvas.style,
          setPointerCapture: id => canvas.setPointerCapture(id), releasePointerCapture: id => canvas.releasePointerCapture(id),
        });
        stopResize = observeResize(canvas, () => viewer.resize(canvas.clientWidth, canvas.clientHeight, Math.min(devicePixelRatio, 2)));
        resizeFirst();
        viewer.resize(canvas.clientWidth, canvas.clientHeight, Math.min(devicePixelRatio, 2));
        const bounds = sceneBounds(viewer.scene);
        if (bounds) {
          const pose = fitPerspectivePose(bounds, { verticalFov: viewer.camera.fov * Math.PI / 180, aspect: viewer.camera.aspect });
          first.write(pose);
          endpoint(viewer, controls).write(pose);
        }
        other = endpoint(viewer, controls);
        viewer.requestRender();
        addButton.disabled = true; removeButton.disabled = false; linkButton.disabled = false;
        context.status('Two views share the model data and own separate cameras and rendering resources. Cameras are independent.');
      } catch (error) { removeSecond(); throw error; }
    });
    const removeButton = context.button('Remove second view', () => { removeSecond?.(); context.status('Second view removed and its rendering resources released.'); });
    const linkButton = context.button('Link cameras', () => {
      if (!other) return;
      if (stopLink) { unlink(); context.status('Cameras navigate independently.'); }
      else {
        stopLink = linkCameraViews(first, other);
        linkButton.textContent = 'Unlink cameras'; linkButton.setAttribute('aria-pressed', 'true');
        context.status('Navigation and camera updates are linked in both directions.');
      }
    });
    removeButton.disabled = true; linkButton.disabled = true;
    linkButton.setAttribute('aria-pressed', 'false');
    return () => { removeSecond?.(); for (const button of [addButton, removeButton, linkButton]) button.remove(); };
  },
};
