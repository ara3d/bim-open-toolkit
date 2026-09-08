// Byte-range request parsing, per RFC 9110 section 14. Pure.

// An inclusive byte range within a file.
export type ByteRange = { readonly start: number; readonly end: number };

// What to serve for a Range header: the whole file, one range, or a refusal.
export type RangeOutcome =
  | { readonly kind: 'whole' }
  | { readonly kind: 'partial'; readonly range: ByteRange }
  | { readonly kind: 'unsatisfiable' };

// Only a single range is supported; a header naming several ranges fails this pattern and is ignored.
const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/;

const WHOLE: RangeOutcome = { kind: 'whole' };
const UNSATISFIABLE: RangeOutcome = { kind: 'unsatisfiable' };

const partial = (start: number, end: number): RangeOutcome => ({ kind: 'partial', range: { start, end } });

// The last `suffix` bytes of a file.
const suffixRange = (suffix: number, size: number): RangeOutcome =>
  suffix === 0 || size === 0 ? UNSATISFIABLE : partial(Math.max(0, size - suffix), size - 1);

// Decides what a Range header asks for. A header that cannot be understood is ignored and the whole
// file is served, which RFC 9110 permits; a range that starts past the end is unsatisfiable.
export const parseByteRange = (header: string | null, size: number): RangeOutcome => {
  if (header === null) return WHOLE;
  const match = SINGLE_RANGE.exec(header.trim());
  const firstText = match?.[1];
  const lastText = match?.[2];
  if (firstText === undefined || lastText === undefined) return WHOLE;
  if (firstText === '') return lastText === '' ? WHOLE : suffixRange(Number.parseInt(lastText, 10), size);
  const start = Number.parseInt(firstText, 10);
  if (start >= size) return UNSATISFIABLE;
  if (lastText === '') return partial(start, size - 1);
  const last = Number.parseInt(lastText, 10);
  return last < start ? WHOLE : partial(start, Math.min(last, size - 1));
};
