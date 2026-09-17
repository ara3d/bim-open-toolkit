import { Vector3 } from 'three';
import { sceneBounds } from '@ara3d/viewer-core';
import { fitPerspectivePose, overheadPose } from '../../src/camera.js';
import type { CameraState, Vec3 } from '../../src/contracts.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const cameraDemo: FeatureDemo = {
  id: 'camera', title: 'Camera navigation',
  description: 'Orbit, pan and zoom Snowdon. Fit both viewport dimensions, constrain the orbit above ground, and save a camera pose.',
  tests: 'vitest run test/camera.test.ts; controls: vitest run test/orbit-controls.test.ts',
  source: 'examples/features/camera.ts',
  mount(context) {
    const { controls, viewer } = context;
    const originalLimits = { min: controls.model.params.minPolar, max: controls.model.params.maxPolar };
    let saved: CameraState | undefined;
    const vector = (value: Vector3): Vec3 => [value.x, value.y, value.z];
    const apply = (pose: CameraState) => {
      viewer.camera.up.set(...pose.up);
      viewer.camera.zoom = pose.zoom;
      viewer.camera.updateProjectionMatrix();
      controls.model.setPose(new Vector3(...pose.position), new Vector3(...pose.target));
      controls.update();
    };
    const buttons = [
      context.button('Fit model', () => {
        const bounds = sceneBounds(viewer.scene);
        if (!bounds) { context.status('No visible geometry to fit.'); return; }
        apply(fitPerspectivePose(bounds, { verticalFov: viewer.camera.fov * Math.PI / 180, aspect: viewer.camera.aspect, direction: vector(controls.model.position.sub(controls.model.target)) }));
        context.status('Model fitted to the viewport width and height.');
      }),
      context.button('Overhead', () => {
        apply(overheadPose(vector(controls.model.target), controls.model.distance));
        context.status('Near-overhead perspective view.');
      }),
      context.button('Save pose', () => {
        saved = { position: vector(viewer.camera.position), target: vector(controls.model.target), up: vector(viewer.camera.up), projection: 'perspective', zoom: viewer.camera.zoom };
        context.status('Camera pose saved for this viewer session.');
      }),
      context.button('Restore pose', () => {
        if (!saved) { context.status('Save a camera pose first.'); return; }
        controls.model.params.minPolar = originalLimits.min;
        controls.model.params.maxPolar = originalLimits.max;
        apply(saved);
        context.status('Saved camera pose restored; orbit constraints reset.');
      }),
      context.button('Keep above ground', () => {
        controls.model.params.maxPolar = Math.PI / 2;
        controls.model.rotate(0, 0);
        controls.update();
        context.status('Orbit constrained to the upper hemisphere.');
      }),
      context.button('Free orbit', () => {
        controls.model.params.minPolar = originalLimits.min;
        controls.model.params.maxPolar = originalLimits.max;
        context.status('Default orbit angle limits restored.');
      }),
    ];
    context.status('Drag to orbit; right-drag or shift-drag to pan; wheel to zoom. Touch: one finger orbits, two fingers pan and pinch.');
    return () => {
      controls.model.params.minPolar = originalLimits.min;
      controls.model.params.maxPolar = originalLimits.max;
      for (const button of buttons) button.remove();
    };
  },
};
