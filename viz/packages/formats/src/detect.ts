import { failure, success, type Result } from '@bim-open-toolkit/model';
import { formatCode, formatDiagnostic, formatNote } from './diagnostics.js';
import type { ModelFormat } from './loaded-model.js';

// The extension a format is normally stored under, without the dot.
export const formatExtensions: Readonly<Record<ModelFormat, readonly string[]>> = {
  bfast: ['bfast', 'vim'],
  bos: ['bos'],
  glb: ['glb'],
  gltf: ['gltf'],
  obj: ['obj'],
  stl: ['stl'],
};

// The format a file name suggests, or undefined when its extension names none of them.
export function formatOfName(name: string): ModelFormat | undefined {
  const path = name.split(/[?#]/)[0] ?? '';
  const dot = path.lastIndexOf('.');
  if (dot < 0) return undefined;
  const extension = path.slice(dot + 1).toLowerCase();
  for (const [format, extensions] of Object.entries(formatExtensions))
    if (extensions.includes(extension)) return formatOfString(format);
  return undefined;
}

// The bytes read as a little-endian 32-bit word, or undefined when they are not there.
const wordAt = (bytes: Uint8Array, at: number): number | undefined =>
  bytes.byteLength < at + 4
    ? undefined
    : new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0, true);

// First eight bytes of a little-endian BFAST file read as a 64-bit integer.
const bfastMagic = 0xbfa5;

// 'glTF' read as a little-endian 32-bit word.
const glbMagic = 0x46546c67;

// Bytes of a binary STL before the triangles, and the size of one triangle record.
const stlHeaderBytes = 84;
const stlTriangleBytes = 50;

// Bytes of the head of a file examined for a text signature.
const textProbeBytes = 4096;

// True when the file starts with the BFAST preamble.
export const isBfastSignature = (bytes: Uint8Array): boolean =>
  bytes.byteLength >= 32 && wordAt(bytes, 0) === bfastMagic && wordAt(bytes, 4) === 0;

// True when the file starts with a ZIP local file header, which is what a BOS archive is.
export const isZipSignature = (bytes: Uint8Array): boolean =>
  bytes.byteLength >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

// True when the file starts with the glTF binary container magic.
export const isGlbSignature = (bytes: Uint8Array): boolean => wordAt(bytes, 0) === glbMagic;

// True when the file's length is exactly what its binary STL triangle count claims.
export function isBinaryStlSignature(bytes: Uint8Array): boolean {
  const count = wordAt(bytes, 80);
  return (
    bytes.byteLength >= stlHeaderBytes &&
    count !== undefined &&
    stlHeaderBytes + count * stlTriangleBytes === bytes.byteLength
  );
}

// The head of the file as text, for the formats whose signature is their first line.
const headText = (bytes: Uint8Array): string =>
  new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, textProbeBytes));

// Marks that only an OBJ file has at the start of a line.
const objLine = /^[ \t]*(?:v|vn|vt|vp|f|l|o|g|s|mtllib|usemtl)[ \t]+\S/m;

/**
 * The format of a file, from its bytes and optionally its name.
 *
 * The byte signature decides when there is one, because a name can be wrong. The name decides only
 * when the bytes say nothing, and the returned note records which of the two answered.
 */
export function detectFormat(bytes: Uint8Array, name?: string): Result<ModelFormat> {
  const bySignature = signatureFormat(bytes);
  if (bySignature !== undefined)
    return success(bySignature, [formatNote(formatCode.detectedFormat, `Detected ${bySignature} from the file signature`)]);
  const byName = name === undefined ? undefined : formatOfName(name);
  if (byName !== undefined)
    return success(byName, [
      formatNote(formatCode.detectedFormat, `Detected ${byName} from the name "${name}"; its bytes carry no signature`),
    ]);
  return failure([
    formatDiagnostic(
      bytes.byteLength === 0 ? formatCode.emptySource : formatCode.unknownFormat,
      bytes.byteLength === 0
        ? 'The source is empty, so its format cannot be told'
        : `No supported format signature in the first ${Math.min(bytes.byteLength, textProbeBytes)} bytes${name === undefined ? '' : ` of "${name}"`}`,
    ),
  ]);
}

// The format the bytes themselves name, or undefined when they name none.
export function signatureFormat(bytes: Uint8Array): ModelFormat | undefined {
  if (isBfastSignature(bytes)) return 'bfast';
  if (isZipSignature(bytes)) return 'bos';
  if (isGlbSignature(bytes)) return 'glb';
  if (isBinaryStlSignature(bytes)) return 'stl';
  const head = headText(bytes);
  if (/^\s*solid\b/.test(head)) return 'stl';
  if (/^\s*\{/.test(head) && /"asset"\s*:/.test(head)) return 'gltf';
  if (objLine.test(head)) return 'obj';
  return undefined;
}

// A string read back as a format, for values that came from a table of formats.
function formatOfString(value: string): ModelFormat | undefined {
  switch (value) {
    case 'bfast':
    case 'bos':
    case 'glb':
    case 'gltf':
    case 'obj':
    case 'stl':
      return value;
    default:
      return undefined;
  }
}
