// One demo, shown: the viewer filling the page, the inspector docked right, a status strip under
// it, and a bar that says where you are, what data you are looking at and how to check it.
//
// The order a demo is brought up in matters and is the same every time: features are installed with
// the viewer so a demo's commands exist before anything dispatches one; the fixture is opened next,
// so `start` can read what was opened; `start` runs last and returns what undoes it.

import { diagnostic, failure, success, type Disposable, type Result } from '@bim-open-toolkit/model';
import type { PropertyRow } from '@bim-open-toolkit/ui-gratify';
import { chapters, type Demo, type DemoFixture, type GalleryViewer } from './contracts.js';
import { button, clear, el, link } from './elements.js';
import { basisLabel, chosenFixture, fixtureChoices } from './fixtures.js';
import { routeHref, type Route } from './routes.js';
import { renderSheet } from './sheet.js';
import type { Shell } from './shell.js';
import { createGalleryViewer, type GalleryViewerOptions } from './viewer.js';

// A mounted demo: what it is showing, and how to take it away.
export type MountedDemo = Disposable & {
  readonly demo: Demo;
  readonly fixture: DemoFixture;
  readonly viewer: GalleryViewer;
};

// How often the status strip is redrawn. Every frame would be four hundred writes a second for a
// line nobody can read that fast.
const statusIntervalMs = 250;

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

// What the chapter a demo belongs to is called.
const chapterTitle = (demo: Demo): string =>
  chapters.find((one) => one.id === demo.chapter)?.title ?? demo.chapter;

// The bar's left: where you are, and which data you are looking at.
const fillLead = (shell: Shell, demo: Demo, route: Route): void => {
  const crumbs = el('nav', 'breadcrumb');
  crumbs.setAttribute('aria-label', 'Where you are');
  crumbs.append(
    link('crumb', routeHref({ demoId: undefined, fixtureId: undefined }), 'Gallery'),
    el('span', 'crumb-sep', '/'),
    el('span', 'crumb', chapterTitle(demo)),
    el('span', 'crumb-sep', '/'),
    el('span', 'crumb crumb-here', demo.title),
  );

  const picker = el('nav', 'fixture-picker');
  picker.setAttribute('aria-label', 'Fixture');
  for (const choice of fixtureChoices(demo, route)) {
    const entry = link('fixture-choice', choice.href, choice.title);
    entry.title = basisLabel(choice.basis);
    if (choice.current) entry.setAttribute('aria-current', 'true');
    picker.append(entry);
  }

  shell.lead.append(crumbs, picker);
};

// The bar's right: the file this demo is in, and the command that checks it.
const fillTrail = (shell: Shell, demo: Demo): void => {
  const source = el('p', 'bar-source');
  source.append(el('span', 'label', 'Source'), el('code', 'value', demo.source));
  const verify = el('p', 'bar-verify');
  verify.append(el('span', 'label', 'Verify'), el('code', 'value', demo.verify));
  shell.trail.append(source, verify);
};

// Everything under the bar: the viewport, the inspector, the status strip and the mirror.
type Frame = {
  readonly page: HTMLElement;
  readonly viewport: HTMLElement;
  readonly inspector: HTMLElement;
  readonly sheet: HTMLElement;
  readonly status: HTMLElement;
  readonly mirror: HTMLElement;
  readonly setInspectorOpen: (open: boolean) => void;
  readonly inspectorOpen: () => boolean;
};

const buildFrame = (demo: Demo): Frame => {
  const page = el('div', 'demo-page');
  const viewport = el('div', 'gallery-viewport');
  const inspector = el('aside', 'inspector');
  inspector.setAttribute('aria-label', `${demo.title}: what is known`);
  const sheet = el('div', 'inspector-sheet');
  const status = el('p', 'status-strip');
  // The DOM mirror: every canvas control as real elements, for a keyboard and a screen reader.
  // `ui-gratify`'s semantics mirror fills it; until then it holds the inspector's own controls,
  // which are already elements.
  const mirror = el('div', 'semantics-mirror');
  mirror.setAttribute('aria-label', `${demo.title}: canvas controls`);

  let open = true;
  const head = el('div', 'inspector-head');
  const toggle = button('inspector-toggle', 'Hide', () => setInspectorOpen(!open));
  head.append(el('h2', 'inspector-title', 'Inspector'), toggle);
  inspector.append(head, sheet);

  function setInspectorOpen(next: boolean): void {
    open = next;
    page.classList.toggle('inspector-closed', !open);
    inspector.hidden = !open;
    toggle.textContent = open ? 'Hide' : 'Show';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  setInspectorOpen(true);

  page.append(viewport, inspector, status, mirror);
  return { page, viewport, inspector, sheet, status, mirror, setInspectorOpen, inspectorOpen: () => open };
};

// What the strip says: what is drawn, how fast, and what the data is.
const statusText = (mounted: MountedDemo, intervalMs: number): string => {
  const counts = mounted.viewer.statistics();
  const objects = mounted.viewer.opened().reduce((total, model) => total + model.data.objects.length, 0);
  const rate = intervalMs > 0 ? `${(1000 / intervalMs).toFixed(0)} frames a second` : 'measuring';
  return (
    `${String(objects)} objects · ${String(counts.renderedInstances)} instances · ` +
    `${String(counts.renderedTriangles)} triangles · ${rate} · ` +
    `${mounted.fixture.title}, ${basisLabel(mounted.fixture.basis).toLowerCase()}`
  );
};

// The demo page, drawn and running. Disposing it stops the viewer and takes the listeners away.
export type DemoPage = Disposable & { readonly mounted: MountedDemo | undefined };

// Draws the page for `demo` and brings the demo up on it. A demo that cannot start leaves the bar
// and the reason in place of the viewport, so the route still tells you where you were.
export const renderDemoPage = async (
  shell: Shell,
  demo: Demo,
  route: Route,
  options: GalleryViewerOptions = {},
): Promise<Result<DemoPage>> => {
  shell.reset();
  fillLead(shell, demo, route);
  fillTrail(shell, demo);
  const frame = buildFrame(demo);
  shell.main.append(frame.page);

  const fixture = chosenFixture(demo, route.fixtureId);
  if (fixture === undefined) {
    frame.status.textContent = `${demo.title} lists no fixture, so there is nothing to open.`;
    return failure([diagnostic('gallery/no-fixture', `${demo.id} lists no fixture`, ['fixtures'])]);
  }

  const mounted = await mountDemo(frame.viewport, demo, fixture, options);
  if (!mounted.ok) {
    frame.status.textContent = `${demo.title} could not start: ${mounted.diagnostics
      .map((one) => one.message)
      .join('; ')}`;
    return failure(mounted.diagnostics);
  }
  const page = mounted.value;

  const drawSheet = (): void => {
    renderSheet(frame.sheet, demo.inspector?.(page.viewer), (row: PropertyRow) => {
      if (row.action !== undefined) page.viewer.dispatch(row.action.command, row.action.input);
    });
  };
  drawSheet();
  const sheetFollows = page.viewer.subscribe(drawSheet);

  let lastStatus = 0;
  const strip = page.viewer.onFrame((info) => {
    if (info.time - lastStatus < statusIntervalMs) return;
    lastStatus = info.time;
    frame.status.textContent = statusText(page, info.intervalMs);
  });

  // `i` toggles the inspector, unless the person is typing into something.
  const keys = (event: KeyboardEvent): void => {
    if (event.key !== 'i' || event.ctrlKey || event.metaKey || event.altKey) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) return;
    frame.setInspectorOpen(!frame.inspectorOpen());
  };
  window.addEventListener('keydown', keys);

  return success<DemoPage>(
    {
      mounted: page,
      dispose: () => {
        window.removeEventListener('keydown', keys);
        strip.dispose();
        sheetFollows.dispose();
        page.dispose();
        clear(frame.page);
      },
    },
    mounted.diagnostics,
  );
};
