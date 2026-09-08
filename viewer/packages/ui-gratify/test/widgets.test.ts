import { beforeEach, describe, expect, it } from 'vitest';
import { Runtime, Stack, type AppSpec, type Element, type SemanticsNode } from 'gratify';
import { applyGalleryTheme, Button, Tag } from '../src/index.js';

// A headless runtime over one view, with every intent it dispatched recorded. This is how every
// widget in the kit is checked: real layout, real hit testing, real intents, no browser.
const drive = (view: () => Element): { readonly runtime: Runtime<number, string>; readonly seen: string[] } => {
  const seen: string[] = [];
  const spec: AppSpec<number, string> = {
    init: 0,
    update: (doc, intent) => {
      seen.push(intent);
      return doc + 1;
    },
    view,
  };
  const runtime = new Runtime<number, string>(null, spec, { headless: true, width: 320, height: 200 });
  runtime.step(2);
  return { runtime, seen };
};

const nodeAt = (nodes: readonly SemanticsNode[], label: string): SemanticsNode | undefined => {
  for (const node of nodes) {
    if (node.label === label) return node;
    const found = nodeAt(node.children, label);
    if (found !== undefined) return found;
  }
  return undefined;
};

const click = (runtime: Runtime<number, string>, node: SemanticsNode): void => {
  runtime.pointerDown(node.rect.center);
  runtime.pointerUp(node.rect.center);
};

beforeEach(() => {
  applyGalleryTheme('light', 1);
});

describe('Button', () => {
  it('emits its intent when pressed and says what it is to the semantics tree', () => {
    const { runtime, seen } = drive(() =>
      Stack('root', { gap: 8, pad: 8 }, [
        Button('fit', { label: 'Fit', press: 'fit' }),
        Button('clear', { label: 'Clear selection', press: 'clear' }),
      ]));
    const tree = runtime.semanticsTree();
    expect(tree.map((node) => [node.role, node.label])).toEqual([['button', 'Fit'], ['button', 'Clear selection']]);
    const fit = nodeAt(tree, 'Fit');
    const clear = nodeAt(tree, 'Clear selection');
    expect(fit !== undefined && clear !== undefined).toBe(true);
    if (fit === undefined || clear === undefined) return;
    click(runtime, clear);
    click(runtime, fit);
    expect(seen).toEqual(['clear', 'fit']);
    // The wider label makes the wider button; both keep the one control height.
    expect(clear.rect.w).toBeGreaterThan(fit.rect.w);
    expect(fit.rect.h).toBe(clear.rect.h);
  });

  it('stays silent while it is disabled', () => {
    const { runtime, seen } = drive(() =>
      Stack('root', {}, [Button('save', { label: 'Save view', press: 'save', enabled: false })]));
    const save = nodeAt(runtime.semanticsTree(), 'Save view');
    expect(save?.value).toBe(false);
    if (save !== undefined) click(runtime, save);
    expect(seen).toEqual([]);
  });

  it('activates from the keyboard, which is what the DOM mirror leans on', () => {
    const { runtime, seen } = drive(() => Stack('root', {}, [Button('fit', { label: 'Fit', press: 'fit' })]));
    expect(runtime.key('Tab')).toBe(true);
    expect(runtime.key('Enter')).toBe(true);
    expect(seen).toEqual(['fit']);
  });

  it('grows with the text scale', () => {
    const small = drive(() => Stack('root', {}, [Button('fit', { label: 'Fit', press: 'fit' })]));
    const before = nodeAt(small.runtime.semanticsTree(), 'Fit')?.rect.h ?? 0;
    applyGalleryTheme('light', 1.5);
    const large = drive(() => Stack('root', {}, [Button('fit', { label: 'Fit', press: 'fit' })]));
    const after = nodeAt(large.runtime.semanticsTree(), 'Fit')?.rect.h ?? 0;
    expect(after).toBeGreaterThan(before);
  });
});

describe('Tag', () => {
  it('reserves room for its leader line and reads out its two lines as one label', () => {
    const { runtime } = drive(() =>
      Stack('root', {}, [Tag('door', { text: 'Door 1-2-1', detail: 'Fire rating not recorded', leader: 30 })]));
    const tag = nodeAt(runtime.semanticsTree(), 'Door 1-2-1: Fire rating not recorded');
    expect(tag?.role).toBe('note');
    // Two lines of box plus the leader; the foot of the leader is the tag's own bottom-left corner.
    expect(tag?.rect.h).toBe(74);
  });

  it('is silent unless a demo gave it something to emit', () => {
    const quiet = drive(() => Stack('root', {}, [Tag('t', { text: 'Wall' })]));
    const node = nodeAt(quiet.runtime.semanticsTree(), 'Wall');
    if (node !== undefined) click(quiet.runtime, node);
    expect(quiet.seen).toEqual([]);

    const pinned = drive(() => Stack('root', {}, [Tag('t', { text: 'Wall', press: 'pin' })]));
    const target = nodeAt(pinned.runtime.semanticsTree(), 'Wall');
    if (target !== undefined) click(pinned.runtime, target);
    expect(pinned.seen).toEqual(['pin']);
  });
});
