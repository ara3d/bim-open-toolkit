// The frame-time strip and the two buttons that change everything at once.
//
// The strip is the heads-up display's own readings, not a second measurement: the HUD samples the
// frame timer at a bounded rate and writes what it saw into its slice, and `sync` appends each new
// reading here. Measuring the frames again in the panel would give a second number for the same
// thing, and there would be no way to say which one was right.
//
// The chip and the strip are parts defined here because the ui-gratify widget kit has not been
// published; when `Button` and `Sparkline` land they replace both and the panel keeps its shape.

import { hudSlice, layoutsSlice } from '@bim-open-toolkit/features';
import { targetFrameBudgetMs, timingStats } from '@bim-open-toolkit/testing';
import { hudPanel, type AnyHudPanel, type HudPanel } from '@bim-open-toolkit/ui-gratify';
import { Label, Press, Row, Stack, part, surface, v, type AppSpec, type Element } from 'gratify';
import { moveAll, recolourAll } from './bulk.js';
import { openedKeys } from './scene.js';

// How many readings the strip keeps. At the HUD's default of four a second, this is half a minute.
export const strippedSamples = 120;

// What the strip shows: the readings so far, when the last one was taken, how many times everything
// has been recoloured, and whether everything is on the grid.
export type StressDoc = {
  readonly samples: readonly number[];
  readonly lastAt: number;
  readonly recoloured: number;
  readonly onGrid: boolean;
};

export type StressIntent = { readonly kind: 'recolour' } | { readonly kind: 'move' };

type ChipProps = { readonly label: string; readonly selected: boolean; readonly press: StressIntent };

const StressChip = part<ChipProps>()('ten-thousand-chip', {
  size: (props, measure) => v(measure.text(props.label, 12).x + 24, 26),
  style: (tokens, channels, props) => ({
    ...surface(tokens, channels, props.selected ? { tint: tokens.accent } : {}),
    corner: 6,
  }),
  render: (node, painter, style) => {
    painter.box(node.rect, style.corner, style.fill, style.edge, 1);
    painter.label(node.props.label, node.rect.center, style.text, { size: 12 });
  },
  on: [Press((node): StressIntent => node.props.press)],
  semantics: (node) => ({ role: 'button', label: node.props.label, value: node.props.selected ? 'on' : 'off' }),
});

type StripProps = { readonly samples: readonly number[]; readonly budgetMs: number };

// The tallest value the strip is drawn against: the budget, or the worst reading when one is worse,
// so a run that misses the budget is visibly off the top rather than clipped to it.
export const stripCeiling = (samples: readonly number[], budgetMs: number): number =>
  Math.max(budgetMs, ...samples, budgetMs);

const FrameStrip = part<StripProps>()('ten-thousand-frame-strip', {
  size: () => v(240, 44),
  style: (tokens, channels) => ({
    ...surface(tokens, channels),
    line: tokens.accent,
    budget: tokens.muted,
  }),
  render: (node, painter, style) => {
    const box = node.rect;
    painter.box(box, 6, style.fill, style.edge, 1);
    const { samples, budgetMs } = node.props;
    const ceiling = stripCeiling(samples, budgetMs);
    const budgetY = box.y + box.h - (budgetMs / ceiling) * box.h;
    painter.line(v(box.x, budgetY), v(box.x + box.w, budgetY), style.budget, 1);
    if (samples.length < 2) return;
    const step = box.w / (samples.length - 1);
    for (let at = 1; at < samples.length; at += 1) {
      const before = samples[at - 1] ?? 0;
      const now = samples[at] ?? 0;
      painter.line(
        v(box.x + (at - 1) * step, box.y + box.h - (before / ceiling) * box.h),
        v(box.x + at * step, box.y + box.h - (now / ceiling) * box.h),
        style.line,
        1.5,
      );
    }
  },
  semantics: (node) => ({
    role: 'graph',
    label: 'Frame time',
    value: node.props.samples.length === 0 ? 'no readings' : `${node.props.samples.length} readings`,
  }),
});

// What the strip says underneath itself: the percentiles of the readings it holds, or that it holds
// none. The statistics are `@bim-open-toolkit/testing`'s, so they are the same ones a benchmark
// report states.
export const stripSummary = (samples: readonly number[]): string => {
  if (samples.length === 0) return 'No frame readings yet';
  const stats = timingStats(samples, targetFrameBudgetMs);
  return `${samples.length} readings, median ${stats.medianMs.toFixed(1)} ms, p95 ${stats.p95Ms.toFixed(1)} ms`;
};

export const stressApp: AppSpec<StressDoc, StressIntent> = {
  init: { samples: [], lastAt: 0, recoloured: 0, onGrid: false },
  update: (doc, intent) =>
    intent.kind === 'recolour'
      ? { ...doc, recoloured: doc.recoloured + 1 }
      : { ...doc, onGrid: !doc.onGrid },
  view: (doc): Element =>
    Stack('ten-thousand-bar', { gap: 6, pad: 8 }, [
      FrameStrip('strip', { samples: doc.samples, budgetMs: targetFrameBudgetMs }),
      Label('strip-summary', { text: stripSummary(doc.samples), size: 12, dim: true }),
      Row('ten-thousand-actions', { gap: 6 }, [
        StressChip('recolour', { label: 'Recolour everything', selected: false, press: { kind: 'recolour' } }),
        StressChip('move', { label: 'Move everything', selected: doc.onGrid, press: { kind: 'move' } }),
      ]),
    ]),
};

// The doc with a reading appended, or unchanged when the reading is one it already holds.
export const withReading = (doc: StressDoc, at: number, medianMs: number): StressDoc =>
  at === doc.lastAt
    ? doc
    : { ...doc, lastAt: at, samples: [...doc.samples, medianMs].slice(-strippedSamples) };

// The strip and the buttons with their types open, so a test can drive `sync` and `onCommit`.
export const stressPanelSpec: HudPanel<StressDoc, StressIntent> = {
  id: 'ten-thousand-strip',
  place: { kind: 'edge', edge: 'bottom' },
  spec: stressApp,
  sync: (session, doc) => {
    const reading = session.read(hudSlice).reading;
    const onGrid = session.read(layoutsSlice).layout.kind === 'grid';
    const sampled = reading === undefined ? doc : withReading(doc, reading.at, reading.data.frames.medianMs);
    return sampled.onGrid === onGrid ? sampled : { ...sampled, onGrid };
  },
  onCommit: (doc, previous, session) => {
    if (doc.recoloured !== previous.recoloured) recolourAll(session, openedKeys(), doc.recoloured);
    if (doc.onGrid !== previous.onGrid) moveAll(session, doc.onGrid);
  },
};

// The strip as the gallery hosts it, along the bottom edge of the viewport.
export const stressPanel: AnyHudPanel = hudPanel(stressPanelSpec);

// Every panel this demo draws.
export const stressPanels: readonly AnyHudPanel[] = [stressPanel];
