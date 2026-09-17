// Putting a demo's in-canvas panels on the page, and putting every control in them into the DOM.
//
// A panel is a Gratify surface on its own transparent canvas, sized to its content and placed by
// the host at a corner, an edge, or a point in the model projected each frame. `demo.panels` was
// part of contract G1 from the start and nothing drew it, so until now a demo's tools, legend and
// timeline existed in its source and nowhere a person could press them.
//
// A canvas is invisible to a screen reader and unreachable by a keyboard, so every panel is also
// written into the DOM as real buttons, from the semantics tree the surface publishes. Pressing one
// presses the control on the canvas through `activate`, which is the same path a pointer takes.
// This is the mirror the plan asks for (F09), built once here rather than by hand in each demo.

import type { Disposable, Session, Vec3 } from '@bim-open-toolkit/model';
import { hostAnyPanel, type AnyHudPanel, type Hosted } from '@bim-open-toolkit/ui-gratify';
import { button, clear, el } from './elements.js';
import type { GalleryViewer } from './contracts.js';

// What could not be drawn, so a page can say so instead of showing nothing and explaining nothing.
export type PanelFailure = { readonly id: string; readonly reason: string };

// Every panel a demo asked for, and what became of the ones that could not be hosted.
export type HostedPanels = Disposable & {
  readonly hosted: readonly Hosted[];
  readonly failed: readonly PanelFailure[];
};

// One line of the mirror per control the panel says it has. Groups are folded away: a person
// tabbing through wants the buttons, not the boxes they sit in.
const mirrorControls = (hosted: Hosted, into: HTMLElement): void => {
  const walk = (node: ReturnType<Hosted['semantics']>): void => {
    const label = node.label ?? node.role;
    const pressable = node.role !== undefined && node.role !== 'group' && label !== undefined;
    if (pressable) {
      const control = button('mirror-control', label, () => {
        hosted.activate(node.path);
      });
      if (node.value !== undefined) control.setAttribute('aria-valuetext', String(node.value));
      into.append(control);
    }
    for (const child of node.children) walk(child);
  };
  walk(hosted.semantics());
};

// Draws the panels into `viewport` and mirrors their controls into `mirror`.
//
// A panel that cannot be hosted does not stop the others: the reason is collected and the rest of
// the demo comes up, because a legend that failed to draw is not a reason to lose the model.
export const hostPanels = (
  viewport: HTMLElement,
  mirror: HTMLElement,
  panels: readonly AnyHudPanel[],
  viewer: GalleryViewer,
): HostedPanels => {
  const hosted: Hosted[] = [];
  const failed: PanelFailure[] = [];
  const following: Disposable[] = [];

  for (const panel of panels) {
    const made = hostAnyPanel(viewport, panel, viewer as Session, {
      world: {
        project: (point: Vec3) => {
          const at = viewer.project(point);
          return at === undefined ? undefined : { x: at[0], y: at[1] };
        },
        onFrame: (run: () => void) => viewer.onFrame(run),
      },
    });
    if (!made.ok) {
      failed.push({ id: panel.id, reason: made.diagnostics.map((one) => one.message).join('; ') });
      continue;
    }
    hosted.push(made.value);
  }

  // The mirror is rebuilt after every committed change, because a panel's controls are what its
  // document says they are: a segmented control changes what it offers when the mode changes.
  const draw = (): void => {
    clear(mirror);
    for (const one of hosted) {
      const group = el('div', 'mirror-panel');
      mirrorControls(one, group);
      if (group.childElementCount > 0) mirror.append(group);
    }
  };
  draw();
  for (const one of hosted) following.push(one.onChanged(draw));

  return {
    hosted,
    failed,
    dispose: () => {
      for (const one of following) one.dispose();
      for (const one of [...hosted].reverse()) one.dispose();
      clear(mirror);
    },
  };
};
