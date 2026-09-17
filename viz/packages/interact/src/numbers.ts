// The value moved into the range. A range whose low end exceeds its high end yields the high end.
// A value that is not a number yields the low end, so a bad input cannot poison a clamped state.
export const clamp = (value: number, low: number, high: number): number =>
  Number.isNaN(value) ? low : Math.min(high, Math.max(low, value));

// The value when it is a finite number, otherwise the fallback. Input devices report NaN and
// Infinity often enough that every value entering camera state passes through here first.
export const finite = (value: number, fallback = 0): number => (Number.isFinite(value) ? value : fallback);
