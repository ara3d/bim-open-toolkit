import { describe, expect, it } from 'vitest';
import { applyAppearance, defaultAppearance } from '../src/style.js';

describe('style appearance', () => {
  it('starts visible and opaque', () => {
    expect(defaultAppearance.visible).toBe(true);
    expect(defaultAppearance.opacity).toBe(1);
  });

  it('leaves absent properties alone', () => {
    expect(applyAppearance(defaultAppearance, {})).toEqual(defaultAppearance);
    expect(applyAppearance(defaultAppearance, { opacity: 0.2 })).toEqual({
      ...defaultAppearance,
      opacity: 0.2,
    });
  });

  it('applies every stated property', () => {
    expect(applyAppearance(defaultAppearance, { color: [1, 0, 0], visible: false, opacity: 0.5 })).toEqual({
      color: [1, 0, 0],
      opacity: 0.5,
      visible: false,
    });
  });
});
