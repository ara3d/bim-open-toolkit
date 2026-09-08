// The seam between a feature's render hook and the render package.
//
// A feature never holds a renderer. It holds this, which names the models in the scene and the two
// writes a feature makes into them: a whole resolved styling, and a change table of named columns.
// `SceneBinding` satisfies it, so the adapter below is the only place the two packages meet and a
// test substitutes either the binding over a headless viewer-core scene or a recording double.

import type { ObjectKey, ResolvedStyles, Result, Table } from '@bim-open-toolkit/model';
import type { SceneBinding } from '@bim-open-toolkit/render';

// One model a feature styles: its id, and the object keys `resolveStyles` has to be given.
export type StyledModel = { readonly modelId: string; readonly keys: readonly ObjectKey[] };

// What a feature's render hook needs from a bound scene.
export type RenderTarget = {
  readonly styledModels: () => readonly StyledModel[];
  readonly applyStyles: (modelId: string, resolved: ResolvedStyles) => Result<unknown>;
  readonly applyChanges: (modelId: string, changes: Table) => Result<unknown>;
};

// The render package's scene binding as a render target. The keys are the binding's own, borrowed.
export const sceneRenderTarget = (binding: SceneBinding): RenderTarget => ({
  styledModels: () => binding.models.map((model) => ({ modelId: model.modelId, keys: model.table.keys })),
  applyStyles: (modelId, resolved) => binding.applyStyles(modelId, resolved),
  applyChanges: (modelId, changes) => binding.applyChanges(modelId, changes),
});

// A target over no models at all, which is what a session with nothing loaded styles.
export const noRenderTarget: RenderTarget = {
  styledModels: () => [],
  applyStyles: () => ({ ok: true, value: undefined, diagnostics: [] }),
  applyChanges: () => ({ ok: true, value: undefined, diagnostics: [] }),
};
