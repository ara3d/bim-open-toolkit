import { OrbitModel, CameraLike } from './orbit-model.js';

/** What the controls need from a viewer: a camera and a way to ask for a frame. */
export interface CameraView {
  readonly camera: CameraLike;
  requestRender(): void;
}

/** The subset of DOM eventing the binding uses (testable with a fake). */
export interface InputElement {
  addEventListener(type: string, listener: (event: never) => void): void;
  removeEventListener(type: string, listener: (event: never) => void): void;
  readonly clientHeight: number;
  setPointerCapture?(pointerId: number): void;
  releasePointerCapture?(pointerId: number): void;
}

interface PointerLike {
  readonly pointerId: number;
  readonly button: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly shiftKey: boolean;
  preventDefault?(): void;
}

interface WheelLike {
  readonly deltaY: number;
  preventDefault?(): void;
}

/**
 * DOM binding for OrbitModel: left-drag rotates, right-drag (or shift+left)
 * pans, wheel dollies. Applies the model to the view's camera and calls
 * requestRender() after every change, so it works with a stopped frame loop.
 */
export class OrbitControls {
  readonly model: OrbitModel;

  private readonly view: CameraView;
  private element: InputElement | null = null;
  private dragButton = -1;
  private lastX = 0;
  private lastY = 0;
  private readonly handlers: Array<[string, (e: never) => void]> = [];

  constructor(view: CameraView, model: OrbitModel = new OrbitModel()) {
    this.view = view;
    this.model = model;
  }

  /** Starts listening on an element (typically the viewer canvas). */
  attach(element: InputElement): void {
    if (this.element) throw new Error('OrbitControls is already attached');
    this.element = element;
    this.listen('pointerdown', (e: PointerLike) => this.onPointerDown(e));
    this.listen('pointermove', (e: PointerLike) => this.onPointerMove(e));
    this.listen('pointerup', (e: PointerLike) => this.onPointerUp(e));
    this.listen('wheel', (e: WheelLike) => this.onWheel(e));
    this.listen('contextmenu', (e: { preventDefault?(): void }) => e.preventDefault?.());
    this.update();
  }

  dispose(): void {
    if (!this.element) return;
    for (const [type, handler] of this.handlers)
      this.element.removeEventListener(type, handler);
    this.handlers.length = 0;
    this.element = null;
  }

  /** Applies the model to the camera and requests a render. */
  update(): void {
    this.model.applyTo(this.view.camera);
    this.view.requestRender();
  }

  private listen<E>(type: string, handler: (e: E) => void): void {
    this.element!.addEventListener(type, handler as (e: never) => void);
    this.handlers.push([type, handler as (e: never) => void]);
  }

  private normalized(dx: number, dy: number): [number, number] {
    const h = Math.max(1, this.element?.clientHeight ?? 1);
    return [dx / h, dy / h];
  }

  private onPointerDown(e: PointerLike): void {
    if (e.button !== 0 && e.button !== 2) return;
    this.dragButton = e.button === 0 && e.shiftKey ? 2 : e.button;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.element?.setPointerCapture?.(e.pointerId);
  }

  private onPointerMove(e: PointerLike): void {
    if (this.dragButton < 0) return;
    const [dx, dy] = this.normalized(e.clientX - this.lastX, e.clientY - this.lastY);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    if (this.dragButton === 0) this.model.rotate(dx, dy);
    else this.model.pan(dx, dy);
    this.update();
  }

  private onPointerUp(e: PointerLike): void {
    this.dragButton = -1;
    this.element?.releasePointerCapture?.(e.pointerId);
  }

  private onWheel(e: WheelLike): void {
    e.preventDefault?.();
    this.model.dolly(Math.exp(e.deltaY * 0.001 * this.model.params.zoomSpeed));
    this.update();
  }
}
