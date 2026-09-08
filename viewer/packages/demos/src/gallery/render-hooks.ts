// The step between a feature and the picture: a feature holds state and commands, and its render
// hook is what puts that state on a renderer.
//
// A demo names plain features - `environmentFeature`, `layoutsFeature` - because a demo has no
// renderer to bind them to. `featureHost.install` runs whatever hook a feature carries, and a plain
// one carries none, so without this file a demo's `environment.set` changes the slice, the
// inspector, and nothing anybody can see. The viewer attaches these once a model is open, because
// every one of them needs the bound scene, and takes them away before the next model.
//
// A feature whose id is not listed here needs no renderer: its state is read by a panel or the
// inspector rather than drawn.

import {
  appearanceRenderHook,
  clippingHook,
  environmentHook,
  environmentSlice,
  layoutsHook,
  navigationHook,
  sceneRenderTarget,
} from '@bim-open-toolkit/features';
import {
  disposable,
  upVector,
  type AnyFeature,
  type Bounds,
  type Disposable,
  type Session,
  type Vec3,
  type ViewState,
} from '@bim-open-toolkit/model';
import type { ClippingTarget, EnvironmentTarget, SceneBinding } from '@bim-open-toolkit/render';
import type { OpenedModel } from './contracts.js';

// What the hooks need from the viewer that they cannot get from the session.
export type RenderHookHost = {
  readonly binding: SceneBinding;
  // The models in the order they were opened; a layout moves the first one, which is the model a
  // demo opened. A demo showing several models arranges them through its own commands.
  readonly opened: () => readonly OpenedModel[];
  readonly bounds: () => Bounds;
  readonly clipping: ClippingTarget;
  // Built per attachment rather than held, because the up axis is part of the environment state.
  readonly environmentTarget: (up: Vec3) => EnvironmentTarget;
  readonly setView: (view: ViewState) => void;
  readonly requestRender: () => void;
};

// The ids this file knows how to draw. A demo naming any of these gets the picture; a demo naming
// anything else gets its state and no complaint.
export const drawnFeatureIds: readonly string[] = [
  'appearance',
  'clipping',
  'environment',
  'layouts',
  'navigation-aids',
];

// The hook for one feature, or undefined when that feature draws nothing.
const hookFor = (
  id: string,
  session: Session,
  host: RenderHookHost,
): ((session: Session) => Disposable) | undefined => {
  if (id === 'appearance') {
    const base = host.opened()[0]?.base;
    return appearanceRenderHook(sceneRenderTarget(host.binding), base);
  }
  if (id === 'clipping') return clippingHook(host.clipping);
  if (id === 'environment') {
    const up = upVector(session.read(environmentSlice).settings.up);
    return environmentHook({ target: host.environmentTarget(up), bounds: host.bounds });
  }
  if (id === 'layouts') {
    const model = host.opened()[0];
    const bound = host.binding.models[0];
    if (model === undefined || bound === undefined) return undefined;
    return layoutsHook({
      table: bound.table,
      model: model.data,
      dirty: bound.dirty,
      // A layout writes into the group buffers; nothing is on screen until they are published.
      moved: () => {
        host.binding.publish();
        host.requestRender();
      },
    });
  }
  if (id === 'navigation-aids') return navigationHook({ setView: host.setView });
  return undefined;
};

// Attaches every render hook the given features have, in the order the demo named them. Disposing
// runs each hook's own undo in reverse, which is what puts the scene back as it was loaded.
export const attachRenderHooks = (
  session: Session,
  features: readonly AnyFeature[],
  host: RenderHookHost,
): Disposable => {
  const attached: Disposable[] = [];
  for (const feature of features) {
    // A feature that already carries its own hook was bound by whoever built it; installing a
    // second one would write the same state twice.
    if (feature.install !== undefined) continue;
    const hook = hookFor(feature.id, session, host);
    if (hook !== undefined) attached.push(hook(session));
  }
  return disposable(() => {
    for (const one of [...attached].reverse()) one.dispose();
    attached.length = 0;
  });
};
