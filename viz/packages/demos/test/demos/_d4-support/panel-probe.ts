// Runs one HUD panel through Gratify's headless runtime, the way Track UG's host will run it in a
// page: the doc comes from the session through `sync`, a keyboard activation goes through the real
// interactors, and a doc the runtime committed goes back to the session through `onCommit`.
//
// It is a probe rather than a host: it never makes a canvas, so it returns what a test can assert
// on - the semantics tree, the world point the panel is placed at, and the doc as it stands - and
// not the `Hosted` a real host returns.

import { diagnostic, failure, type Result, type Session, type Vec3 } from '@bim-open-toolkit/model';
import type { AnyHudPanel, HudPanel, Hosted } from '@bim-open-toolkit/ui-gratify';
import { Runtime, type SemanticsNode } from 'gratify';

// What a test can see of a running panel.
export type PanelProbe = {
  readonly id: string;
  // The doc the panel is showing, as plain data.
  readonly doc: () => unknown;
  // The panel's semantics tree, which is what the gallery's DOM mirror is generated from.
  readonly semantics: () => readonly SemanticsNode[];
  // The world point the panel hangs over, or undefined when it is not placed at one.
  readonly point: () => Vec3 | undefined;
  // Tabs to the first focusable part and activates it, then hands any committed doc to `onCommit`.
  // Returns whether the activation was consumed.
  readonly activate: () => boolean;
  // Brings the session's state back into the doc, which is what a change event does in a page.
  readonly sync: () => void;
  readonly stop: () => void;
};

const noCanvas = (id: string): Result<Hosted> =>
  failure([diagnostic('test/no-canvas', `The headless probe does not host a canvas for "${id}".`)]);

// Runs a panel headlessly against a session. Returns nothing only when the panel refuses to be
// mounted at all, which no panel in this track does.
export const probePanel = (
  panel: AnyHudPanel,
  session: Session,
  width = 280,
  height = 180,
): PanelProbe | undefined => {
  let probe: PanelProbe | undefined;
  panel.host(<D, I>(hud: HudPanel<D, I>): Result<Hosted> => {
    const first = hud.sync === undefined ? hud.spec.init : hud.sync(session, hud.spec.init);
    const runtime = new Runtime<D, I>(null, { ...hud.spec, init: first }, { headless: true, width, height });
    runtime.step(4);
    probe = {
      id: hud.id,
      doc: () => runtime.doc,
      semantics: () => runtime.semanticsTree(),
      point: () => (hud.place.kind === 'world' ? hud.place.point(session) : undefined),
      activate: () => {
        const before = runtime.doc;
        const consumed = runtime.key('Tab') && runtime.key('Enter');
        runtime.step(2);
        const after = runtime.doc;
        if (after !== before && hud.onCommit !== undefined) hud.onCommit(after, before, session);
        return consumed;
      },
      sync: () => {
        if (hud.sync !== undefined) runtime.doc = hud.sync(session, runtime.doc);
        runtime.step(2);
      },
      stop: () => runtime.stop(),
    };
    return noCanvas(hud.id);
  });
  return probe;
};

// Every label the semantics tree carries, depth first, which is the order a keyboard walks them.
export const semanticLabels = (nodes: readonly SemanticsNode[]): readonly string[] =>
  nodes.flatMap((node) => [
    ...(node.label === undefined ? [] : [node.label]),
    ...semanticLabels(node.children),
  ]);
