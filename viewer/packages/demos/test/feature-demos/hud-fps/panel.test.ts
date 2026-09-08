// The frame-timing panel as a pure function: the lines it writes and the sparkline it scales, both
// read back as data from a made-up `HudData`. Nothing here touches a canvas.

import { describe, expect, it } from 'vitest';
import { frameBudgetMs, hudData, type DurationStats, type HudData } from '@bim-open-toolkit/render';
import {
  boxCorners,
  hudPalette,
  line,
  polygon,
  text,
  type Drawing,
  type PanelBox,
  type Primitive,
  type TextPrimitive,
} from '../../../src/feature-demos/hud-fps/drawing.js';
import {
  fpsDrawing,
  hudLines,
  sparkline,
  sparklineCeiling,
  sparklinePoints,
  withThousands,
} from '../../../src/feature-demos/hud-fps/panel.js';

const durations = (median: number, p95: number, count = 60): DurationStats => ({
  count,
  medianMs: median,
  p95Ms: p95,
  minMs: median - 1,
  maxMs: p95 + 1,
});

const scene = {
  sourceObjects: 1234,
  groups: 7,
  renderedInstances: 4321,
  visibleInstances: 4000,
  renderedTriangles: 9_876_543,
};

const reading = (gpuMedian?: number): HudData =>
  hudData(
    durations(12, 20),
    gpuMedian === undefined
      ? { state: 'unavailable', reason: 'EXT_disjoint_timer_query_webgl2 is not present' }
      : { state: 'available', stats: durations(gpuMedian, gpuMedian + 2) },
    scene,
    'perspective',
  );

const box: PanelBox = { x: 0, y: 0, width: 100, height: 50 };

const textsOf = (primitives: readonly Primitive[]): readonly TextPrimitive[] =>
  primitives.flatMap((item) => (item.kind === 'text' ? [item] : []));

const lineCount = (primitives: readonly Primitive[]): number =>
  primitives.filter((item) => item.kind === 'line').length;

describe('the panel text', () => {
  it('says nothing has been measured before the first reading', () => {
    expect(hudLines(undefined)).toEqual(['No frame has been measured yet.']);
  });

  it('writes the CPU percentiles, the rate they imply and the budget answer', () => {
    const lines = hudLines(reading());
    expect(lines[0]).toBe('CPU  12.0 ms median   20.0 ms p95');
    expect(lines[1]).toBe('     83.3 fps over 60 frames');
    expect(lines[2]).toBe('Within 33.3 ms budget: yes');
  });

  it('says why there is no GPU reading rather than showing a zero', () => {
    expect(hudLines(reading())[3]).toBe('GPU  no reading: EXT_disjoint_timer_query_webgl2 is not present');
    expect(hudLines(reading(3.5))[3]).toBe('GPU  3.5 ms median   5.5 ms p95');
  });

  it('counts the scene the three ways the HUD data distinguishes', () => {
    const lines = hudLines(reading());
    expect(lines[4]).toBe('1 234 objects  4 321 instances  4 000 shown');
    expect(lines[5]).toBe('9 876 543 triangles  7 groups  perspective');
  });

  it('adds the level only when navigation has been to one', () => {
    expect(hudLines(reading())).toHaveLength(6);
    expect(hudLines(reading(), 'Level 2')[6]).toBe('Level: Level 2');
  });

  it('groups thousands and keeps a negative sign', () => {
    expect(withThousands(0)).toBe('0');
    expect(withThousands(999)).toBe('999');
    expect(withThousands(1000)).toBe('1 000');
    expect(withThousands(-12345)).toBe('-12 345');
  });

  it('reports a frame time outside the budget as outside it', () => {
    const slow = hudData(durations(40, 60), { state: 'unavailable', reason: 'none' }, scene, 'orthographic');
    expect(hudLines(slow)[2]).toBe('Within 33.3 ms budget: no');
  });
});

describe('the sparkline', () => {
  it('scales to the budget while every interval is inside it', () => {
    expect(sparklineCeiling([10, 16, 12])).toBe(frameBudgetMs);
    const points = sparklinePoints([0, frameBudgetMs], box);
    expect(points).toEqual([
      [0, 50],
      [100, 0],
    ]);
  });

  it('scales to the longest interval once one runs over the budget', () => {
    expect(sparklineCeiling([10, 100])).toBe(100);
    expect(sparklinePoints([0, 50, 100], box)).toEqual([
      [0, 50],
      [50, 25],
      [100, 0],
    ]);
  });

  it('puts a single reading at the left edge and an empty run nowhere', () => {
    expect(sparklinePoints([], box)).toEqual([]);
    expect(sparklinePoints([frameBudgetMs], box)).toEqual([[0, 0]]);
  });

  it('clamps a negative or over-tall value into the box', () => {
    const points = sparklinePoints([-5, 10], { ...box, height: 10 }, 10);
    expect(points).toEqual([
      [0, 10],
      [100, 0],
    ]);
  });

  it('draws the box, the budget line, one join per gap and the scale caption', () => {
    const drawn = sparkline([10, 20, 30], box);
    expect(drawn[0]).toEqual(polygon(boxCorners(box), { stroke: hudPalette.border }));
    expect(drawn[1]).toEqual(line([0, 0], [100, 0], hudPalette.bad));
    expect(lineCount(drawn)).toBe(3);
    expect(drawn[drawn.length - 1]).toEqual(
      text([100, 61], '33.3 ms full scale', hudPalette.dim, { size: 9, align: 'right' }),
    );
  });
});

describe('the whole panel', () => {
  const drawing = (data: HudData | undefined): Drawing => fpsDrawing(data, [10, 20, 40]);

  it('is one text primitive per line plus the sparkline caption, on a panel-sized ground', () => {
    const drawn = drawing(reading());
    expect(drawn.width).toBe(320);
    expect(drawn.background).toBe(hudPalette.panel);
    expect(textsOf(drawn.primitives)).toHaveLength(7);
  });

  it('draws only the one line and the sparkline before anything is measured', () => {
    const drawn = drawing(undefined);
    expect(textsOf(drawn.primitives).map((item) => item.text)).toEqual([
      'No frame has been measured yet.',
      '40.0 ms full scale',
    ]);
  });

  it('colours the budget line green inside the budget and red outside it', () => {
    const paintOf = (data: HudData): string | undefined => textsOf(drawing(data).primitives)[2]?.fill;
    expect(paintOf(reading())).toBe(hudPalette.good);
    expect(paintOf(hudData(durations(40, 60), { state: 'unavailable', reason: 'none' }, scene, 'perspective'))).toBe(
      hudPalette.bad,
    );
  });
});
