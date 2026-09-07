import type { Viewer } from '@ara3d/viewer-core';
import type { OrbitControls } from '@ara3d/viewer-controls';
import type { ObjectRecord, ModelData } from '../../src/contracts.js';
import type { SelectionStore } from '../../src/selection.js';
import type { RenderBinding } from '../../src/render.js';

/** Gallery G1.1: each route owns one viewer, one feature and its cleanup. */
export type DemoContext = {
  readonly viewer: Viewer;
  readonly controls: OrbitControls;
  readonly render: RenderBinding;
  readonly canvas: HTMLCanvasElement;
  readonly base: readonly ObjectRecord[];
  readonly model: ModelData;
  readonly selection: SelectionStore;
  readonly panel: HTMLElement;
  button(label: string, action: () => void | Promise<void>): HTMLButtonElement;
  status(message: string): void;
  update(objects: readonly ObjectRecord[]): void;
  reset(): void;
  fit(): void;
};
export type FeatureDemo = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly tests: string;
  readonly source: string;
  mount(context: DemoContext): () => void;
};
