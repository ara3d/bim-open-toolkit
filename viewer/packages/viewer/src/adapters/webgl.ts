// The default renderer: viewer-core and three behind the `ViewRenderer` seam.
//
// This file and its neighbours in `src/adapters` are the only place in `@bim-open-toolkit/viewer`
// that imports three. Everything above them - the session, the document, the views, the command bus
// - runs in Node. Replacing the renderer means writing another file of this shape.

import { Viewer, defaultMaterial, type MaterialConfig } from '@ara3d/viewer-core';
import { upVector, type Vec3 } from '@bim-open-toolkit/model';
import { defaultEnvironment } from '@bim-open-toolkit/render';
import { OrthographicCamera } from 'three';
import type { ViewRenderer } from '../renderer.js';
import { applyOrthographic, applyPerspective, rayThroughCamera } from './camera.js';
import { captureTarget, gpuFrameTimer } from './capture.js';
import { raycastSource } from './raycast.js';
import { clippingTarget, environmentTarget, overlayRenderer } from './scene-dressing.js';

// viewer-core builds a group's material with `transparent: opacity < 1`, and per-instance alpha only
// scales it, so a group whose material is fully opaque ignores every per-instance opacity: a model's
// translucent objects would draw solid and a hidden row would still be drawn. One shade below opaque
// switches blending on for every group, and the shade itself is not visible.
export const blendableMaterial: MaterialConfig = { ...defaultMaterial, opacity: 0.999 };

// How the default renderer is built.
export type WebglOptions = {
  // The background before an environment is applied, as 0xRRGGBB.
  readonly background?: number | undefined;
  readonly antialias?: boolean | undefined;
  // Which way is up, for the light rig. Defaults to the render package's own default environment.
  readonly up?: Vec3 | undefined;
  // Where overlay primitives are drawn. Without one, overlays are computed and not shown.
  readonly overlayHost?: SVGSVGElement | undefined;
};

const noOverlays = { setOverlays: () => undefined };

// A renderer over one canvas. Throws only what `Viewer.attach` throws, which is a canvas with no
// WebGL context; `createViewer` turns that into a diagnostic.
export const webglRenderer = (canvas: HTMLCanvasElement, options: WebglOptions = {}): ViewRenderer => {
  const viewer = new Viewer({
    background: options.background ?? 0xe6e9ec,
    antialias: options.antialias ?? true,
  });
  viewer.attach(canvas);
  const orthographic = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  let usingOrthographic = false;

  return {
    scene: viewer.scene,
    resize: (width, height, pixelRatio) => {
      viewer.resize(width, height, pixelRatio);
    },
    setView: (view, aspect) => {
      const wantsOrthographic = view.projection.kind === 'orthographic';
      applyPerspective(viewer.camera, view, aspect);
      applyOrthographic(orthographic, view, aspect);
      if (wantsOrthographic !== usingOrthographic) {
        usingOrthographic = wantsOrthographic;
        viewer.setRenderCamera(wantsOrthographic ? orthographic : null);
      }
    },
    renderFrame: () => {
      viewer.renderFrame();
    },
    rayThroughNdc: (x, y) => rayThroughCamera(viewer.renderCamera, x, y),
    raycast: (groups) => raycastSource(viewer.objects, () => groups),
    clipping: clippingTarget(viewer),
    environment: environmentTarget(viewer, options.up ?? upVector(defaultEnvironment.up)),
    overlays: options.overlayHost === undefined ? noOverlays : overlayRenderer(options.overlayHost),
    capture: captureTarget(viewer, canvas),
    gpu: gpuFrameTimer(canvas),
    dispose: () => {
      viewer.dispose();
    },
  };
};
