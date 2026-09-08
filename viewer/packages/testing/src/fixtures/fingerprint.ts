// A cheap content hash, so a test can say "this fixture is the one I wrote the expected numbers
// against" without storing the fixture.
//
// FNV-1a over bytes, 32 bits. It is a change detector, not a security hash: two different fixtures
// can in principle collide, and a fingerprint says nothing about which part changed. Every array
// contributes its length in bytes as well as its bytes, so appending zeros moves the value. It does
// not see element width, so callers that care whether a column is 32-bit floats or integers hash
// the column's declared type as well, as `tableDigest` does.

// A hash in progress. Carry it from one `hash*` call to the next; the order of the calls is part
// of the answer.
export type Digest = number;

const fnvPrime = 0x01000193;

// The value every hash starts from.
export const emptyDigest: Digest = 0x811c9dc5 | 0;

// One byte folded into the digest.
export const hashByte = (digest: Digest, byte: number): Digest =>
  Math.imul(digest ^ (byte & 0xff), fnvPrime);

// A whole number folded in four bytes at a time, so lengths and counts are cheap to include.
export const hashInt = (digest: Digest, value: number): Digest => {
  const whole = Math.trunc(value) | 0;
  let result = digest;
  for (let shift = 0; shift < 32; shift += 8) result = hashByte(result, whole >>> shift);
  return result;
};

// The bytes of any typed array or data view, and its length in elements.
export const hashBytes = (digest: Digest, view: ArrayBufferView): Digest => {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  let result = hashInt(digest, bytes.length);
  for (let index = 0; index < bytes.length; index += 1) result = hashByte(result, bytes[index] ?? 0);
  return result;
};

// Text folded in as its UTF-16 code units, with its length.
export const hashText = (digest: Digest, text: string): Digest => {
  let result = hashInt(digest, text.length);
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    result = hashByte(hashByte(result, unit), unit >>> 8);
  }
  return result;
};

// A number of any kind, including a fraction and a special value, folded in by its text form.
export const hashNumber = (digest: Digest, value: number): Digest => hashText(digest, String(value));

// A list of numbers, with its length.
export const hashNumbers = (digest: Digest, values: readonly number[]): Digest =>
  values.reduce(hashNumber, hashInt(digest, values.length));

// Text that may be absent. An absent value hashes differently from an empty string.
export const hashOptionalText = (digest: Digest, text: string | undefined): Digest =>
  text === undefined ? hashByte(digest, 0) : hashText(hashByte(digest, 1), text);

// A number that may be absent, hashed the same way.
export const hashOptionalNumber = (digest: Digest, value: number | undefined): Digest =>
  value === undefined ? hashByte(digest, 0) : hashNumber(hashByte(digest, 1), value);

// The eight hexadecimal digits a digest is reported as. This is what a test pins.
export const digestHex = (digest: Digest): string => (digest >>> 0).toString(16).padStart(8, '0');
