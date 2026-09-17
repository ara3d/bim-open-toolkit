// The primitives a HUD is made of, and the one painter that puts them on a canvas.
//
// Every HUD on the three pages of this track is a pure function from plain inputs to a `Drawing`,
// so its geometry, its ordering and its colours are all decided in code a Node test reads back as
// data. The painter below is the only part that touches a canvas and it makes no decisions: it
// draws what it is handed, in order. `hud-minimap` and `hud-gumball` import this file. It lives
// here rather than in `_shared`, which the supervisor owns.

import type { Vec2 } from '@bim-open-toolkit/model';

// A colour written the way CSS writes it, which is what a 2D context takes.
export type Paint = string;

// A straight line between two points in panel coordinates: x right, y down, CSS pixels.
export type LinePrimitive = {
  readonly kind: 'line';
  readonly from: Vec2;
  readonly to: Vec2;
  readonly stroke: Paint;
  readonly width?: number | undefined;
};

// A closed outline, filled, stroked, or both.
export type PolygonPrimitive = {
  readonly kind: 'polygon';
  readonly points: readonly Vec2[];
  readonly fill?: Paint | undefined;
  readonly stroke?: Paint | undefined;
  readonly width?: number | undefined;
};

// A run of text anchored at the left, middle or right of `at`, which sits on the baseline.
export type TextPrimitive = {
  readonly kind: 'text';
  readonly at: Vec2;
  readonly text: string;
  readonly fill: Paint;
  readonly size?: number | undefined;
  readonly align?: 'left' | 'center' | 'right' | undefined;
};

// One thing to draw.
export type Primitive = LinePrimitive | PolygonPrimitive | TextPrimitive;

// A whole HUD: the panel it fills, what is behind it, and what to draw over that in order.
export type Drawing = {
  readonly width: number;
  readonly height: number;
  readonly background?: Paint | undefined;
  readonly primitives: readonly Primitive[];
};

// A rectangle in panel coordinates, which is how a HUD hands a sub-area to a part of itself.
export type PanelBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

// A line primitive.
export const line = (from: Vec2, to: Vec2, stroke: Paint, width?: number): LinePrimitive => ({
  kind: 'line',
  from,
  to,
  stroke,
  width,
});

// How a polygon is painted; giving neither a fill nor a stroke draws nothing.
export type PolygonPaint = {
  readonly fill?: Paint | undefined;
  readonly stroke?: Paint | undefined;
  readonly width?: number | undefined;
};

// A polygon primitive.
export const polygon = (points: readonly Vec2[], paint: PolygonPaint): PolygonPrimitive => ({
  kind: 'polygon',
  points,
  fill: paint.fill,
  stroke: paint.stroke,
  width: paint.width,
});

// How a run of text is set.
export type TextStyle = {
  readonly size?: number | undefined;
  readonly align?: 'left' | 'center' | 'right' | undefined;
};

// A text primitive.
export const text = (at: Vec2, value: string, fill: Paint, style: TextStyle = {}): TextPrimitive => ({
  kind: 'text',
  at,
  text: value,
  fill,
  size: style.size,
  align: style.align,
});

// The four corners of a box, clockwise from its top left in panel coordinates.
export const boxCorners = (box: PanelBox): readonly Vec2[] => [
  [box.x, box.y],
  [box.x + box.width, box.y],
  [box.x + box.width, box.y + box.height],
  [box.x, box.y + box.height],
];

// The colours the three HUDs share, so the panels read as one set rather than three.
export const hudPalette = {
  panel: 'rgba(24, 26, 31, 0.82)',
  border: 'rgba(214, 210, 198, 0.35)',
  text: '#f2efe6',
  dim: '#9c9a93',
  good: '#7ec98f',
  bad: '#e0674a',
  accent: '#d1461f',
  trace: '#6fb3d6',
} as const;

// The type size a text primitive uses when it does not ask for one.
export const defaultTextSize = 11;

// The face every HUD sets its text in: the numbers line up column by column.
export const hudFontFamily = 'ui-monospace, "Cascadia Mono", "Consolas", monospace';

const paintPrimitive = (context: CanvasRenderingContext2D, item: Primitive): void => {
  if (item.kind === 'line') {
    context.beginPath();
    context.moveTo(item.from[0], item.from[1]);
    context.lineTo(item.to[0], item.to[1]);
    context.strokeStyle = item.stroke;
    context.lineWidth = item.width ?? 1;
    context.stroke();
    return;
  }
  if (item.kind === 'polygon') {
    const first = item.points[0];
    if (first === undefined) return;
    context.beginPath();
    context.moveTo(first[0], first[1]);
    for (const point of item.points.slice(1)) context.lineTo(point[0], point[1]);
    context.closePath();
    if (item.fill !== undefined) {
      context.fillStyle = item.fill;
      context.fill();
    }
    if (item.stroke !== undefined) {
      context.strokeStyle = item.stroke;
      context.lineWidth = item.width ?? 1;
      context.stroke();
    }
    return;
  }
  context.font = `${item.size ?? defaultTextSize}px ${hudFontFamily}`;
  context.textAlign = item.align ?? 'left';
  context.fillStyle = item.fill;
  context.fillText(item.text, item.at[0], item.at[1]);
};

// Paints a drawing over a cleared panel. Nothing here decides what a HUD looks like.
export const paintDrawing = (context: CanvasRenderingContext2D, drawing: Drawing): void => {
  context.clearRect(0, 0, drawing.width, drawing.height);
  if (drawing.background !== undefined) {
    context.fillStyle = drawing.background;
    context.fillRect(0, 0, drawing.width, drawing.height);
  }
  context.textBaseline = 'alphabetic';
  for (const item of drawing.primitives) paintPrimitive(context, item);
};
