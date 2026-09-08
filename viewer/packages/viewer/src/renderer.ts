// What a view needs from a renderer, and nothing more.
//
// This is the seam that keeps `view.ts`, `multi-view.ts` and `create-viewer.ts` testable in Node.
// The default implementation is viewer-core and three (`src/adapters/webgl.ts`), which is the only
// place in this package that imports three; a headless test substitutes an object of this shape
// with a real `ViewerScene` behind it and no WebGL context anywhere.
//
// Everything here is either plain data or a render-package adapter interface, so adding a renderer
// means implementing six small interfaces and five methods, not learning this package.

import type { InstancedGroup, ViewerScene } from '@ara3d/viewer-core';
import type { ViewState } from '@bim-open-toolkit/model';
import type {
  CaptureTarget,
  ClippingTarget,
  EnvironmentTarget,
  GpuFrameTimer,
  GroupLocation,
  ModelRaycastHit,
  OverlayRenderer,
  Ray,
} from '@bim-open-toolkit/render';

// One renderer drawing one canvas.
export type ViewRenderer = {
  // The scene this renderer draws. A model's groups are added to it once per view.
  readonly scene: ViewerScene;
  // Sets the drawing buffer, in CSS pixels at the given device pixel ratio.
  readonly resize: (width: number, height: number, pixelRatio: number) => void;
  // Puts the camera where the view state says, at the given aspect.
  readonly setView: (view: ViewState, aspect: number) => void;
  // Draws one frame now.
  readonly renderFrame: () => void;
  // A world ray through a point in normalized device coordinates, or undefined when the camera's
  // matrices cannot be inverted into one.
  readonly rayThroughNdc: (x: number, y: number) => Ray | undefined;
  // Hits from this renderer, told which model each group belongs to.
  readonly raycast: (
    groups: ReadonlyMap<InstancedGroup, GroupLocation>,
  ) => (ray: Ray) => readonly ModelRaycastHit[];
  readonly clipping: ClippingTarget;
  readonly environment: EnvironmentTarget;
  readonly overlays: OverlayRenderer;
  readonly capture: CaptureTarget;
  readonly gpu: GpuFrameTimer;
  // Releases the context, the mirror and anything the adapters put in the scene.
  readonly dispose: () => void;
};

// How a renderer is made. A canvas is not required: a headless renderer ignores it.
export type RendererFactory = (canvas: HTMLCanvasElement | undefined) => ViewRenderer;
