// The gallery's look on the Gratify side of the page (GALLERY-PLAN.md section 3). The same values
// live in the gallery's CSS; these are the ones every canvas widget reads. Gratify has no size or
// spacing token, so the text scale is kept here and every widget in this package measures through
// `fontSize` and `spaceOf` rather than writing pixel literals.
import { rgb, setTheme, themes, type Color, type Tokens } from 'gratify';
import type { GalleryTheme } from './contracts.js';

// The ten values a Gratify theme is made of, without the `mix` function the runtime supplies.
export type GalleryPalette = Omit<Tokens, 'mix'>;

// A colour written as one hexadecimal literal, so the palette below reads like the plan's table.
const hex = (value: number, alpha = 1): Color =>
  rgb((value >> 16) & 255, (value >> 8) & 255, value & 255, alpha);

// A panel canvas sits over the viewport, so its background is nothing at all: every widget paints
// its own surface. `bg` is the only token whose alpha matters.
const clear: Color = rgb(0, 0, 0, 0);

const lightPalette: GalleryPalette = {
  bg: clear,
  surface: hex(0xfbfaf7),
  surfaceHi: hex(0xf4f1ea),
  muted: hex(0xd9d4c8),
  text: hex(0x17181c),
  textDim: hex(0x6b6a66),
  textBright: hex(0x08090b),
  accent: hex(0xd1461f),
  accent2: hex(0x1f5bd1),
  danger: hex(0xb3261e),
};

const darkPalette: GalleryPalette = {
  bg: clear,
  surface: hex(0x1c1e24),
  surfaceHi: hex(0x262932),
  muted: hex(0x2c2f37),
  text: hex(0xebe8e0),
  textDim: hex(0x9a978f),
  textBright: hex(0xfaf8f3),
  accent: hex(0xe8623a),
  accent2: hex(0x6b93ff),
  danger: hex(0xff6b6b),
};

// The palette a theme name stands for. Every colour is copied, because Gratify's theme table holds
// the palette it is given and a caller must not be able to edit the gallery's colours through it.
export const galleryPalette = (theme: GalleryTheme): GalleryPalette => {
  const source = theme === 'dark' ? darkPalette : lightPalette;
  const copy = (c: Color): Color => rgb(c.r, c.g, c.b, c.a);
  return {
    bg: copy(source.bg),
    surface: copy(source.surface),
    surfaceHi: copy(source.surfaceHi),
    muted: copy(source.muted),
    text: copy(source.text),
    textDim: copy(source.textDim),
    textBright: copy(source.textBright),
    accent: copy(source.accent),
    accent2: copy(source.accent2),
    danger: copy(source.danger),
  };
};

// The name the palette is registered under in Gratify's theme table.
export const galleryThemeName = (theme: GalleryTheme): string => `gallery-${theme}`;

// The type scale of section 3, in pixels at scale 1.
export const galleryTypeScale = { small: 13, body: 15, subhead: 18, title: 24, display: 34 } as const;

// One step of the type scale.
export type TypeStep = keyof typeof galleryTypeScale;

// Big-text mode multiplies every size by this. Between 0.75 and 2 so a panel can still be laid out.
let scale = 1;

// The text scale in force. Nothing outside this module keeps a copy, so a theme change is one call.
export const textScale = (): number => scale;

// A step of the type scale at the current text scale.
export const fontSize = (step: TypeStep): number => Math.round(galleryTypeScale[step] * scale);

// A padding, gap or control dimension at the current text scale.
export const spaceOf = (pixels: number): number => Math.round(pixels * scale);

// The height every one-line control shares, so a row of them lines up.
export const controlHeight = (): number => spaceOf(30);

// Applies a theme and text scale to every Gratify surface at once. Analytical colours (coverage
// states, change kinds, heat maps) are not theme tokens and are untouched by this call.
export const applyGalleryTheme = (theme: GalleryTheme, newScale: number): void => {
  scale = Math.min(2, Math.max(0.75, Number.isFinite(newScale) ? newScale : 1));
  const name = galleryThemeName(theme);
  themes[name] = galleryPalette(theme);
  setTheme(name);
};
