// Where screenshots and benchmark reports go.
//
// The wave plan puts the testing package's output under `viewer/artifacts/testing`, which git
// ignores. A test cannot hard-code that path without assuming where it was started from, and
// cannot derive it from `import.meta.url` with a fixed number of steps up, because a module sits
// three directories deep under `src` and two under the built `dist`. So the workspace root is
// found by walking up for the directory that holds `packages`, which is true of both layouts.

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The workspace directory above `packages`, found by walking up from a module's own URL or path.
// Throws rather than guessing when there is no such ancestor.
export function findViewerRoot(start: string): string {
  let directory = start.startsWith('file:') ? dirname(fileURLToPath(start)) : resolve(start);
  for (;;) {
    if (existsSync(join(directory, 'packages'))) return directory;
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`no directory containing "packages" above ${start}`);
    directory = parent;
  }
}

// The directory this package writes screenshots and reports to, under the given workspace root.
export const artifactsDir = (viewerRoot: string, ...segments: readonly string[]): string =>
  join(viewerRoot, 'artifacts', 'testing', ...segments);

// The output directory for a caller inside this package, found from its own module URL.
export const artifactsFor = (moduleUrl: string, ...segments: readonly string[]): string =>
  artifactsDir(findViewerRoot(moduleUrl), ...segments);
