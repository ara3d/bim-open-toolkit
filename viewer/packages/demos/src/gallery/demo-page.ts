// Mounting one demo: a viewer with the demo's features, its fixture opened, and its opening
// commands dispatched. Everything the demo page does that is not chrome.
//
// The order matters and is the same for every demo: features are installed with the viewer so a
// demo's commands exist before anything dispatches one; the fixture is opened next, so `start` can
// read what was opened; `start` runs last and returns what undoes it.

import { failure, success, type Disposable, type Result } from '@bim-open-toolkit/model';
import { createGalleryViewer, type GalleryViewerOptions } from './viewer.js';
import type { Demo, DemoFixture, GalleryViewer } from './contracts.js';

// A mounted demo: what it is showing, and how to take it away.
export type MountedDemo = Disposable & {
  readonly demo: Demo;
  readonly fixture: DemoFixture;
  readonly viewer: GalleryViewer;
};

// The fixture with that id, or the demo's default when the id names none.
export const fixtureById = (demo: Demo, id: string | null): DemoFixture | undefined =>
  (id === null ? undefined : demo.fixtures.find((one) => one.id === id)) ?? demo.fixtures[0];

// Draws `demo` on `fixture` inside `viewport`. Failures come back as diagnostics with nothing left
// mounted, so a page can show the reason instead of a half-built viewer.
export const mountDemo = async (
  viewport: HTMLElement,
  demo: Demo,
  fixture: DemoFixture,
  options: GalleryViewerOptions = {},
): Promise<Result<MountedDemo>> => {
  const made = createGalleryViewer(viewport, demo.features, options);
  if (!made.ok) return failure(made.diagnostics);
  const viewer = made.value;
  const source = await fixture.source();
  if (!source.ok) {
    viewer.dispose();
    return failure(source.diagnostics);
  }
  const opened = await viewer.open(source.value);
  if (!opened.ok) {
    viewer.dispose();
    return failure(opened.diagnostics);
  }
  const started = await demo.start(viewer);
  if (!started.ok) {
    viewer.dispose();
    return failure(started.diagnostics);
  }
  return success<MountedDemo>(
    {
      demo,
      fixture,
      viewer,
      dispose: () => {
        started.value.dispose();
        viewer.dispose();
      },
    },
    [...made.diagnostics, ...source.diagnostics, ...opened.diagnostics, ...started.diagnostics],
  );
};
