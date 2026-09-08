// The fixture catalog: the set of local model files a request is allowed to name.
// Pure. Nothing here touches the file system.

// Model container formats the fixture server serves. Any other extension is not catalogued.
export type FixtureFormat = 'bfast' | 'bos';

// A file found on disk, before the catalog decides whether to accept it.
export type FixtureFile = {
  readonly name: string;
  readonly path: string;
  readonly bytes: number;
};

// One catalogued fixture: the public name, the local file behind it, its size and its format.
export type FixtureEntry = FixtureFile & { readonly format: FixtureFormat };

// Catalogued fixtures by name. A name is the only thing a request may address, so a request can
// never reach a file that is not in this map.
export type FixtureCatalog = ReadonlyMap<string, FixtureEntry>;

// Plain file names only: starts alphanumeric, then alphanumerics, dot, dash or underscore. This
// excludes path separators, drive letters, dot segments, percent escapes and whitespace.
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const MAX_NAME_LENGTH = 200;

// True when a name is a plain file name that is safe to expose over HTTP.
export const isSafeFixtureName = (name: string): boolean =>
  name.length <= MAX_NAME_LENGTH && NAME_PATTERN.test(name) && !name.includes('..');

// The format a fixture name declares, or null when its extension is not served.
export const fixtureFormat = (name: string): FixtureFormat | null =>
  name.endsWith('.bfast') ? 'bfast' : name.endsWith('.bos') ? 'bos' : null;

// Builds a catalog from candidate files: names that are unsafe or of an unserved format are
// dropped, and the first file to claim a name keeps it.
export const createCatalog = (files: readonly FixtureFile[]): FixtureCatalog => {
  const catalog = new Map<string, FixtureEntry>();
  for (const file of files) {
    const format = isSafeFixtureName(file.name) ? fixtureFormat(file.name) : null;
    if (format === null || catalog.has(file.name)) continue;
    catalog.set(file.name, { name: file.name, path: file.path, bytes: file.bytes, format });
  }
  return catalog;
};

// Catalogued fixtures ordered by name, so the listing endpoint is stable across runs.
export const listFixtures = (catalog: FixtureCatalog): readonly FixtureEntry[] =>
  [...catalog.values()].sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
