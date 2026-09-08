import { describe, expect, it } from 'vitest';
import { success } from '@bim-open-toolkit/model';
import { chapters, demosInChapter, duplicateDemoIds, type Demo } from '../../src/gallery/contracts.js';

const stub = (id: string, chapter: Demo['chapter']): Demo => ({
  id,
  chapter,
  title: id,
  question: `What does ${id} show?`,
  briefIds: ['F27'],
  features: [],
  fixtures: [],
  panels: [],
  start: () => Promise.resolve(success({ dispose: () => undefined })),
  ready: () => true,
  report: () => ({}),
  source: `viewer/packages/demos/src/demos/${id}`,
  verify: 'npx vitest run --root packages/demos test/gallery',
});

describe('gallery contracts', () => {
  it('lists the four chapters in gallery order', () => {
    expect(chapters.map((chapter) => chapter.id)).toEqual([
      'inspect',
      'cut-and-arrange',
      'workflows',
      'scale-and-proof',
    ]);
  });

  it('groups demos by chapter and names duplicate ids', () => {
    const demos = [stub('a', 'inspect'), stub('b', 'workflows'), stub('a', 'workflows')];
    expect(demosInChapter(demos, 'workflows').map((demo) => demo.id)).toEqual(['b', 'a']);
    expect(duplicateDemoIds(demos)).toEqual(['a']);
  });
});
