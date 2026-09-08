import { describe, expect, it } from 'vitest';
import { detectFormat, formatOfName, signatureFormat } from '../src/detect.js';
import { formatCode } from '../src/diagnostics.js';
import { sampleBfast, writeBfast } from './fixtures.js';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

const glbHeader = (jsonLength: number): Uint8Array => {
  const out = new Uint8Array(12);
  new DataView(out.buffer).setUint32(0, 0x46546c67, true);
  new DataView(out.buffer).setUint32(4, 2, true);
  new DataView(out.buffer).setUint32(8, 12 + jsonLength, true);
  return out;
};

const binaryStl = (triangles: number): Uint8Array => {
  const out = new Uint8Array(84 + triangles * 50);
  new DataView(out.buffer).setUint32(80, triangles, true);
  return out;
};

describe('signatureFormat', () => {
  it('reads a BFAST preamble', () => {
    expect(signatureFormat(sampleBfast())).toBe('bfast');
    expect(signatureFormat(writeBfast([{ name: 'Anything', bytes: utf8('x') }]))).toBe('bfast');
  });

  it('reads a ZIP local header as BOS', () => {
    expect(signatureFormat(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]))).toBe('bos');
  });

  it('reads the glTF binary magic', () => {
    expect(signatureFormat(glbHeader(4))).toBe('glb');
  });

  it('reads a binary STL by its exact length', () => {
    expect(signatureFormat(binaryStl(2))).toBe('stl');
  });

  it('does not read a truncated binary STL as STL', () => {
    expect(signatureFormat(binaryStl(2).subarray(0, 100))).toBeUndefined();
  });

  it('reads an ASCII STL by its first word', () => {
    expect(signatureFormat(utf8('solid cube\nfacet normal 0 0 1\n'))).toBe('stl');
  });

  it('reads a glTF JSON document by its asset member', () => {
    expect(signatureFormat(utf8('{"asset": {"version": "2.0"}, "scenes": []}'))).toBe('gltf');
  });

  it('does not read arbitrary JSON as glTF', () => {
    expect(signatureFormat(utf8('{"hello": "world"}'))).toBeUndefined();
  });

  it('reads OBJ by its statement lines, comments and blanks first', () => {
    expect(signatureFormat(utf8('# exported\n\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'))).toBe('obj');
  });

  it('says nothing about bytes that match no format', () => {
    expect(signatureFormat(utf8('hello, this is prose and not a model at all'))).toBeUndefined();
    expect(signatureFormat(new Uint8Array(0))).toBeUndefined();
  });
});

describe('formatOfName', () => {
  it('maps the known extensions, ignoring case, query and fragment', () => {
    expect(formatOfName('model.BFAST')).toBe('bfast');
    expect(formatOfName('/models/a.bos?v=2')).toBe('bos');
    expect(formatOfName('https://host/a/b.gltf#scene')).toBe('gltf');
    expect(formatOfName('tower.vim')).toBe('bfast');
  });

  it('says nothing for an unknown or missing extension', () => {
    expect(formatOfName('model.ifc')).toBeUndefined();
    expect(formatOfName('model')).toBeUndefined();
  });
});

describe('detectFormat', () => {
  it('prefers the signature over the name', () => {
    const found = detectFormat(sampleBfast(), 'wrongly-named.obj');
    expect(found.ok && found.value).toBe('bfast');
  });

  it('falls back to the name when the bytes carry no signature', () => {
    const found = detectFormat(utf8('nothing recognizable here'), 'model.obj');
    expect(found.ok && found.value).toBe('obj');
    expect(found.diagnostics[0]?.message).toContain('from the name');
  });

  it('fails with the unknown-format code when neither answers', () => {
    const found = detectFormat(utf8('nothing recognizable here'));
    expect(found.ok).toBe(false);
    expect(found.diagnostics[0]?.code).toBe(formatCode.unknownFormat);
  });

  it('fails with the empty-source code for no bytes at all', () => {
    const found = detectFormat(new Uint8Array(0));
    expect(found.ok).toBe(false);
    expect(found.diagnostics[0]?.code).toBe(formatCode.emptySource);
  });
});
