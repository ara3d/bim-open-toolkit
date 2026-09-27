// Layout of a prepared BFAST's instance and mesh-slice records. Shared by the parser (`bfast.ts`)
// and the box preview (`preview.ts`), neither of which needs the other to read these offsets.

// 32-bit words in one BFAST instance record, and the word each field sits at.
export const instanceWords = 16;
export const meshWord = 12;
export const entityWord = 13;
export const colorWord = 14;
export const flagsWord = 15;

// Integers per mesh slice: base vertex, vertex count, first index, index count.
export const meshSliceInts = 4;

// Byte 1 of the flags word holds the instance flags; bit 0 of those means the instance is not drawn.
export const hiddenFlag = 0x1;

// Bytes 2 and 3 of the flags word hold the placement's surface factors, 0 to 255 over 0 to 1.
export const roughnessShift = 16;
export const metallicShift = 24;
