import { describe, expect, it } from 'vitest';
import { hexOf, themeName, themes } from 'gratify';
import {
  applyGalleryTheme,
  controlHeight,
  fontSize,
  galleryPalette,
  galleryThemeName,
  textScale,
} from '../src/index.js';

describe('gallery theme', () => {
  it('carries the palette of the plan, with a transparent canvas so a panel shows the viewport', () => {
    const light = galleryPalette('light');
    expect([hexOf(light.surface), hexOf(light.text), hexOf(light.muted), hexOf(light.accent), hexOf(light.accent2)])
      .toEqual(['#fbfaf7', '#17181c', '#d9d4c8', '#d1461f', '#1f5bd1']);
    const dark = galleryPalette('dark');
    expect([hexOf(dark.surface), hexOf(dark.text), hexOf(dark.accent)]).toEqual(['#1c1e24', '#ebe8e0', '#e8623a']);
    expect([light.bg.a, dark.bg.a]).toEqual([0, 0]);
  });

  it('hands out a copy, so nothing a caller does can change the gallery colours', () => {
    const first = galleryPalette('light');
    first.accent.r = 0;
    expect(hexOf(galleryPalette('light').accent)).toBe('#d1461f');
  });

  it('registers the palette with Gratify and makes it the active theme', () => {
    applyGalleryTheme('dark', 1);
    expect(themeName).toBe(galleryThemeName('dark'));
    expect(hexOf(themes[galleryThemeName('dark')]?.surface ?? galleryPalette('light').bg)).toBe('#1c1e24');
  });

  it('scales the type and control sizes, and refuses a scale a panel could not be laid out at', () => {
    applyGalleryTheme('light', 1);
    expect([fontSize('small'), fontSize('body'), fontSize('display'), controlHeight()]).toEqual([13, 15, 34, 30]);
    applyGalleryTheme('light', 1.25);
    expect([textScale(), fontSize('small'), fontSize('body'), controlHeight()]).toEqual([1.25, 16, 19, 38]);
    applyGalleryTheme('light', 40);
    expect(textScale()).toBe(2);
    applyGalleryTheme('light', Number.NaN);
    expect(textScale()).toBe(1);
  });
});
