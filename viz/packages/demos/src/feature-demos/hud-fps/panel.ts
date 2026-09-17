// The frame-timing HUD as data: the lines of text it shows and the sparkline of recent frame
// intervals, both pure functions of a reading the `hud` feature wrote and a run of intervals the
// page kept. Nothing here reads a clock, a canvas or a session.

import type { Vec2 } from '@bim-open-toolkit/model';
import { frameBudgetMs, type HudData } from '@bim-open-toolkit/render';
import {
  boxCorners,
  hudPalette,
  line,
  polygon,
  text,
  type Drawing,
  type PanelBox,
  type Primitive,
} from './drawing.js';

const oneDecimal = (value: number): string => value.toFixed(1);

// A whole number with a thin space every three digits, so ten million triangles reads as such.
export const withThousands = (value: number): string => {
  const digits = String(Math.round(Math.abs(value)));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return value < 0 ? `-${grouped}` : grouped;
};

// The lines the panel shows, top to bottom: CPU frame times and the rate they imply, whether the
// 95th percentile is inside the 30-frames-a-second budget, the GPU reading or the reason there is
// none, and what is in the scene. `level` is shown only when navigation has been to one.
export const hudLines = (data: HudData | undefined, level?: string | undefined): readonly string[] => {
  if (data === undefined) return ['No frame has been measured yet.'];
  const scene = data.scene;
  return [
    `CPU  ${oneDecimal(data.frames.medianMs)} ms median   ${oneDecimal(data.frames.p95Ms)} ms p95`,
    `     ${oneDecimal(data.framesPerSecond)} fps over ${data.frames.count} frames`,
    `Within ${oneDecimal(frameBudgetMs)} ms budget: ${data.withinBudget ? 'yes' : 'no'}`,
    data.gpu.state === 'available'
      ? `GPU  ${oneDecimal(data.gpu.stats.medianMs)} ms median   ${oneDecimal(data.gpu.stats.p95Ms)} ms p95`
      : `GPU  no reading: ${data.gpu.reason}`,
    `${withThousands(scene.sourceObjects)} objects  ${withThousands(scene.renderedInstances)} instances  ${withThousands(scene.visibleInstances)} shown`,
    `${withThousands(scene.renderedTriangles)} triangles  ${withThousands(scene.groups)} groups  ${data.camera}`,
    ...(level === undefined ? [] : [`Level: ${level}`]),
  ];
};

// The top of the sparkline's vertical scale: the longest interval in the run, or the frame budget
// when every interval is shorter, so the budget line is always inside the box.
export const sparklineCeiling = (values: readonly number[], budgetMs = frameBudgetMs): number =>
  Math.max(budgetMs, ...values.filter((value) => Number.isFinite(value) && value >= 0));

// The intervals as points in the box: oldest at the left edge, newest at the right, zero along the
// bottom and `sparklineCeiling` along the top. A run of one sits at the left edge; an empty run has
// no points.
export const sparklinePoints = (
  values: readonly number[],
  box: PanelBox,
  budgetMs = frameBudgetMs,
): readonly Vec2[] => {
  const ceiling = sparklineCeiling(values, budgetMs);
  const steps = Math.max(values.length - 1, 1);
  return values.map((value, index): Vec2 => [
    box.x + (index / steps) * box.width,
    box.y + box.height - (Math.min(Math.max(value, 0), ceiling) / ceiling) * box.height,
  ]);
};

// The sparkline: the box, the budget line across it, and the run of intervals joined up.
export const sparkline = (
  values: readonly number[],
  box: PanelBox,
  budgetMs = frameBudgetMs,
): readonly Primitive[] => {
  const points = sparklinePoints(values, box, budgetMs);
  const ceiling = sparklineCeiling(values, budgetMs);
  const budgetY = box.y + box.height - (budgetMs / ceiling) * box.height;
  const joins = points.slice(1).map((point, index) => {
    const previous = points[index] ?? point;
    return line(previous, point, hudPalette.trace, 1.5);
  });
  return [
    polygon(boxCorners(box), { stroke: hudPalette.border }),
    line([box.x, budgetY], [box.x + box.width, budgetY], hudPalette.bad),
    ...joins,
    text([box.x + box.width, box.y + box.height + 11], `${oneDecimal(ceiling)} ms full scale`, hudPalette.dim, {
      size: 9,
      align: 'right',
    }),
  ];
};

// The panel's size and the room around what it draws.
export const fpsPanelSize = { width: 320, height: 190 } as const;

// The budget line is written in the colour of its own answer: green inside it, red outside it.
export const budgetPaint = (data: HudData): string => (data.withinBudget ? hudPalette.good : hudPalette.bad);

// The whole panel: the lines, then the sparkline of the intervals under them.
export const fpsDrawing = (
  data: HudData | undefined,
  intervals: readonly number[],
  level?: string | undefined,
): Drawing => {
  const lines = hudLines(data, level);
  const lineHeight = 15;
  const top = 20;
  const written = lines.map((value, index) =>
    text([12, top + index * lineHeight], value, index === 2 && data !== undefined ? budgetPaint(data) : hudPalette.text),
  );
  const box: PanelBox = {
    x: 12,
    y: top + lines.length * lineHeight + 4,
    width: fpsPanelSize.width - 24,
    height: fpsPanelSize.height - (top + lines.length * lineHeight + 4) - 22,
  };
  return {
    width: fpsPanelSize.width,
    height: fpsPanelSize.height,
    background: hudPalette.panel,
    primitives: [...written, ...sparkline(intervals, box)],
  };
};
