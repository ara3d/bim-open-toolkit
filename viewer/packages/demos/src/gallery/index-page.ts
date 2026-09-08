// The index: a chapter rail and the demos, two to a row.
//
// A card says what the demo answers before it says what it is called, because the question is what
// a person is choosing between. Its thumbnail is the picture the browser smoke captured; when a
// demo has none yet the card shows a neutral placeholder rather than a broken image, so an
// unfinished demo is visibly unfinished and not visibly broken.

import { chapters, demosInChapter, type Demo, type DemoChapter } from './contracts.js';
import { button, el, link } from './elements.js';
import { basisLabel } from './fixtures.js';
import { demoRoute, routeHref } from './routes.js';
import type { Shell } from './shell.js';

// Where a captured thumbnail lives. The smoke run writes here; git keeps what it wrote.
export const thumbnailHref = (demoId: string): string => `/thumbnails/${demoId}.png`;

// A neutral stand-in for a demo whose thumbnail has not been captured yet.
const placeholderThumbnail = (): HTMLElement => {
  const box = el('div', 'card-thumbnail card-thumbnail-none');
  box.append(el('span', '', 'No picture captured yet'));
  return box;
};

// The thumbnail, replaced by the stand-in if the file is not there.
const thumbnail = (demo: Demo): HTMLElement => {
  const frame = el('div', 'card-thumbnail');
  const image = el('img', 'card-image');
  image.src = thumbnailHref(demo.id);
  image.alt = '';
  image.loading = 'lazy';
  image.width = 480;
  image.height = 300;
  image.addEventListener('error', () => frame.replaceWith(placeholderThumbnail()), { once: true });
  frame.append(image);
  return frame;
};

// The labels under a card: the fixture it opens, the features it installs, the brief rows it covers.
const labels = (demo: Demo): HTMLElement => {
  const list = el('ul', 'card-labels');
  const first = demo.fixtures[0];
  if (first !== undefined) list.append(el('li', 'label-fixture', `${first.title} · ${basisLabel(first.basis)}`));
  for (const feature of demo.features) list.append(el('li', 'label-feature', feature.id));
  for (const brief of demo.briefIds) list.append(el('li', 'label-brief', brief));
  return list;
};

const card = (demo: Demo): HTMLElement => {
  const made = link('demo-card', routeHref(demoRoute(demo.id)), '');
  made.append(thumbnail(demo), el('p', 'card-question', demo.question), el('h3', 'card-title', demo.title), labels(demo));
  return made;
};

const section = (chapter: DemoChapter, title: string, demos: readonly Demo[]): HTMLElement => {
  const made = el('section', 'chapter');
  made.id = `chapter-${chapter}`;
  made.append(el('h2', 'chapter-title', title));
  const grid = el('div', 'chapter-grid');
  for (const demo of demos) grid.append(card(demo));
  made.append(grid);
  return made;
};

// How many questions the gallery answers, in words, because a heading counting itself in digits
// reads like a status line.
const countWord = (count: number): string => {
  const words = ['No questions', 'One question', 'Two questions', 'Three questions', 'Four questions', 'Five questions', 'Six questions', 'Seven questions', 'Eight questions', 'Nine questions', 'Ten questions'];
  return words[count] ?? `${String(count)} questions`;
};

// Draws the index into the shell. Returns nothing to dispose: it is only elements.
export const renderIndexPage = (shell: Shell, demos: readonly Demo[], duplicates: readonly string[]): void => {
  shell.reset();
  shell.lead.append(el('span', 'wordmark', 'BIM Open Toolkit'), el('span', 'wordmark-note', 'Demo gallery'));

  const page = el('div', 'index-page');
  const rail = el('nav', 'chapter-rail');
  rail.setAttribute('aria-label', 'Chapters');
  const body = el('div', 'index-body');

  if (duplicates.length > 0)
    body.append(
      el('p', 'gallery-note', `Two demos claim the same id: ${duplicates.join(', ')}. Rename one of them.`),
    );

  // The count is read off what was discovered rather than written down: a gallery that says
  // twenty-one and lists five is worse than one that says five.
  body.append(
    el('h1', 'index-title', `${countWord(demos.length)} answered on a real building`),
    el(
      'p',
      'index-lead',
      'Every demo opens Snowdon Towers - a real model, read from its file - shows one thing the ' +
        'toolkit can do with it, and says what it does not know. Gaps, conflicts and unverified ' +
        'connections are shown as such. Each demo also offers a generated building, whose gaps are ' +
        'deliberate.',
    ),
  );

  for (const chapter of chapters) {
    const held = demosInChapter(demos, chapter.id);
    // A button, not a fragment link: the gallery's addresses are query strings only, and moving
    // within a page is not an address.
    const jump = button('rail-link', chapter.title, () => {
      document.getElementById(`chapter-${chapter.id}`)?.scrollIntoView({ block: 'start' });
    });
    jump.append(el('span', 'rail-count', String(held.length)));
    jump.disabled = held.length === 0;
    rail.append(jump);
    if (held.length > 0) body.append(section(chapter.id, chapter.title, held));
  }

  page.append(rail, body);
  shell.main.append(page);
};
