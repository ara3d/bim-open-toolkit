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
  readonly style?: { touchAction: string };
}

interface PointerLike {
  readonly pointerType?: string;
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
 * pans, wheel dollies. One touch orbits; two touches pan and pinch to dolly.
 * Applies the model to the view's camera and calls
 * requestRender() after every change, so it works with a stopped frame loop.
 */
export class OrbitControls {
  readonly model: OrbitModel;

  private readonly view: CameraView;
  private element: InputElement | null = null;
  private dragButton = -1;
  private mousePointer: number | null = null;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private previousTouchAction: string | undefined;
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
    this.previousTouchAction = element.style?.touchAction;
    if (element.style) element.style.touchAction = 'none';
    this.listen('pointerdown', (e: PointerLike) => this.onPointerDown(e));
    this.listen('pointermove', (e: PointerLike) => this.onPointerMove(e));
    this.listen('pointerup', (e: PointerLike) => this.onPointerUp(e));
    this.listen('pointercancel', (e: PointerLike) => this.onPointerUp(e));
    this.listen('lostpointercapture', (e: PointerLike) => this.onPointerUp(e));
    this.listen('wheel', (e: WheelLike) => this.onWheel(e));
    this.listen('contextmenu', (e: { preventDefault?(): void }) => e.preventDefault?.());
    this.update();
  }

  dispose(): void {
    if (!this.element) return;
    for (const [type, handler] of this.handlers)
      this.element.removeEventListener(type, handler);
    for (const id of this.touches.keys()) this.releasePointer(id);
    if (this.mousePointer !== null) this.releasePointer(this.mousePointer);
    this.touches.clear();
    this.mousePointer = null;
    this.dragButton = -1;
    if (this.element.style && this.previousTouchAction !== undefined)
      this.element.style.touchAction = this.previousTouchAction;
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
    if (e.pointerType === 'touch') {
      if (this.mousePointer !== null || this.touches.size >= 2 || this.touches.has(e.pointerId)) return;
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.element?.setPointerCapture?.(e.pointerId);
      e.preventDefault?.();
      return;
    }
    if (this.mousePointer !== null || this.touches.size > 0) return;
    if (e.button !== 0 && e.button !== 2) return;
    this.mousePointer = e.pointerId;
    this.dragButton = e.button === 0 && e.shiftKey ? 2 : e.button;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.element?.setPointerCapture?.(e.pointerId);
  }

  private onPointerMove(e: PointerLike): void {
    const touch = this.touches.get(e.pointerId);
    if (touch) {
      const other = [...this.touches.entries()].find(([id]) => id !== e.pointerId)?.[1];
      const [dx, dy] = this.normalized(e.clientX - touch.x, e.clientY - touch.y);
      if (other) {
        const oldDistance = Math.hypot(touch.x - other.x, touch.y - other.y);
        const newDistance = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        this.model.pan(dx / 2, dy / 2);
        if (oldDistance > 0 && newDistance > 0) this.model.dolly(oldDistance / newDistance);
      } else this.model.rotate(dx, dy);
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      e.preventDefault?.();
      this.update();
      return;
    }
    if (this.dragButton < 0 || this.mousePointer !== e.pointerId) return;
    const [dx, dy] = this.normalized(e.clientX - this.lastX, e.clientY - this.lastY);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    if (this.dragButton === 0) this.model.rotate(dx, dy);
    else this.model.pan(dx, dy);
    this.update();
  }

  private onPointerUp(e: PointerLike): void {
    const touch = this.touches.delete(e.pointerId);
    if (this.mousePointer === e.pointerId) {
      this.mousePointer = null;
      this.dragButton = -1;
    } else if (!touch) return;
    this.releasePointer(e.pointerId);
  }

  private releasePointer(pointerId: number): void {
    // Browsers may already have released capture on cancellation or lost capture.
    try { this.element?.releasePointerCapture?.(pointerId); } catch { /* already released */ }
  }

  private onWheel(e: WheelLike): void {
    e.preventDefault?.();
    this.model.dolly(Math.exp(e.deltaY * 0.001 * this.model.params.zoomSpeed));
    this.update();
  }
}
