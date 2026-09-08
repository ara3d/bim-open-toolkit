// A named list of saved scene documents, as pure list operations.
//
// A saved view in V2 is a whole `SceneDocument`: the models that were open, where each view was
// looking, the colour rules and the selection. Restoring one is `viewer.load(document)`, so nothing
// here needs to know what a slice holds. That is why saving works for a feature this package has
// never heard of.
//
// The clock and the storage stay outside. `savedAt` is given by the caller, so saving is a pure
// function of its inputs and a test does not have to freeze time.

import type { SceneDocument } from '@bim-open-toolkit/model';
import type { CaptureImage } from '@bim-open-toolkit/render';

// One saved scene. `thumbnail` is a data URL, or absent where nothing could be captured - a headless
// session, or a canvas with no WebGL.
export type SavedScene = {
  readonly id: string;
  readonly name: string;
  readonly savedAt: string;
  readonly document: SceneDocument;
  readonly thumbnail?: string | undefined;
};

// The id a name is saved under: the name, lowercased, with runs of anything else as one dash. Two
// names that differ only in punctuation therefore save over each other, which is what a person
// typing the same name twice means.
export const sceneId = (name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'view';

// The scenes with this one put in: replacing the scene of the same id in place, or appended.
export const putScene = (scenes: readonly SavedScene[], scene: SavedScene): readonly SavedScene[] =>
  scenes.some((one) => one.id === scene.id)
    ? scenes.map((one) => (one.id === scene.id ? scene : one))
    : [...scenes, scene];

// The scenes without the one named.
export const removeScene = (scenes: readonly SavedScene[], id: string): readonly SavedScene[] =>
  scenes.filter((one) => one.id !== id);

// The scene of an id, or nothing.
export const findScene = (scenes: readonly SavedScene[], id: string): SavedScene | undefined =>
  scenes.find((one) => one.id === id);

// A captured image as a data URL a thumbnail can show. Returns nothing when the bytes cannot be
// turned into one, which is the case in Node, where `btoa` is present but no image is captured.
export const thumbnailUrl = (image: CaptureImage): string | undefined => {
  if (image.bytes.length === 0) return undefined;
  let text = '';
  for (const byte of image.bytes) text += String.fromCharCode(byte);
  return `data:${image.format};base64,${btoa(text)}`;
};
