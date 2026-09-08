// Configuration parsing for the fixture server. Pure: the values themselves are read in main.ts.

// Directories searched when V2_FIXTURES_DIRS is not set. These are machine-specific on purpose:
// private models are never copied into the repository, so the default points at where they already
// are. A directory that does not exist contributes nothing.
// TODO: derive these from a repository root once the demos package resolves one.
export const DEFAULT_FIXTURE_DIRS: readonly string[] = [
  'C:/Users/cdigg/git/bim-open-toolkit/viewer/packages/visualization/artifacts/bfast',
  'C:/Users/cdigg/git/bim-open-toolkit/viewer/artifacts',
];

// Splits a semicolon-separated directory list. Blank entries are dropped, and an empty or unset
// value falls back to the given directories.
export const parseFixtureDirs = (
  value: string | null,
  fallback: readonly string[] = DEFAULT_FIXTURE_DIRS,
): readonly string[] => {
  const dirs = (value ?? '')
    .split(';')
    .map((dir) => dir.trim())
    .filter((dir) => dir.length > 0);
  return dirs.length === 0 ? fallback : dirs;
};

// A TCP port from configuration. Anything that is not a whole port number falls back; 0 means
// "any free port".
export const parsePort = (value: string | null, fallback: number): number => {
  const text = (value ?? '').trim();
  const port = text === '' ? Number.NaN : Number(text);
  return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : fallback;
};
