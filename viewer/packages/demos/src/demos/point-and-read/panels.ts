// The tag that floats over the object being read: its name, its category and its storey, anchored
// to the centre of the object's box.
//
// It takes no intents. Everything it shows is a function of the session, so `sync` is the whole
// story and `update` has nothing to do. It is built from Gratify's own `Stack` and `Label` because
// Track UG's `Tag` widget, with its leader line, has not landed; CHECKPOINT-D1.md records the swap.

import { setsSlice, findSet } from '@bim-open-toolkit/features';
import type { ObjectKey, Session, Vec3 } from '@bim-open-toolkit/model';
import { hudPanel, type AnyHudPanel } from '@bim-open-toolkit/ui-gratify';
import { Label, Stack, type AppSpec, type Element } from 'gratify';
import { centreOf, inspectIndex, storeyNameOf } from './building.js';

// The set the demo pins the object it is reading into. It holds one member, or none.
export const pinnedSetId = 'point-and-read/pinned';

// The object the tag and the inspector show: the pinned one, or the one under the pointer.
export const shownKey = (session: Session): ObjectKey | undefined => {
  const state = session.read(setsSlice);
  return findSet(state, pinnedSetId)?.members[0] ?? state.selection[0];
};

// True when the object being shown was pinned by a click rather than pointed at.
export const isPinned = (session: Session): boolean =>
  findSet(session.read(setsSlice), pinnedSetId)?.members[0] !== undefined;

// What the tag draws. Every field is text already, so the view asks the model nothing.
export type TagDoc = {
  readonly present: boolean;
  readonly name: string;
  readonly category: string;
  readonly storey: string;
  readonly pinned: boolean;
};

// Nothing pointed at and nothing pinned.
export const emptyTag: TagDoc = { present: false, name: '', category: '', storey: '', pinned: false };

// The tag for whatever the session is showing. An object with no recorded name says so rather than
// borrowing its category, and an object with no storey link says that too.
export const tagOf = (session: Session): TagDoc => {
  const key = shownKey(session);
  const index = inspectIndex();
  const record = key === undefined ? undefined : index.records.get(key);
  if (key === undefined || record === undefined) return emptyTag;
  return {
    present: true,
    name: record.name ?? `No name recorded (${record.ref.objectId})`,
    category: record.category ?? 'No category recorded',
    storey: storeyNameOf(index, key) ?? 'No storey link recorded',
    pinned: isPinned(session),
  };
};

// The world point the tag hangs over: the centre of the shown object's box.
export const tagPoint = (session: Session): Vec3 | undefined => {
  const key = shownKey(session);
  return key === undefined ? undefined : centreOf(inspectIndex(), key);
};

// The tag as an element tree: name, category, storey, and whether it is pinned.
export const tagView = (doc: TagDoc): Element =>
  Stack(
    'tag',
    { gap: 2, pad: 8, align: 'start' },
    doc.present
      ? [
          Label('name', { text: doc.name, size: 15 }),
          Label('category', { text: doc.category, dim: true }),
          Label('storey', { text: doc.storey, dim: true }),
          Label('pin', { text: doc.pinned ? 'Pinned' : 'Click to pin', dim: true }),
        ]
      : [],
  );

// The tag's app: a document that only ever comes from the session.
export const tagSpec: AppSpec<TagDoc, never> = {
  init: emptyTag,
  update: (doc) => doc,
  view: tagView,
};

// The tag, anchored to the object it describes.
export const tagPanel: AnyHudPanel = hudPanel<TagDoc, never>({
  id: 'point-and-read/tag',
  place: { kind: 'world', point: tagPoint },
  spec: tagSpec,
  sync: (session) => tagOf(session),
});

// Every panel this demo draws.
export const pointAndReadPanels: readonly AnyHudPanel[] = [tagPanel];
