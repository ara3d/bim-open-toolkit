// The whole WebGL surface of this page: a three renderer over viewer-core's scene mirror, the
// render package's ambient-occlusion seam implemented with three's GTAO pass, and a camera written
// from an interact view. Nothing else in `src/ambient-occlusion` imports three.
//
// The page owns its renderer instead of using viewer-core's `Viewer`, because `Viewer` keeps its
// `WebGLRenderer` private and draws with `renderer.render` directly, which leaves no place for a
// pass between the scene and the screen. The checkpoint records that as a request.

import { SceneObject, ViewerScene } from '@ara3d/viewer-core';
import type { Bounds, ViewState } from '@bim-open-toolkit/model';
import { isEmptyBounds } from '@bim-open-toolkit/model';
import {
  occlusionBufferSize,
  type AmbientOcclusionPass,
  type AmbientOcclusionTarget,
  type PixelSize,
} from '@bim-open-toolkit/render';
import {
  Box3,
  Color,
  DirectionalLight,
  HalfFloatType,
  HemisphereLight,
  PerspectiveCamera,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

// A canvas with a renderer behind it: the scene the render package binds models into, the camera,
// and the ambient-occlusion seam.
export type Stage = AmbientOcclusionTarget & {
  readonly scene: ViewerScene;
  readonly camera: PerspectiveCamera;
  // What the browser says is drawing, so no number is read without knowing what produced it.
  readonly renderer: string;
  // The pass in force, or undefined when the picture is plain.
  readonly pass: () => AmbientOcclusionPass | undefined;
  // Sets the drawing-buffer size and the camera aspect, in CSS pixels.
  readonly resize: (width: number, height: number, pixelRatio: number) => void;
  // Brings the mirror up to date and draws one frame.
  readonly render: () => void;
  // The drawing buffer as RGBA bytes. Only meaningful immediately after `render`, before the
  // browser composites the frame away.
  readonly readPixels: () => Uint8Array;
  // Tells the pass where the model is, which sharpens its depth precision.
  readonly setClipBox: (bounds: Bounds) => void;
  readonly dispose: () => void;
};

// The number of multisampling samples the composer's buffer takes, so a frame drawn through the
// passes is antialiased like a frame drawn straight to the canvas and a comparison is fair.
const multisampling = 4;

// GTAO discards a sample whose depth differs from the pixel's by more than its `thickness`, in
// world units, so that a foreground object does not shadow what is far behind it. Three's example
// keeps it at four times the radius; a fixed thickness would throw away most of a wall once the
// radius grows past it.
const thicknessPerRadius = 4;

// Everything a page needs to draw on this canvas. Throws when the canvas has no WebGL.
export const createStage = (canvas: HTMLCanvasElement, background: number): Stage => {
  const scene = new ViewerScene();
  const mirror = new SceneObject(scene);
  mirror.scene.background = new Color(background);
  const sun = new DirectionalLight(0xffffff, 2.0);
  sun.position.set(1.0, 2.0, 1.5);
  mirror.scene.add(new HemisphereLight(0xffffff, 0x445566, 1.0), sun);
  const camera = new PerspectiveCamera(50, 1, 0.1, 10000);

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  const composer = new EffectComposer(
    renderer,
    new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: multisampling }),
  );
  const occlusion = new GTAOPass(mirror.scene, camera, 1, 1);
  composer.addPass(new RenderPass(mirror.scene, camera));
  composer.addPass(occlusion);
  composer.addPass(new OutputPass());

  let current: AmbientOcclusionPass | undefined;
  const drawn = (): PixelSize => {
    const size = renderer.getDrawingBufferSize(new Vector2());
    return { width: size.x, height: size.y };
  };
  const fitOcclusionBuffer = (): void => {
    const size = occlusionBufferSize(current ?? { resolutionScale: 1 }, drawn());
    occlusion.setSize(size.width, size.height);
  };

  const context = renderer.getContext();
  const reported: unknown = context.getParameter(context.RENDERER);

  return {
    scene,
    camera,
    renderer: typeof reported === 'string' ? reported : 'unknown renderer',
    pass: () => current,
    setAmbientOcclusion: (pass) => {
      current = pass;
      if (pass === undefined) return;
      occlusion.updateGtaoMaterial({
        radius: pass.radius,
        thickness: pass.radius * thicknessPerRadius,
        samples: pass.samples,
        screenSpaceRadius: false,
      });
      occlusion.blendIntensity = pass.intensity;
      occlusion.output = pass.output === 'occlusion' ? GTAOPass.OUTPUT.Denoise : GTAOPass.OUTPUT.Default;
      fitOcclusionBuffer();
    },
    // A canvas that has not been laid out yet measures zero; a zero-sized buffer makes every draw
    // a GL error until the next resize, so the buffers are never smaller than one pixel.
    resize: (width, height, pixelRatio) => {
      const w = Math.max(1, width);
      const h = Math.max(1, height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(w, h, false);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
      fitOcclusionBuffer();
    },
    render: () => {
      mirror.sync();
      if (current === undefined) renderer.render(mirror.scene, camera);
      else composer.render();
    },
    readPixels: () => {
      const size = drawn();
      const bytes = new Uint8Array(size.width * size.height * 4);
      renderer.setRenderTarget(null);
      context.readPixels(0, 0, size.width, size.height, context.RGBA, context.UNSIGNED_BYTE, bytes);
      return bytes;
    },
    setClipBox: (bounds) => {
      if (isEmptyBounds(bounds)) return;
      occlusion.setSceneClipBox(
        new Box3(
          new Vector3(bounds.min[0], bounds.min[1], bounds.min[2]),
          new Vector3(bounds.max[0], bounds.max[1], bounds.max[2]),
        ),
      );
    },
    dispose: () => {
      composer.dispose();
      occlusion.dispose();
      mirror.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
};

// Writes an interact view onto the perspective camera. An orthographic view would need a different
// camera object, which this page does not create, so its projection is left alone.
export const applyView = (camera: PerspectiveCamera, view: ViewState): void => {
  camera.up.set(view.camera.up[0], view.camera.up[1], view.camera.up[2]);
  camera.position.set(view.camera.position[0], view.camera.position[1], view.camera.position[2]);
  camera.lookAt(new Vector3(view.camera.target[0], view.camera.target[1], view.camera.target[2]));
  if (view.projection.kind === 'perspective') {
    camera.fov = view.projection.fieldOfViewDegrees;
    camera.near = view.projection.near;
    camera.far = view.projection.far;
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
};
