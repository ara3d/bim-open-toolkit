// The explode bar: a separator choice, a strength slider, and the two commands that leave the
// slider behind: arranging on a grid and putting everything back.
//
// The panel keeps no layout of its own beyond what it is about to ask for: `sync` reads the applied
// explode's `by` and `strength` back out of the layouts slice, so a strength set by any other route
// shows here too, and the bar never claims a strength that is not actually in force.
//
// `Grid` and `Reset` use ui-gratify's published `Button`. The separator chip and the strength slider
// stay local parts because `Segmented` and `Slider` have not been published yet; each is marked
// below and is deleted when its counterpart lands.
//
// The bar also carries what the layout in force actually does to the model that is open, counted off
// the model by `survey.ts`. A separator a model cannot be separated by reads as "moves 0 of 25675
// objects" rather than as a slider that does nothing.

import { layoutsSlice, type ExplodeBy, type Layout } from '@bim-open-toolkit/features';
import { Button, hudPanel, type AnyHudPanel, type HudPanel } from '@bim-open-toolkit/ui-gratify';
import { Drag1D, Label, part, Press, rect, Row, Stack, surface, v, type AppSpec, type Element } from 'gratify';
import { heldSurvey, movedBy, type ExplodeSurvey } from './survey.js';

// What the bar shows: the separator and strength it will next ask for, what the applied layout moves
// of the open model, and how many times the grid and reset buttons have been pressed.
export type ExplodeDoc = {
  readonly by: ExplodeBy;
  readonly strength: number;
  readonly objects: number;
  readonly moved: number;
  readonly gridAsked: number;
  readonly resetAsked: number;
};

export type ExplodeIntent =
  | { readonly kind: 'by'; readonly by: ExplodeBy }
  | { readonly kind: 'strength'; readonly strength: number }
  | { readonly kind: 'grid' }
  | { readonly kind: 'reset' };

// The strength slider's whole range, chosen to double the storey spacing at its top.
export const maxStrength = 2;

// A chip is a local part because `Segmented` has not been published yet; when it lands this part
// goes and the row keeps its shape.
type SeparatorProps = { readonly by: ExplodeBy; readonly label: string; readonly selected: boolean };

const SeparatorChip = part<SeparatorProps>()('explode-separator-chip', {
  size: (props, measure) => v(measure.text(props.label, 12).x + 22, 26),
  style: (tokens, channels, props) => ({
    ...surface(tokens, channels, props.selected ? { tint: tokens.accent } : {}),
    corner: 6,
  }),
  render: (node, painter, style) => {
    painter.box(node.rect, style.corner, style.fill, style.edge, 1);
    painter.label(node.props.label, node.rect.center, style.text, { size: 12 });
  },
  on: [Press((node): ExplodeIntent => ({ kind: 'by', by: node.props.by }))],
  semantics: (node) => ({ role: 'button', label: node.props.label, value: node.props.selected ? 'on' : 'off' }),
});

// A slider is a local part because ui-gratify's `Slider` has not been published yet; when it lands
// this part goes and the row keeps its shape.
type StrengthProps = { readonly strength: number };

const StrengthSlider = part<StrengthProps>()('explode-strength-slider', {
  size: () => v(170, 30),
  style: (tokens, channels) => ({
    track: tokens.muted,
    fill: tokens.accent,
    knob: tokens.mix(tokens.textBright, tokens.accent, (channels.hover ?? 0) * 0.3),
  }),
  render: (node, painter, style) => {
    const bar = node.rect;
    const x = bar.x + 8;
    const width = bar.w - 16;
    const y = bar.center.y;
    const fraction = Math.min(1, Math.max(0, node.props.strength / maxStrength));
    painter.box(rect(x, y - 2.5, width, 5), 2.5, style.track);
    painter.box(rect(x, y - 2.5, width * fraction, 5), 2.5, style.fill);
    painter.dot(v(x + width * fraction, y), 7, style.knob);
  },
  on: [
    Drag1D({
      axis: 'x',
      to: (_node, fraction): ExplodeIntent => ({
        kind: 'strength',
        strength: Math.round(fraction * maxStrength * 100) / 100,
      }),
    }),
  ],
  semantics: (node) => ({ role: 'slider', label: 'Explode strength', value: node.props.strength }),
});

const strengthText = (strength: number): string => `Strength ${strength.toFixed(2)}`;

// What the applied layout does to the open model, counted rather than promised.
export const movedText = (doc: ExplodeDoc): string =>
  doc.objects === 0 ? 'No model surveyed' : `Moves ${doc.moved} of ${doc.objects} objects`;

export const explodeApp: AppSpec<ExplodeDoc, ExplodeIntent> = {
  init: { by: 'storey', strength: 0, objects: 0, moved: 0, gridAsked: 0, resetAsked: 0 },
  update: (doc, intent) => {
    switch (intent.kind) {
      case 'by':
        return { ...doc, by: intent.by };
      case 'strength':
        return { ...doc, strength: intent.strength };
      case 'grid':
        return { ...doc, gridAsked: doc.gridAsked + 1 };
      case 'reset':
        return { ...doc, resetAsked: doc.resetAsked + 1 };
    }
  },
  view: (doc): Element =>
    Stack('explode-bar', { gap: 8, pad: 8 }, [
      Row('explode-by', { gap: 6 }, [
        SeparatorChip('storey', { by: 'storey', label: 'Storey', selected: doc.by === 'storey' }),
        SeparatorChip('category', { by: 'category', label: 'Category', selected: doc.by === 'category' }),
      ]),
      Row('explode-strength', { gap: 8 }, [
        Label('explode-strength-label', { text: strengthText(doc.strength), size: 12, dim: true }),
        StrengthSlider('strength', { strength: doc.strength }),
      ]),
      Label('explode-moved-label', { text: movedText(doc), size: 12, dim: true }),
      Row('explode-actions', { gap: 6 }, [
        Button('grid', { label: 'Grid', press: { kind: 'grid' } }),
        Button('reset', { label: 'Reset', press: { kind: 'reset' } }),
      ]),
    ]),
};

// The bar's `by` and `strength` as an applied explode holds them now, and what that layout moves of
// the surveyed model. Grid and reset carry no separator or strength of their own, so the bar keeps
// offering what was last asked for while still counting what the grid moved.
export const explodeDocFrom = (
  doc: ExplodeDoc,
  layout: Layout,
  survey: ExplodeSurvey | undefined,
): ExplodeDoc => {
  const asked = layout.kind === 'explode' ? { by: layout.by, strength: layout.strength } : {};
  const next: ExplodeDoc = { ...doc, ...asked, objects: survey?.objects ?? 0, moved: movedBy(survey, layout) };
  const same =
    next.by === doc.by &&
    next.strength === doc.strength &&
    next.objects === doc.objects &&
    next.moved === doc.moved;
  return same ? doc : next;
};

// The explode bar with its types open, so a test can drive `sync` and `onCommit` directly.
export const explodePanelSpec: HudPanel<ExplodeDoc, ExplodeIntent> = {
  id: 'explode-bar',
  place: { kind: 'edge', edge: 'bottom' },
  spec: explodeApp,
  sync: (session, doc) => explodeDocFrom(doc, session.read(layoutsSlice).layout, heldSurvey()),
  onCommit: (doc, previous, session) => {
    if (doc.by !== previous.by || doc.strength !== previous.strength) {
      session.dispatch('layouts.explode', { by: doc.by, strength: doc.strength });
    }
    if (doc.gridAsked !== previous.gridAsked) session.dispatch('layouts.grid', {});
    if (doc.resetAsked !== previous.resetAsked) session.dispatch('layouts.reset', {});
  },
};

// The explode bar as the gallery hosts it, along the bottom edge of the viewport.
export const explodePanel: AnyHudPanel = hudPanel(explodePanelSpec);

// Every panel this demo draws.
export const explodePanels: readonly AnyHudPanel[] = [explodePanel];
