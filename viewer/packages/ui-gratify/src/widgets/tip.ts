import { calpha, part, v } from 'gratify';
import { fontSize, spaceOf } from '../theme.js';
import { cornerRadius } from './common.js';

export type TipProps = {
  // One line each; Gratify's painter has no wrapping, so the caller decides where the lines break.
  readonly lines: readonly string[];
};

// An opaque note that appears beside whatever it explains: why a value is missing, what disagreed.
export const Tip = part('gallery-tip')
  .props<TipProps>()
  .size((props, measure) => {
    const size = fontSize('small');
    const wide = props.lines.reduce((most, line) => Math.max(most, measure.text(line, size).x), 0);
    return v(wide + spaceOf(18), props.lines.length * spaceOf(17) + spaceOf(12));
  })
  .style((tokens) => ({
    fill: tokens.mix(tokens.surface, tokens.surfaceHi, 1),
    edge: calpha(tokens.accent, 0.45),
    text: tokens.text,
    size: fontSize('small'),
  }))
  .render((node, painter, style) => {
    painter.box(node.rect, cornerRadius(), style.fill, style.edge, 1);
    node.props.lines.forEach((line, index) => {
      painter.label(line, v(node.rect.x + spaceOf(9), node.rect.y + spaceOf(15) + index * spaceOf(17)), style.text, {
        size: style.size,
        align: 'left',
      });
    });
  });
