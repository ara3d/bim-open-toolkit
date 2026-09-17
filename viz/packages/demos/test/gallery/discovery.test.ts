import { describe, expect, it } from 'vitest';
import { demoById, discoverDemos } from '../../src/gallery/discovery.js';
import { demo as placeholder } from '../../src/demos/_shared/placeholder.js';
import type { Demo } from '../../src/gallery/contracts.js';

const stub = (id: string): { readonly demo: Demo } => ({ demo: { ...placeholder, id, title: id } });

describe('demo discovery', () => {
  it('falls back to the placeholder when no demo module was found', () => {
    const found = discoverDemos({});
    expect(found.usingPlaceholder).toBe(true);
    expect(found.demos.map((one) => one.id)).toEqual(['placeholder']);
  });

  it('orders demos by their module path and drops the placeholder once one exists', () => {
    const found = discoverDemos({
      '../demos/colour-by/index.ts': stub('colour-by'),
      '../demos/point-and-read/index.ts': stub('point-and-read'),
    });
    expect(found.usingPlaceholder).toBe(false);
    expect(found.demos.map((one) => one.id)).toEqual(['colour-by', 'point-and-read']);
    expect(found.duplicates).toEqual([]);
  });

  it('names an id two modules claim rather than picking a winner', () => {
    const found = discoverDemos({
      '../demos/a/index.ts': stub('same'),
      '../demos/b/index.ts': stub('same'),
    });
    expect(found.duplicates).toEqual(['same']);
  });

  it('skips a module that exports no demo', () => {
    const found = discoverDemos({ '../demos/notes/index.ts': { title: 'not a demo' } });
    expect(found.usingPlaceholder).toBe(true);
  });

  it('resolves a route to a demo, and to the first one when the route names none', () => {
    const demos = [stub('a').demo, stub('b').demo];
    expect(demoById(demos, 'b')?.id).toBe('b');
    expect(demoById(demos, null)?.id).toBe('a');
    expect(demoById(demos, 'missing')?.id).toBe('a');
  });
});
