// The gallery's page entry: build the frame, read the route, draw the index or one demo, and
// publish `window.demo` so the browser smoke can read the page back.
//
// Links are ordinary anchors and every route is a query string, so moving between demos is a real
// navigation: the back button works, a link can be copied into a bug report, and nothing here has
// to keep a history stack of its own.

import './styles/tokens.css';
import './styles/chrome.css';
import './styles/index-page.css';
import './styles/viewport.css';
import './styles/inspector.css';
import { demoFailed, describeCause, type DemoWindow } from '../feature-demos/_shared/protocol.js';
import { renderDemoPage } from './demo-page.js';
import { discoveredDemos } from './discovery.js';
import { el } from './elements.js';
import { renderIndexPage } from './index-page.js';
import { isIndexRoute, parseRoute } from './routes.js';
import { mountShell } from './shell.js';

const root = document.getElementById('gallery');
if (!(root instanceof HTMLElement)) throw new Error('gallery.html has no element with id "gallery"');

const shell = mountShell(root);
const route = parseRoute(window.location.search);
const found = discoveredDemos();

// A message where the page would be, for a route that names nothing the gallery has.
const say = (text: string): void => {
  shell.main.append(el('p', 'gallery-note', text));
};

const start = async (): Promise<void> => {
  if (found.duplicates.length > 0) {
    const message = `Two demos claim the same id: ${found.duplicates.join(', ')}. Rename one of them.`;
    window.demo = demoFailed(message);
    shell.reset();
    say(message);
    return;
  }
  if (isIndexRoute(route)) {
    renderIndexPage(shell, found.demos, found.duplicates);
    return;
  }
  const demo = found.demos.find((one) => one.id === route.demoId);
  if (demo === undefined) {
    const message = `No demo is called "${String(route.demoId)}". The gallery lists ${String(found.demos.length)}.`;
    window.demo = demoFailed(message);
    shell.reset();
    say(message);
    return;
  }

  const page = await renderDemoPage(shell, demo, route);
  if (!page.ok) {
    window.demo = demoFailed(page.diagnostics.map((one) => one.message).join('; '));
    return;
  }
  const mounted = page.value.mounted;
  if (mounted === undefined) {
    window.demo = demoFailed(`${demo.id} drew no viewer`);
    return;
  }
  const published: DemoWindow = {
    get ready() {
      return demo.ready(mounted.viewer);
    },
    error: undefined,
    report: () => demo.report(mounted.viewer),
    act: (name, input) => mounted.viewer.dispatch(name, input).ok,
    capture: async () => {
      const image = await mounted.viewer.capture();
      return image.ok ? image.value.length : 0;
    },
  };
  window.demo = published;
  window.addEventListener('pagehide', () => page.value.dispose(), { once: true });
};

start().catch((cause: unknown) => {
  const message = describeCause(cause);
  window.demo = demoFailed(message);
  shell.reset();
  say(`The gallery could not start: ${message}`);
  console.error(message);
});
