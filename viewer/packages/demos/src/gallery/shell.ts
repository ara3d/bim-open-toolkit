// The frame both pages sit in: a 48 px bar and the area under it.
//
// The shell owns exactly two things - the theme and the text size - because they belong to the
// person rather than to the page. Everything else in the bar is filled in by whichever page is
// showing, through `lead` and `trail`.

import { button, clear, el } from './elements.js';
import { applyChrome, readChrome, storeChrome, withBigText, withTheme, type ChromeSettings } from './theme.js';
import type { ThemeApplier } from '@bim-open-toolkit/ui-gratify';

// The frame: where a page puts its own chrome, where it draws, and what the person chose.
export type Shell = {
  // The left of the bar: a breadcrumb, or the gallery's name on the index.
  readonly lead: HTMLElement;
  // The right of the bar, before the theme controls: a source link, a verification command.
  readonly trail: HTMLElement;
  // Everything under the bar.
  readonly main: HTMLElement;
  readonly settings: () => ChromeSettings;
  // Empties `lead`, `trail` and `main`, for a page about to draw itself.
  readonly reset: () => void;
};

// Builds the frame inside `root` and applies the remembered theme and text size at once, so the
// page never paints in the wrong one first.
export const mountShell = (root: HTMLElement, applier?: ThemeApplier): Shell => {
  let settings = readChrome();
  applyChrome(settings, document.documentElement, applier);

  const bar = el('header', 'gallery-bar');
  const lead = el('div', 'bar-lead');
  const trail = el('div', 'bar-trail');
  const chrome = el('div', 'bar-chrome');
  const main = el('main', 'gallery-main');

  const themeButton = button('bar-button', '', () => {
    change(withTheme(settings, settings.theme === 'dark' ? 'light' : 'dark'));
  });
  const textButton = button('bar-button', '', () => {
    change(withBigText(settings, !settings.big));
  });
  const describe = (): void => {
    themeButton.textContent = settings.theme === 'dark' ? 'Light theme' : 'Dark theme';
    themeButton.setAttribute('aria-pressed', settings.theme === 'dark' ? 'true' : 'false');
    textButton.textContent = settings.big ? 'Normal text' : 'Bigger text';
    textButton.setAttribute('aria-pressed', settings.big ? 'true' : 'false');
  };
  const change = (next: ChromeSettings): void => {
    settings = next;
    applyChrome(settings, document.documentElement, applier);
    storeChrome(settings);
    describe();
  };
  describe();

  chrome.append(themeButton, textButton);
  bar.append(lead, trail, chrome);
  root.append(bar, main);

  return {
    lead,
    trail,
    main,
    settings: () => settings,
    reset: () => {
      clear(lead);
      clear(trail);
      clear(main);
    },
  };
};
