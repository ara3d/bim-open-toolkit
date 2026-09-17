// What a command can reach that is not plain data: the bound scene and the open views.
//
// A slice holds what a document can carry. Fitting the camera to the model needs the model's world
// bounds, and painting a rule needs the instance table - neither is data a slice could hold, and
// M1's `Session` is deliberately four methods. So the viewer offers them as one service, and a
// command that needs them asks for it and reports when there is none.
//
// A headless session has no scene and no views, and `viewerAccess.get` returns undefined there.
// That is the honest answer, and it is what lets every command in this package be tested in Node.

import type { Bounds, ObjectKey, ObjectSet, Appearance, ViewState } from '@bim-open-toolkit/model';
import type { NavMode } from '@bim-open-toolkit/interact';
import type { ObjectHit, Ray, SceneBinding } from '@bim-open-toolkit/render';
import { service } from './services.js';

// The models bound to the renderer.
export type SceneAccess = {
  readonly binding: SceneBinding;
  // Every object key of every open model, which is what `resolveStyles` needs in order to know what
  // a filter hides.
  readonly keys: () => readonly ObjectKey[];
  // The appearance each object was loaded with. Without it every object resolves to the fallback
  // and the model is repainted flat on the first write.
  readonly base: () => ReadonlyMap<ObjectKey, Appearance>;
  readonly bounds: () => Bounds;
  // The world bounds of a set of objects, for fitting the camera to a selection.
  readonly boundsOf: (set: ObjectSet) => Bounds;
  // Writes the appearance the session's slices resolve to, into the buffers.
  readonly restyle: () => void;
};

// The canvases this session draws on.
export type ViewsAccess = {
  readonly ids: () => readonly string[];
  readonly camera: (id: string) => ViewState | undefined;
  // Moves a view's camera, flying there over the given milliseconds when asked.
  readonly setCamera: (id: string, view: ViewState, flightMs?: number) => boolean;
  readonly setMode: (mode: NavMode) => void;
  readonly aspect: (id: string) => number;
  // What is under a point in normalized device coordinates of one view.
  readonly pick: (id: string, x: number, y: number) => ObjectHit | undefined;
  readonly ray: (id: string, x: number, y: number) => Ray | undefined;
};

// Everything a command can reach beyond its slices.
export type ViewerAccess = {
  readonly scene: SceneAccess;
  readonly views: ViewsAccess;
};

// The service key. A command reads it with `viewerAccess.get(session)`.
export const viewerAccess = service<ViewerAccess>('viewer.access');
