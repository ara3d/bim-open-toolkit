// Several canvases over one session.
//
// Everything that is drawn - the models, their groups, their appearance - belongs to the session,
// so a second view costs a camera, a canvas and a renderer, and not a second copy of the model: the
// same `InstancedGroup`s go into both scenes and one colour write moves both pictures.
//
// Linking is here rather than in a view because a view cannot know about its neighbours. When views
// are linked, the camera that moved is copied to the others, once, with the copy guarded so that
// two linked views do not chase each other around the loop.

import { diagnostic, failure, success, type Result, type ViewState } from '@bim-open-toolkit/model';
import type { InstancedGroup } from '@ara3d/viewer-core';
import type { View } from './view.js';

// The views of one session.
export type ViewSet = {
  readonly ids: () => readonly string[];
  readonly all: () => readonly View[];
  readonly get: (id: string) => View | undefined;
  // Adds a view. A repeated id is refused rather than replacing the view that has it.
  readonly add: (view: View) => Result<View>;
  // Removes a view and disposes it. Returns false when there was no such view.
  readonly remove: (id: string) => boolean;
  readonly linked: () => boolean;
  readonly setLinked: (linked: boolean) => void;
  // Copies a camera to the other views when they are linked. Does nothing when they are not.
  readonly follow: (fromId: string, view: ViewState) => void;
  // Puts a set of groups into every view, which is what opening a model does.
  readonly addGroups: (groups: readonly InstancedGroup[]) => void;
  readonly removeGroups: (groups: readonly InstancedGroup[]) => void;
  readonly requestRender: () => void;
  readonly dispose: () => void;
};

// A set of views, empty until one is added.
export const viewSet = (): ViewSet => {
  const views = new Map<string, View>();
  let linked = false;
  // True while a linked camera is being copied, so a copy does not start another round.
  let copying = false;

  return {
    ids: () => [...views.keys()],
    all: () => [...views.values()],
    get: (id) => views.get(id),
    add: (view) => {
      if (views.has(view.id))
        return failure([diagnostic('viewer/repeated-view', `There is already a view called ${view.id}.`, ['id'])]);
      views.set(view.id, view);
      return success(view);
    },
    remove: (id) => {
      const view = views.get(id);
      if (view === undefined) return false;
      views.delete(id);
      view.dispose();
      return true;
    },
    linked: () => linked,
    setLinked: (next) => {
      linked = next;
    },
    follow: (fromId, view) => {
      if (!linked || copying) return;
      copying = true;
      try {
        for (const other of views.values()) if (other.id !== fromId) other.setCamera(view);
      } finally {
        copying = false;
      }
    },
    addGroups: (groups) => {
      for (const view of views.values()) view.addGroups(groups);
    },
    removeGroups: (groups) => {
      for (const view of views.values()) view.removeGroups(groups);
    },
    requestRender: () => {
      for (const view of views.values()) view.requestRender();
    },
    dispose: () => {
      const all = [...views.values()];
      views.clear();
      for (const view of all) view.dispose();
    },
  };
};
