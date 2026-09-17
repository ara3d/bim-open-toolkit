// The tag that floats over the object being read: its name on one line, its category and storey on
// the next, with a leader line down to the centre of the object's box.
//
// The document is a function of the session, so `sync` brings it in; the one thing the tag does on
// its own is drop the pin when it is pressed, which `onCommit` turns back into a command.

import type { Session, Vec3 } from '@bim-open-toolkit/model';
import { hudPanel, Tag, type AnyHudPanel, type HudPanel } from '@bim-open-toolkit/ui-gratify';
import { Stack, type AppSpec, type Element } from 'gratify';
import { centreOf, inspectIndex, runCalls, storeyNameOf } from './building.js';
import { isPinned, shownKey, unpinCalls } from './pinning.js';

// What the tag draws. Every field is text already, so the view asks the model nothing.
export type TagDoc = {
  readonly present: boolean;
  readonly name: string;
  readonly detail: string;
  readonly pinned: boolean;
};

// Pressing a pinned tag drops the pin.
export type TagIntent = { readonly kind: 'unpin' };

// Nothing pointed at and nothing pinned.
export const emptyTag: TagDoc = { present: false, name: '', detail: '', pinned: false };

// The tag for whatever the session is showing. An object with no recorded name says so rather than
// borrowing its category, and an object with no storey link says that too.
export const tagOf = (session: Session): TagDoc => {
  const key = shownKey(session);
  const index = inspectIndex();
  const record = key === undefined ? undefined : index.records.get(key);
  if (key === undefined || record === undefined) return emptyTag;
  const category = record.category ?? 'No category recorded';
  const storey = storeyNameOf(index, key) ?? 'no storey link recorded';
  return {
    present: true,
    name: record.name ?? `No name recorded (${record.ref.objectId})`,
    detail: `${category}, ${storey}`,
    pinned: isPinned(session),
  };
};

// The world point the tag hangs over: the centre of the shown object's box.
export const tagPoint = (session: Session): Vec3 | undefined => {
  const key = shownKey(session);
  return key === undefined ? undefined : centreOf(inspectIndex(), key);
};

const unpin: TagIntent = { kind: 'unpin' };

// The tag as an element. Nothing pointed at draws nothing at all, rather than an empty box.
export const tagView = (doc: TagDoc): Element =>
  doc.present
    ? Tag('tag', { text: doc.name, detail: doc.detail, ...(doc.pinned ? { press: unpin } : {}) })
    : Stack('tag', { pad: 0 }, []);

// The tag's app. Its only intent drops the pin; everything else it shows comes from `sync`.
export const tagSpec: AppSpec<TagDoc, TagIntent> = {
  init: emptyTag,
  update: (doc) => ({ ...doc, pinned: false }),
  view: tagView,
};

// The tag, anchored to the object it describes.
export const tagHudPanel: HudPanel<TagDoc, TagIntent> = {
  id: 'point-and-read/tag',
  place: { kind: 'world', point: tagPoint },
  spec: tagSpec,
  sync: (session) => tagOf(session),
  onCommit: (doc, previous, session) => {
    if (previous.pinned && !doc.pinned) runCalls(session, unpinCalls());
  },
};

// The same panel with its document and intent types closed over, which is what a demo lists.
export const tagPanel: AnyHudPanel = hudPanel(tagHudPanel);

// Every panel this demo draws.
export const pointAndReadPanels: readonly AnyHudPanel[] = [tagPanel];
