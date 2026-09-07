import {
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  OrthographicCamera,
  WebGLRenderer,
  type Camera,
} from 'three';
import { ViewerScene } from './scene.js';
import { SceneObject } from './scene-object.js';

export interface ViewerOptions {
  /** Perspective camera vertical field of view in degrees. */
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  /** Background color as 0xRRGGBB, or null for transparent. */
  readonly background?: number | null;
  readonly antialias?: boolean;
  /** Pack small opaque surfaces into fewer draws. Disable to reduce mirror memory. Default true. */
  readonly packedGeometry?: boolean;
}

/**
 * The viewer: owns the scene model, the camera, and the frame loop, and (once
 * attached to a canvas) the WebGLRenderer. No input handling and no file
 * formats — controls and loaders are separate packages.
 */
export class Viewer {
  /** The scene model. Add/remove InstancedGroups here; the viewer syncs each frame. */
  readonly scene = new ViewerScene();
  readonly camera: PerspectiveCamera;

  private readonly sceneObject: SceneObject;
  private readonly antialias: boolean;
  private renderer: WebGLRenderer | null = null;
  private running = false;
  private frameHandle: number | null = null;
  private renderRequested = false;
  private disposed = false;
  private localClipping = false;
  private cameraOverride: Camera | null = null;

  constructor(options: ViewerOptions = {}) {
    this.sceneObject = new SceneObject(this.scene, 1000, options.packedGeometry ?? true);
    this.camera = new PerspectiveCamera(
      options.fov ?? 50.0,
      1.0,
      options.near ?? 0.1,
      options.far ?? 10000.0,
    );
    this.camera.position.set(10.0, 10.0, 10.0);
    this.camera.lookAt(0.0, 0.0, 0.0);
    this.antialias = options.antialias ?? true;
    this.setBackground(options.background === undefined ? 0xf0f0f0 : options.background);
    this.addDefaultLights();
  }

  /** Background color as 0xRRGGBB, or null for transparent. */
  setBackground(color: number | null): void {
    this.sceneObject.scene.background = color === null ? null : new Color(color);
    this.requestRender();
  }

  /** Creates the WebGLRenderer on the given canvas. Call once; requires a WebGL context. */
  attach(canvas: HTMLCanvasElement): void {
    if (this.disposed) throw new Error('Viewer is disposed');
    if (this.renderer) throw new Error('Viewer is already attached');
    this.renderer = new WebGLRenderer({ canvas, antialias: this.antialias, alpha: true });
    this.renderer.localClippingEnabled = this.localClipping;
    this.resize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height);
  }

  get isAttached(): boolean { return this.renderer !== null; }
  get isRunning(): boolean { return this.running; }

  /** Camera actually used to draw and pick; the default perspective camera stays available. */
  get renderCamera(): Camera { return this.cameraOverride ?? this.camera; }

  /** Borrows an alternate camera; null restores the existing perspective camera. */
  setRenderCamera(camera: Camera | null): void {
    if (this.disposed) throw new Error('Viewer is disposed');
    this.cameraOverride = camera;
    if (camera) this.resizeCamera(camera, this.camera.aspect);
    this.requestRender();
  }

  /** The three.js mirror of the scene model — for picking, clipping, and other integrations. */
  get objects(): SceneObject { return this.sceneObject; }

  /** Enables/disables local (per-material) clipping planes on the renderer. */
  setLocalClipping(enabled: boolean): void {
    if (this.renderer) this.renderer.localClippingEnabled = enabled;
    this.localClipping = enabled;
    this.requestRender();
  }

  /** Sets the drawing-buffer size and camera aspect. Floats accepted; CSS pixel units. */
  resize(width: number, height: number, pixelRatio: number = 1.0): void {
    this.camera.aspect = height > 0 && width > 0 ? width / height : 1.0;
    this.camera.updateProjectionMatrix();
    if (this.cameraOverride) this.resizeCamera(this.cameraOverride, this.camera.aspect);
    if (this.renderer) {
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(width, height, false);
    }
    this.requestRender();
  }

  /** Starts the continuous frame loop (requestAnimationFrame). */
  start(): void {
    if (this.disposed) throw new Error('Viewer is disposed');
    if (this.running) return;
    this.running = true;
    this.scheduleFrame();
  }

  /** Stops the frame loop. requestRender() still renders single frames on demand. */
  stop(): void {
    this.running = false;
    if (!this.renderRequested) this.cancelFrame();
  }

  /** Requests a single render on the next animation frame (works while stopped). */
  requestRender(): void {
    if (this.disposed) return;
    this.renderRequested = true;
    if (!this.running) this.scheduleFrame();
  }

  /** Renders one frame immediately: syncs the scene model and draws. */
  renderFrame(): void {
    if (this.disposed) return;
    this.renderRequested = false;
    this.sceneObject.sync();
    if (this.renderer) this.renderer.render(this.sceneObject.scene, this.renderCamera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    this.cancelFrame();
    this.sceneObject.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;
    this.cameraOverride = null;
  }

  private resizeCamera(camera: Camera, aspect: number): void {
    if (camera instanceof PerspectiveCamera) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    } else if (camera instanceof OrthographicCamera) {
      const center = (camera.left + camera.right) / 2;
      const halfWidth = (camera.top - camera.bottom) / 2 * aspect;
      camera.left = center - halfWidth;
      camera.right = center + halfWidth;
      camera.updateProjectionMatrix();
    }
  }

  private scheduleFrame(): void {
    if (this.frameHandle !== null || typeof requestAnimationFrame !== 'function') return;
    this.frameHandle = requestAnimationFrame(() => {
      this.frameHandle = null;
      if (this.disposed) return;
      const shouldRender = this.running || this.renderRequested;
      if (shouldRender) this.renderFrame();
      if (this.running) this.scheduleFrame();
    });
  }

  private cancelFrame(): void {
    if (this.frameHandle !== null && typeof cancelAnimationFrame === 'function')
      cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }

  private addDefaultLights(): void {
    const hemi = new HemisphereLight(0xffffff, 0x445566, 1.0);
    const sun = new DirectionalLight(0xffffff, 2.0);
    sun.position.set(1.0, 2.0, 1.5);
    this.sceneObject.scene.add(hemi, sun);
  }
}
