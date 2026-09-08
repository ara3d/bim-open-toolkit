import { part, v, type Color } from 'gratify';
import { fontSize, spaceOf } from '../theme.js';
import { paintPill, pillWidth } from './common.js';

export type BadgeProps = {
  readonly text: string;
  // Given by the caller, never taken from a theme token: a badge that means something analytical
  // must keep its colour when the chrome changes.
  readonly colour: Color;
};

// A small pill of coloured text: how many values are missing, what state a row is in.
export const Badge = part('gallery-badge')
  .props<BadgeProps>()
  .size((props, measure) => v(pillWidth(measure, props.text, fontSize('small') - 2), spaceOf(17)))
  .style((_tokens, _channels, props) => ({ colour: props.colour, size: fontSize('small') - 2 }))
  .render((node, painter, style) => paintPill(painter, node.rect, style.colour, node.props.text, style.size))
  .semantics((node) => ({ role: 'status', label: node.props.text }));
