// The parts one inspector line can be. Each is exactly one row high and knows its own width, which
// is what lets the list place them by arithmetic instead of by layout.
import { at, calpha, part, rect as makeRect, v, type Element, type Intentish } from 'gratify';
import type { ValueState } from '../contracts.js';
import { coverageColour, coverageLabel } from '../coverage.js';
import { fontSize, spaceOf } from '../theme.js';
import { paintPill, pillWidth } from '../widgets/common.js';
import { Tip } from '../widgets/tip.js';
import { formatCell, tableColumns, valueStory, type SheetLine } from './lines.js';
import type { PropertyRow, SheetTable } from '../contracts.js';

// One inspector line's height at the current text scale.
export const lineHeight = (): number => spaceOf(26);

// How tall the opaque sheet header is: title, subtitle and the coverage badges.
export const headHeight = (subtitle: string | undefined): number => spaceOf(subtitle === undefined ? 52 : 70);

// The left edge and width of each of `count` equal columns inside a line.
export const columnBounds = (width: number, count: number): readonly { readonly x: number; readonly w: number }[] => {
  if (count <= 0) return [];
  const pad = spaceOf(12);
  const inner = Math.max(count * spaceOf(40), width - 2 * pad);
  const each = inner / count;
  return Array.from({ length: count }, (_unused, index) => ({ x: pad + index * each, w: each }));
};

type LineProps = { readonly width: number };

// A group or table title: the only line that is not a value.
export const TitleLine = part('inspector-title')
  .props<LineProps & { readonly title: string }>()
  .size((props) => v(props.width, lineHeight()))
  .style((tokens) => ({ text: tokens.textDim, rule: calpha(tokens.muted, 0.9), size: fontSize('small') }))
  .render((node, painter, style) => {
    const r = node.rect;
    painter.label(node.props.title.toUpperCase(), v(r.x + spaceOf(12), r.center.y + spaceOf(3)), style.text, {
      size: style.size - 1,
      align: 'left',
      weight: 700,
    });
    painter.line(v(r.x + spaceOf(12), r.bottom - 1), v(r.right - spaceOf(12), r.bottom - 1), style.rule, 1);
  })
  .semantics((node) => ({ role: 'heading', label: node.props.title }));

export type RowLineProps = LineProps & {
  readonly row: PropertyRow;
  // True while the row's story is already shown below it, so the hover tip stays out of the way.
  readonly open: boolean;
  readonly focused: boolean;
  // What a click emits: the row's own action, or the intent that opens its story. Nothing when the
  // row has neither, so a plain value is not a control.
  readonly press?: Intentish | undefined;
};

const badgeOf = (state: ValueState): string => coverageLabel[state];

// One label and value, with a badge when the value is not simply known.
export const RowLine = part('inspector-row')
  .props<RowLineProps>()
  .size((props) => v(props.width, lineHeight()))
  .style((tokens, channels, props) => ({
    hover: tokens.mix(calpha(tokens.surfaceHi, 0), calpha(tokens.surfaceHi, 1), channels.hover),
    label: tokens.textDim,
    value: props.row.value.state === 'known' ? tokens.text : tokens.textDim,
    link: tokens.accent2,
    size: fontSize('small'),
    focus: props.focused ? 1 : 0,
    actionable: props.press === undefined ? 0 : 1,
  }))
  .render((node, painter, style) => {
    const r = node.rect;
    const props = node.props;
    const value = props.row.value;
    painter.box(r, 0, style.hover);
    painter.label(props.row.label, v(r.x + spaceOf(12), r.center.y), style.label, { size: style.size, align: 'left' });
    const badge = badgeOf(value.state);
    let right = r.right - spaceOf(12);
    if (badge !== '') {
      const width = pillWidth(painter.measure, badge, style.size - 2);
      const box = makeRect(right - width, r.center.y - spaceOf(8), width, spaceOf(17));
      paintPill(painter, box, coverageColour[value.state], badge, style.size - 2);
      right = box.x - spaceOf(8);
    }
    const text = value.unit === undefined || value.text === '' ? value.text : `${value.text} ${value.unit}`;
    if (text !== '') {
      painter.label(text, v(right, r.center.y), style.actionable > 0 ? style.link : style.value, {
        size: style.size,
        align: 'right',
        mono: value.kind === 'number',
      });
    }
    if (style.focus > 0.02) painter.box(r.inset(1), 3, calpha(style.link, 0), calpha(style.link, style.focus), 1.5);
  })
  .adorn((node) => {
    const story = valueStory(node.props.row.value);
    if (story.length === 0 || node.ch.hover < 0.6 || node.props.open) return [];
    return [at(Tip('why', { lines: story }), v(node.rect.x + spaceOf(12), node.rect.bottom))];
  })
  .semantics((node) => ({
    role: node.props.press === undefined ? 'text' : 'button',
    label: node.props.row.label,
    value: `${node.props.row.value.text}${node.props.row.value.state === 'known' ? '' : ` (${node.props.row.value.state})`}`,
  }));

// A line of the story behind a value: why it is missing, or what each source said.
export const EvidenceLine = part('inspector-evidence')
  .props<LineProps & { readonly text: string }>()
  .size((props) => v(props.width, lineHeight()))
  .style((tokens) => ({ text: tokens.textDim, mark: tokens.accent, size: fontSize('small') }))
  .render((node, painter, style) => {
    const r = node.rect;
    painter.dot(v(r.x + spaceOf(20), r.center.y), 2, style.mark);
    painter.label(node.props.text, v(r.x + spaceOf(28), r.center.y), style.text, { size: style.size - 1, align: 'left' });
  })
  .semantics((node) => ({ role: 'note', label: node.props.text }));

// The column names of a sheet table.
export const ColumnsLine = part('inspector-columns')
  .props<LineProps & { readonly table: SheetTable }>()
  .size((props) => v(props.width, lineHeight()))
  .style((tokens) => ({ text: tokens.textDim, rule: tokens.muted, size: fontSize('small') - 1 }))
  .render((node, painter, style) => {
    const r = node.rect;
    const names = tableColumns(node.props.table);
    columnBounds(r.w, names.length).forEach((bound, index) => {
      painter.label(names[index] ?? '', v(r.x + bound.x, r.center.y), style.text, {
        size: style.size,
        align: 'left',
        weight: 700,
      });
    });
    painter.line(v(r.x + spaceOf(12), r.bottom - 1), v(r.right - spaceOf(12), r.bottom - 1), style.rule, 1);
  });

// One row of a sheet table. Clicking it runs the table's row action, when it has one.
export const CellsLine = part('inspector-cells')
  .props<LineProps & { readonly table: SheetTable; readonly row: number; readonly press?: Intentish }>()
  .size((props) => v(props.width, lineHeight()))
  .style((tokens, channels, props) => ({
    hover: tokens.mix(calpha(tokens.surfaceHi, 0), calpha(tokens.surfaceHi, 1), channels.hover),
    text: props.press === undefined ? tokens.text : tokens.mix(tokens.text, tokens.accent2, 0.35 + 0.65 * channels.hover),
    size: fontSize('small'),
  }))
  .render((node, painter, style) => {
    const r = node.rect;
    const table = node.props.table;
    const names = tableColumns(table);
    painter.box(r, 0, style.hover);
    columnBounds(r.w, names.length).forEach((bound, index) => {
      const name = names[index] ?? '';
      painter.label(formatCell(table.table, name, node.props.row), v(r.x + bound.x, r.center.y), style.text, {
        size: style.size,
        align: 'left',
        mono: true,
      });
    });
  })
  .semantics((node) => ({
    role: node.props.press === undefined ? 'row' : 'button',
    label: tableColumns(node.props.table)
      .map((name) => formatCell(node.props.table.table, name, node.props.row))
      .join(', '),
  }));

export type SheetHeadProps = {
  readonly width: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly counts: Readonly<Record<ValueState, number>>;
};

// The opaque header. It is drawn after the list, which is how the inspector scrolls without a clip:
// whatever scrolled above the first line disappears under this.
export const SheetHead = part('inspector-head')
  .props<SheetHeadProps>()
  .size((props) => v(props.width, headHeight(props.subtitle)))
  .style((tokens) => ({
    fill: tokens.mix(tokens.surface, tokens.surface, 1),
    rule: tokens.muted,
    title: tokens.textBright,
    subtitle: tokens.textDim,
    size: fontSize('small'),
    titleSize: fontSize('subhead'),
  }))
  .render((node, painter, style) => {
    const r = node.rect;
    const props = node.props;
    painter.box(r, 0, style.fill);
    painter.label(props.title, v(r.x + spaceOf(12), r.y + spaceOf(20)), style.title, {
      size: style.titleSize,
      align: 'left',
      weight: 600,
    });
    if (props.subtitle !== undefined) {
      painter.label(props.subtitle, v(r.x + spaceOf(12), r.y + spaceOf(40)), style.subtitle, {
        size: style.size,
        align: 'left',
      });
    }
    let x = r.x + spaceOf(12);
    const y = r.bottom - spaceOf(20);
    for (const state of ['missing', 'conflicting'] as const) {
      const count = props.counts[state];
      if (count === 0) continue;
      const text = `${count} ${coverageLabel[state]}`;
      const width = pillWidth(painter.measure, text, style.size - 2);
      paintPill(painter, makeRect(x, y, width, spaceOf(17)), coverageColour[state], text, style.size - 2);
      x += width + spaceOf(6);
    }
    painter.line(v(r.x, r.bottom - 0.5), v(r.right, r.bottom - 0.5), style.rule, 1);
  })
  .semantics((node) => ({ role: 'heading', label: node.props.title, value: node.props.subtitle ?? '' }));

// The element one line becomes, with the intent a click on it should emit.
export const lineElement = (
  line: SheetLine,
  width: number,
  press: Intentish | undefined,
  focused: boolean,
): Element => {
  switch (line.kind) {
    case 'group':
    case 'table':
      return TitleLine(line.key, { width, title: line.title });
    case 'row':
      return RowLine(line.key, { width, row: line.row, open: line.open, focused, press });
    case 'evidence':
      return EvidenceLine(line.key, { width, text: line.text });
    case 'columns':
      return ColumnsLine(line.key, { width, table: line.table });
    case 'cells':
      return CellsLine(line.key, { width, table: line.table, row: line.row, press });
  }
};
