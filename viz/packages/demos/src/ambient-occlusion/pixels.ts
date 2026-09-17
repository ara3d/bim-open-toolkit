// What a drawn frame comes to, as numbers a test can assert. Pure.
//
// The one honest check on a screen-space pass without a reference renderer is that it darkens the
// picture and that the occlusion term varies across it: open surfaces stay white and enclosed ones
// go dark. Both are questions about the luminance of the drawing buffer.

// Luminance statistics of an image, each between 0 and 1.
export type LuminanceStatistics = {
  readonly pixels: number;
  readonly mean: number;
  readonly min: number;
  readonly max: number;
  // The share of pixels darker than a quarter.
  readonly darkShare: number;
};

// The luminance of one pixel's red, green and blue, as a fraction of white.
export const luminanceOf = (red: number, green: number, blue: number): number =>
  (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

// Statistics over an RGBA byte buffer, which is what `readPixels` fills. Alpha is ignored. An
// empty buffer has no pixels and every statistic zero.
export const luminanceStatistics = (rgba: Uint8Array): LuminanceStatistics => {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return { pixels: 0, mean: 0, min: 0, max: 0, darkShare: 0 };
  let total = 0;
  let least = 1;
  let most = 0;
  let dark = 0;
  for (let p = 0; p < pixels; p++) {
    const value = luminanceOf(rgba[p * 4] ?? 0, rgba[p * 4 + 1] ?? 0, rgba[p * 4 + 2] ?? 0);
    total += value;
    least = Math.min(least, value);
    most = Math.max(most, value);
    if (value < 0.25) dark++;
  }
  return { pixels, mean: total / pixels, min: least, max: most, darkShare: dark / pixels };
};
