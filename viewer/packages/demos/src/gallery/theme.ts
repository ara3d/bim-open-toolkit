// Theme and text size: two settings, one attribute each, remembered between visits.
//
// The DOM chrome reads them as `data-theme` and `data-text` on the root element, which is what the
// custom properties in `styles/tokens.css` key off. The Gratify surfaces read them through the
// `ThemeApplier` `ui-gratify` publishes; until that lands the applier is simply absent, and the
// canvas panels keep Gratify's own theme. Nothing else in the gallery reads either setting.

import type { GalleryTheme, ThemeApplier } from '@bim-open-toolkit/ui-gratify';
import { analyticalColors } from './analytical.js';

// How the chrome looks. `big` multiplies the whole type scale by `bigTextScale`.
export type ChromeSettings = { readonly theme: GalleryTheme; readonly big: boolean };

export const defaultChrome: ChromeSettings = { theme: 'light', big: false };

// What big-text mode multiplies the root size by. `styles/tokens.css` holds the same number.
export const bigTextScale = 1.25;

const storageKey = 'bim-open-toolkit/gallery/chrome';

// The theme the machine asks for, when nobody has chosen one.
export const preferredTheme = (): GalleryTheme =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

// Reads a stored setting. Anything stored that is not one is the preference instead, so a bad or
// stale value never leaves the page unstyled.
export const chromeFrom = (stored: string | null, preferred: GalleryTheme): ChromeSettings => {
  if (stored === null) return { theme: preferred, big: false };
  const parsed: unknown = safeParse(stored);
  if (typeof parsed !== 'object' || parsed === null) return { theme: preferred, big: false };
  const theme: unknown = 'theme' in parsed ? parsed.theme : undefined;
  const big: unknown = 'big' in parsed ? parsed.big : undefined;
  return {
    theme: theme === 'dark' || theme === 'light' ? theme : preferred,
    big: big === true,
  };
};

const safeParse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

// What was last chosen here, or what the machine prefers.
export const readChrome = (): ChromeSettings => {
  try {
    return chromeFrom(window.localStorage.getItem(storageKey), preferredTheme());
  } catch {
    // Storage can be refused outright in a private window; the preference still works.
    return { theme: preferredTheme(), big: false };
  }
};

export const storeChrome = (settings: ChromeSettings): void => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    // A setting that cannot be remembered still applies to this page.
  }
};

// Puts the settings on the document and, when one was given, on every Gratify surface.
//
// Analytical colours are not touched: they are fixed values in `analytical.ts`, not properties on
// this element, so there is nothing here that could change one.
export const applyChrome = (
  settings: ChromeSettings,
  root: HTMLElement,
  applier?: ThemeApplier,
): Readonly<Record<string, string>> => {
  root.dataset['theme'] = settings.theme;
  root.dataset['text'] = settings.big ? 'big' : 'normal';
  applier?.(settings.theme, settings.big ? bigTextScale : 1);
  return analyticalColors;
};

export const withTheme = (settings: ChromeSettings, theme: GalleryTheme): ChromeSettings => ({ ...settings, theme });

export const withBigText = (settings: ChromeSettings, big: boolean): ChromeSettings => ({ ...settings, big });
