// Reading the configured directories into a catalog. This is the only file that lists directories.

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createCatalog, type FixtureCatalog, type FixtureFile } from './catalog.js';

// Names of the regular files in a directory. A missing or unreadable directory yields none, so a
// machine without the private models still starts. Symbolic links are not regular files and are
// skipped, which keeps a link from reaching outside the configured directories.
const readFileNames = async (dir: string): Promise<readonly string[]> => {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch {
    return [];
  }
};

// Size and location of one candidate file, or null when it cannot be read.
const describeFile = async (dir: string, name: string): Promise<FixtureFile | null> => {
  const path = join(dir, name);
  try {
    const info = await stat(path);
    return { name, path, bytes: info.size };
  } catch {
    return null;
  }
};

// Candidate files in one directory.
export const scanFixtureDir = async (dir: string): Promise<readonly FixtureFile[]> => {
  const names = await readFileNames(dir);
  const described = await Promise.all(names.map((name) => describeFile(dir, name)));
  return described.filter((file) => file !== null);
};

// Builds the catalog from the configured directories in order; the first directory holding a name
// wins it. The catalog is a snapshot: files added or replaced later are not picked up until restart.
export const scanFixtures = async (dirs: readonly string[]): Promise<FixtureCatalog> => {
  const found = await Promise.all(dirs.map((dir) => scanFixtureDir(dir)));
  return createCatalog(found.flat());
};
