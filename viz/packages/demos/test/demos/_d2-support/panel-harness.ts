// Driving a demo's Gratify panel without a canvas.
//
// Gratify's own `Runtime` runs headless against a null painter and takes real pointer input, so a
// panel test presses the widget a person would press rather than calling `update` directly. Widgets
// are found through the semantics tree, which is also what the gallery's DOM mirror walks, so a
// control a test cannot reach is a control a keyboard cannot reach either.

import { Runtime, type AppSpec, type SemanticsNode } from 'gratify';

// A panel under test: its runtime, and the doc it holds now.
export type HeadlessPanel<D, I> = {
  readonly runtime: Runtime<D, I>;
  readonly doc: () => D;
  readonly controls: () => readonly SemanticsNode[];
  // Presses the first control whose label matches; false when there is no such control.
  readonly press: (label: string) => boolean;
  // Drags along the x axis from one control's left edge to the given fraction of its width.
  readonly dragX: (label: string, fraction: number) => boolean;
  readonly dispose: () => void;
};

const flatten = (nodes: readonly SemanticsNode[]): readonly SemanticsNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

// A panel's app, run headless at the given size and advanced one frame so everything has a rect.
export const headlessPanel = <D, I>(spec: AppSpec<D, I>, width = 480, height = 240): HeadlessPanel<D, I> => {
  const runtime = new Runtime<D, I>(null, spec, { headless: true, width, height });
  runtime.step(2);
  const controls = (): readonly SemanticsNode[] => flatten(runtime.semanticsTree());
  const find = (label: string): SemanticsNode | undefined =>
    controls().find((node) => node.label === label);
  const press = (label: string): boolean => {
    const node = find(label);
    if (node === undefined) return false;
    runtime.pointerDown(node.rect.center);
    runtime.pointerUp(node.rect.center);
    runtime.step(2);
    return true;
  };
  const dragX = (label: string, fraction: number): boolean => {
    const node = find(label);
    if (node === undefined) return false;
    const start = { x: node.rect.x, y: node.rect.center.y };
    runtime.pointerDown(start);
    runtime.pointerMove({ x: node.rect.x + node.rect.w * fraction, y: node.rect.center.y });
    runtime.pointerUp({ x: node.rect.x + node.rect.w * fraction, y: node.rect.center.y });
    runtime.step(2);
    return true;
  };
  return {
    runtime,
    doc: () => runtime.doc,
    controls,
    press,
    dragX,
    dispose: () => runtime.stop(),
  };
};
