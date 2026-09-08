import type { Color } from './math.js';

// How an object looks. Opacity is 0 (invisible) to 1 (opaque); `visible` false removes it entirely.
export type Appearance = {
  readonly color: Color;
  readonly opacity: number;
  readonly visible: boolean;
};

// A change to an appearance. Absent properties are left as they were.
export type AppearanceChange = {
  readonly color?: Color | undefined;
  readonly opacity?: number | undefined;
  readonly visible?: boolean | undefined;
};

// The appearance an object has when nothing has styled it.
export const defaultAppearance: Appearance = { color: [0.8, 0.8, 0.8], opacity: 1, visible: true };

// An appearance with a change applied over it.
export const applyAppearance = (base: Appearance, change: AppearanceChange): Appearance => ({
  color: change.color ?? base.color,
  opacity: change.opacity ?? base.opacity,
  visible: change.visible ?? base.visible,
});
