// What this demo asks the capture feature for, and what it can read back out of the slice.
//
// Every size is stated in pixels rather than offered as "the size of the viewport", because a
// stored record has to say how big the picture is and the viewport's size is not something this
// demo is told. A capture the demo cannot describe is not one it offers.

import { thumbnailOf, type CaptureRecord, type CaptureState } from '@bim-open-toolkit/features';

export type CaptureSizeName = 'report' | 'slide' | 'thumbnail';

// The sizes offered, in the order the row lists them.
export const captureSizeNames: readonly CaptureSizeName[] = ['report', 'slide', 'thumbnail'];

// The size the demo opens on and takes its opening picture at: the one the question asks for.
export const openingSize: CaptureSizeName = 'report';

// How big each one is, in pixels.
export const captureSizes: Readonly<Record<CaptureSizeName, { readonly width: number; readonly height: number }>> = {
  report: { width: 1600, height: 1000 },
  slide: { width: 1280, height: 800 },
  thumbnail: { width: 480, height: 300 },
};

// What each size is for, shown on the button and in the sheet.
export const captureSizeTitles: Readonly<Record<CaptureSizeName, string>> = {
  report: 'Report 1600×1000',
  slide: 'Slide 1280×800',
  thumbnail: 'Thumbnail 480×300',
};

// The key this demo's picture is stored under in the capture slice.
export const captureViewKey = 'gallery.capture-demo';

// The input for `capture.image` at one of the offered sizes.
export const captureRequestFor = (size: CaptureSizeName): Record<string, unknown> => ({
  viewId: captureViewKey,
  width: captureSizes[size].width,
  height: captureSizes[size].height,
});

// The picture this demo last took, or undefined when it has taken none.
export const lastCapture = (state: CaptureState): CaptureRecord | undefined => thumbnailOf(state, captureViewKey);

// How many bytes a base64 data URL carries. Counted from the text rather than decoded, because the
// number is for a reader and decoding a megabyte to measure it would be work for nothing.
export const dataUrlBytes = (dataUrl: string): number => {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const body = dataUrl.slice(comma + 1);
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
};

// The size name a stored record was taken at, or undefined when it matches none of them.
export const sizeOfRecord = (record: CaptureRecord): CaptureSizeName | undefined =>
  captureSizeNames.find(
    (name) => captureSizes[name].width === record.width && captureSizes[name].height === record.height,
  );
