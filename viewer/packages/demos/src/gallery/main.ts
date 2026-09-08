// The gallery's page entry: read the route, mount the demo it names, and publish `window.demo` so
// the browser smoke can read the page back.
//
// The chrome - index page, top bar, inspector, status strip - is the next chunk. What is here is
// what the smoke run needs and what a demo track needs to see its own demo draw.

import './styles/tokens.css';
import './styles/viewport.css';
import { demoFailed, describeCause, type DemoWindow } from '../feature-demos/_shared/protocol.js';
import { demoById, discoveredDemos } from './discovery.js';
import { fixtureById, mountDemo } from './demo-page.js';

const stage = document.getElementById('gallery');
if (!(stage instanceof HTMLElement)) throw new Error('gallery.html has no element with id "gallery"');

// A message where the viewport would be, for a route that names nothing and for a failed mount.
const say = (text: string): void => {
  const note = document.createElement('p');
  note.className = 'gallery-note';
  note.textContent = text;
  stage.append(note);
};

const route = new URLSearchParams(window.location.search);
const found = discoveredDemos();

const start = async (): Promise<void> => {
  if (found.duplicates.length > 0) {
    const message = `Two demos claim the same id: ${found.duplicates.join(', ')}. Rename one of them.`;
    window.demo = demoFailed(message);
    say(message);
    return;
  }
  const demo = demoById(found.demos, route.get('demo'));
  if (demo === undefined) {
    const message = 'No demo was found. Add one under src/demos/<id>/index.ts.';
    window.demo = demoFailed(message);
    say(message);
    return;
  }
  const fixture = fixtureById(demo, route.get('fixture'));
  if (fixture === undefined) {
    const message = `${demo.id} lists no fixture, so there is nothing to open.`;
    window.demo = demoFailed(message);
    say(message);
    return;
  }

  const viewport = document.createElement('div');
  viewport.className = 'gallery-viewport';
  stage.append(viewport);

  const mounted = await mountDemo(viewport, demo, fixture);
  if (!mounted.ok) {
    const message = mounted.diagnostics.map((one) => one.message).join('; ');
    window.demo = demoFailed(message);
    say(`${demo.title} could not start: ${message}`);
    return;
  }
  const page = mounted.value;
  const published: DemoWindow = {
    get ready() {
      return demo.ready(page.viewer);
    },
    error: undefined,
    report: () => demo.report(page.viewer),
    act: (name, input) => page.viewer.dispatch(name, input).ok,
    capture: async () => {
      const image = await page.viewer.capture();
      return image.ok ? image.value.length : 0;
    },
  };
  window.demo = published;
  window.addEventListener('pagehide', () => page.dispose(), { once: true });
};

start().catch((cause: unknown) => {
  const message = describeCause(cause);
  window.demo = demoFailed(message);
  say(`The gallery could not start: ${message}`);
  console.error(message);
});
