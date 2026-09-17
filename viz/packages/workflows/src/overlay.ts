import { type ObjectKey, type Vec3 } from '@bim-open-toolkit/model';
import { type Outcome } from './outcome.js';
import { resultRecord, type ResultRecord } from './values.js';

// Where an overlay item sits: on an object, or at a point in the model's own coordinate frame.
// An input with no coordinates can still anchor to an object, so nothing has to invent a position.
export type OverlayAnchor =
  | { readonly kind: 'object'; readonly key: ObjectKey }
  | { readonly kind: 'point'; readonly position: Vec3 };

// A point of interest, a directed line or a floating label, as plain data a renderer can draw.
export type Overlay =
  | { readonly kind: 'marker'; readonly id: string; readonly text: string; readonly outcome: Outcome; readonly at: OverlayAnchor }
  | { readonly kind: 'label'; readonly id: string; readonly text: string; readonly outcome: Outcome; readonly at: OverlayAnchor }
  | {
      readonly kind: 'line';
      readonly id: string;
      readonly text: string;
      readonly outcome: Outcome;
      readonly from: OverlayAnchor;
      readonly to: OverlayAnchor;
    };

// An anchor on an object.
export const onObject = (key: ObjectKey): OverlayAnchor => ({ kind: 'object', key });

// An anchor at a point.
export const atPoint = (position: Vec3): OverlayAnchor => ({ kind: 'point', position });

// A clickable point of interest.
export const marker = (id: string, text: string, outcome: Outcome, at: OverlayAnchor): Overlay => ({
  kind: 'marker',
  id,
  text,
  outcome,
  at,
});

// A label placed at an anchor.
export const label = (id: string, text: string, outcome: Outcome, at: OverlayAnchor): Overlay => ({
  kind: 'label',
  id,
  text,
  outcome,
  at,
});

// A directed line from one anchor to another, which is what a trace draws.
export const line = (id: string, text: string, outcome: Outcome, from: OverlayAnchor, to: OverlayAnchor): Overlay => ({
  kind: 'line',
  id,
  text,
  outcome,
  from,
  to,
});

const anchorRecord = (anchor: OverlayAnchor): ResultRecord =>
  anchor.kind === 'object' ? { kind: 'object', key: anchor.key } : { kind: 'point', position: anchor.position };

// An overlay as a plain record, which is what a command input carries.
export const overlayRecord = (item: Overlay): ResultRecord =>
  resultRecord({
    kind: item.kind,
    id: item.id,
    text: item.text,
    outcome: item.outcome,
    at: item.kind === 'line' ? undefined : anchorRecord(item.at),
    from: item.kind === 'line' ? anchorRecord(item.from) : undefined,
    to: item.kind === 'line' ? anchorRecord(item.to) : undefined,
  });
