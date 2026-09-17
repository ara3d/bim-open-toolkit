import { Focusable, part, v, type Intentish } from 'gratify';
import { controlHeight, spaceOf } from '../theme.js';
import { controlText, cornerRadius, focusRing, paintFocus, tonedSurface, type Tone } from './common.js';

export type ButtonProps = {
  readonly label: string;
  // What a click emits. The panel's `update` decides what it means.
  readonly press: Intentish;
  readonly tone?: Tone;
  // A minimum width, so a row of buttons can be made even.
  readonly width?: number;
  readonly enabled?: boolean;
};

const buttonDefaults: { tone: Tone; width: number; enabled: boolean } = { tone: 'plain', width: 0, enabled: true };

// A labelled control that emits one intent when pressed, by pointer or by keyboard focus and Enter.
export const Button = part('gallery-button')
  .props<ButtonProps>()
  .defaults(buttonDefaults)
  .size((props, measure) =>
    v(Math.max(props.width, measure.text(props.label, controlText()).x + spaceOf(24)), controlHeight()))
  .style((tokens, channels, props) => ({
    ...tonedSurface(tokens, channels, props.tone, props.enabled ? 1 : 0.2),
    corner: cornerRadius(),
    lift: props.enabled ? 2 * channels.hover - 2 * channels.press : 0,
    ring: focusRing(tokens, channels),
    size: controlText(),
    faded: props.enabled ? 1 : 0.55,
  }))
  .render((node, painter, style) => {
    const box = node.rect.raise(style.lift);
    painter.push();
    painter.alpha(style.faded);
    painter.box(box, style.corner, style.fill, style.edge, 1);
    painter.label(node.props.label, box.center, style.text, { size: style.size, weight: 500 });
    painter.pop();
    paintFocus(painter, box, style.ring);
  })
  .on(Focusable())
  .press((node) => (node.props.enabled ? node.props.press : undefined))
  .semantics((node) => ({ role: 'button', label: node.props.label, value: node.props.enabled }));
