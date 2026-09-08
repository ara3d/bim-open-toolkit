import { describe, expect, it } from 'vitest';
import {
  createCatalog,
  fixtureFormat,
  isSafeFixtureName,
  listFixtures,
  type FixtureFile,
} from '../../src/server/catalog.js';

const file = (name: string, path = `/models/${name}`, bytes = 10): FixtureFile => ({ name, path, bytes });

describe('isSafeFixtureName', () => {
  it('accepts plain file names', () => {
    expect(isSafeFixtureName('snowdon-bim.bfast')).toBe(true);
    expect(isSafeFixtureName('a_1.bos')).toBe(true);
  });

  it('refuses separators, dot segments, escapes and empty names', () => {
    for (const name of ['', '.', '..', '../x.bfast', 'a/b.bfast', 'a\\b.bfast', 'C:/x.bfast', '%2e%2e', '.hidden.bfast', 'a b.bfast', 'x..y.bfast'])
      expect(isSafeFixtureName(name), name).toBe(false);
  });

  it('refuses very long names', () => {
    expect(isSafeFixtureName(`${'a'.repeat(300)}.bfast`)).toBe(false);
  });
});

describe('fixtureFormat', () => {
  it('recognises the two served extensions and nothing else', () => {
    expect(fixtureFormat('x.bfast')).toBe('bfast');
    expect(fixtureFormat('x.bos')).toBe('bos');
    expect(fixtureFormat('x.json')).toBe(null);
    expect(fixtureFormat('x.bfast.gz')).toBe(null);
    expect(fixtureFormat('bfast')).toBe(null);
  });
});

describe('createCatalog', () => {
  it('keeps only safe names with a served extension', () => {
    const catalog = createCatalog([file('a.bfast'), file('b.bos'), file('c.txt'), file('../d.bfast'), file('.e.bfast')]);
    expect([...catalog.keys()].sort()).toEqual(['a.bfast', 'b.bos']);
  });

  it('records size, path and format', () => {
    const catalog = createCatalog([file('a.bfast', '/models/a.bfast', 4096)]);
    expect(catalog.get('a.bfast')).toEqual({ name: 'a.bfast', path: '/models/a.bfast', bytes: 4096, format: 'bfast' });
  });

  it('gives a repeated name to the first directory that holds it', () => {
    const catalog = createCatalog([file('a.bfast', '/first/a.bfast'), file('a.bfast', '/second/a.bfast')]);
    expect(catalog.get('a.bfast')?.path).toBe('/first/a.bfast');
  });
});

describe('listFixtures', () => {
  it('orders by name', () => {
    const catalog = createCatalog([file('c.bfast'), file('a.bfast'), file('b.bos')]);
    expect(listFixtures(catalog).map((entry) => entry.name)).toEqual(['a.bfast', 'b.bos', 'c.bfast']);
  });
});
