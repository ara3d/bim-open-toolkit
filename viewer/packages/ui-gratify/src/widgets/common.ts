// What every widget in the kit shares: the three emphases a control can carry, the surface blend
// they resolve to, and the few painting idioms that would otherwise be copied thirteen times.
import { calpha, surface, type Channels, type Color, type Painter, type Rect, type SurfaceStyle, type Tokens } from 'gratify';
import { fontSize, spaceOf } from '../theme.js';

// How much a control wants to be noticed. `plain` is the default chrome; `accent` is the one warm
// colour of the gallery; `danger` is reserved for a destructive or failing state.
export type Tone = 'plain' | 'accent' | 'danger';

// The token a tone tints its surface with, or nothing for plain chrome.
export const tintOf = (tokens: Tokens, tone: Tone): Color | undefined =>
  tone === 'accent' ? tokens.accent : tone === 'danger' ? tokens.danger : undefined;

// The house surface blend for a tone. `strength` flattens the whole emphasis, which is how a
// disabled control stops reacting to the pointer without changing shape.
export const tonedSurface = (tokens: Tokens, channels: Channels, tone: Tone, strength = 1): SurfaceStyle => {
  const tint = tintOf(tokens, tone);
  return tint === undefined ? surface(tokens, channels, { strength }) : surface(tokens, channels, { tint, strength });
};

// The corner radius every rounded control shares, at the current text scale.
export const cornerRadius = (): number => spaceOf(7);

// The colour of the ring around whatever holds the keyboard focus.
export const focusRing = (tokens: Tokens, channels: Channels): Color => calpha(tokens.accent2, channels.focus ?? 0);

// Draws the focus ring just outside a control, and nothing at all when it is not focused.
export const paintFocus = (painter: Painter, rect: Rect, ring: Color): void => {
  if (ring.a > 0.02) painter.box(rect.inset(-2), cornerRadius() + 2, calpha(ring, 0), ring, 1.5);
};

// The label size a compact control uses.
export const controlText = (): number => fontSize('small');
