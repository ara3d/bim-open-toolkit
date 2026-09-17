import { Camera } from 'three';
import { PickHit, ndcFromClient } from './pick.js';
import { Selection } from './selection.js';

/** Anything that can resolve an NDC point to a hit (structurally, Picker). */
export interface PickSource {
  pick(camera: Camera, ndcX: number, ndcY: number): PickHit | null;
}

/** DOM surface the click binding needs (testable with a fake). */
export interface PickElement {
  addEventListener(type: string, listener: (event: never) => void): void;
  removeEventListener(type: string, listener: (event: never) => void): void;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
}

interface PointerLike {
  readonly button: number;
  readonly clientX: number;
  readonly clientY: number;
}

const DRAG_THRESHOLD = 5;

/**
 * Click-to-select binding: a left click (not a drag) raycasts through the
 * picker and updates the selection — clicking empty space clears it.
 */
export class PickControls {
  private element: PickElement | null = null;
  private downAt: { x: number; y: number } | null = null;
  private readonly handlers: Array<[string, (e: never) => void]> = [];

  constructor(
    private readonly picker: PickSource,
    private readonly selection: Selection,
    private readonly camera: () => Camera,
  ) {}

  attach(element: PickElement): void {
    if (this.element) throw new Error('PickControls is already attached');
    this.element = element;
    const down = (e: PointerLike) => {
      if (e.button === 0) this.downAt = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerLike) => this.onPointerUp(e);
    element.addEventListener('pointerdown', down as (e: never) => void);
    element.addEventListener('pointerup', up as (e: never) => void);
    this.handlers.push(
      ['pointerdown', down as (e: never) => void],
      ['pointerup', up as (e: never) => void],
    );
  }

  dispose(): void {
    if (!this.element) return;
    for (const [type, handler] of this.handlers)
      this.element.removeEventListener(type, handler);
    this.handlers.length = 0;
    this.element = null;
  }

  private onPointerUp(e: PointerLike): void {
    if (e.button !== 0 || !this.downAt || !this.element) return;
    const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
    this.downAt = null;
    if (moved > DRAG_THRESHOLD) return;
    const ndc = ndcFromClient(this.element.getBoundingClientRect(), e.clientX, e.clientY);
    const hit = this.picker.pick(this.camera(), ndc.x, ndc.y);
    this.selection.select(
      hit ? { group: hit.group, instanceIndex: hit.instanceIndex } : null,
    );
  }
}
