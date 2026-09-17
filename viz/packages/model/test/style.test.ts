import { describe, expect, it } from 'vitest';
import { colorObjects, deleteObjects, editLayer, hideObjects, type EditState } from '../src/edits.js';
import { setOf } from '../src/sets.js';
import {
  applyAppearance, defaultAppearance, defaultSelectionChange, enabledRules, isRemoved, isVisible,
  noStyling, orderRules, resolveStyles, sameAppearance, sameExtras, styleComposition, styleOf,
  styleRule, withSelectionChange, type Appearance, type AppearanceChange,
} from '../src/style.js';

const red = { color: [1, 0, 0] } as const;
const blue = { color: [0, 0, 1] } as const;
const keys = ['a', 'b', 'c', 'd'];
const noEditState: EditState = [];

describe('appearance', () => {
  it('applies only the properties a change names', () => {
    expect(applyAppearance(defaultAppearance, { opacity: 0.5 })).toEqual({
      color: defaultAppearance.color,
      opacity: 0.5,
      visible: true,
      extras: undefined,
    });
  });

  it('merges extension properties by name', () => {
    const base: Appearance = { ...defaultAppearance, extras: { outline: true, layer: 1 } };
    expect(applyAppearance(base, { extras: { layer: 2 } }).extras).toEqual({ outline: true, layer: 2 });
    expect(applyAppearance(defaultAppearance, { extras: { outline: true } }).extras).toEqual({ outline: true });
  });

  it('compares appearances by what they look like, extensions included', () => {
    expect(sameAppearance(defaultAppearance, { ...defaultAppearance })).toBe(true);
    expect(sameAppearance(defaultAppearance, { ...defaultAppearance, opacity: 0.5 })).toBe(false);
    expect(sameExtras(undefined, {})).toBe(true);
    expect(sameExtras({ outline: true }, { outline: false })).toBe(false);
  });
});

describe('style rules', () => {
  it('orders rules by rising priority, keeping position within one priority', () => {
    const rules = [
      styleRule('r1', 'first', ['a'], red, 1),
      styleRule('r2', 'second', ['a'], blue, 0),
      styleRule('r3', 'third', ['a'], red, 1),
    ];
    expect(orderRules(rules).map((rule) => rule.id)).toEqual(['r2', 'r1', 'r3']);
  });

  it('keeps only the rules that are switched on', () => {
    const off = { ...styleRule('r1', 'off', ['a'], red), enabled: false };
    expect(enabledRules([off, styleRule('r2', 'on', ['a'], blue)]).map((rule) => rule.id)).toEqual(['r2']);
  });

  it('lets a higher priority rule win per property', () => {
    const rules = [
      styleRule('low', 'low', ['a'], { color: [1, 0, 0], opacity: 0.5 }, 0),
      styleRule('high', 'high', ['a'], { color: [0, 0, 1] }, 1),
    ];
    const resolved = resolveStyles(styleComposition(new Map(), noEditState, rules), keys);
    expect(styleOf(resolved, 'a').color).toEqual([0, 0, 1]);
    expect(styleOf(resolved, 'a').opacity).toBe(0.5);
  });
});

describe('style composition', () => {
  it('leaves untouched objects at the fallback and stores nothing for them', () => {
    const resolved = resolveStyles(noStyling, keys);
    expect(resolved.byKey.size).toBe(0);
    expect(styleOf(resolved, 'a')).toEqual(defaultAppearance);
  });

  it('drops a key from byKey when the rule that styled it goes, which is what styleOf is for', () => {
    const rules = [styleRule('r1', 'rule', ['a'], blue)];
    const styled = resolveStyles(styleComposition(new Map(), noEditState, rules), keys);
    expect([...styled.byKey.keys()]).toEqual(['a']);
    // The rule is switched off, so 'a' is not in byKey at all rather than in it at the fallback:
    // a binding that iterated byKey would never hear that 'a' went back to looking ordinary.
    const plain = resolveStyles(styleComposition(new Map(), noEditState, []), keys);
    expect(plain.byKey.has('a')).toBe(false);
    expect(styleOf(plain, 'a')).toEqual(defaultAppearance);
  });

  it('applies the base appearance a model gave an object', () => {
    const base = new Map([['a', { ...defaultAppearance, ...blue }]]);
    const resolved = resolveStyles(styleComposition(base, noEditState, []), keys);
    expect(styleOf(resolved, 'a').color).toEqual([0, 0, 1]);
    expect(styleOf(resolved, 'b')).toEqual(defaultAppearance);
  });

  it('applies rules over the edits, not under them', () => {
    const edits: EditState = [editLayer('l1', 'edit', [colorObjects(['a'], { color: [1, 0, 0], opacity: 0.2 })])];
    const rules = [styleRule('r1', 'rule', ['a'], blue)];
    const resolved = resolveStyles(styleComposition(new Map(), edits, rules), keys);
    expect(styleOf(resolved, 'a').color).toEqual([0, 0, 1]);
    expect(styleOf(resolved, 'a').opacity).toBe(0.2);
  });

  it('leaves deleted objects out of the resolved styles', () => {
    const edits: EditState = [editLayer('l1', 'edit', [deleteObjects(['a'])])];
    const resolved = resolveStyles(styleComposition(new Map(), edits, []), keys);
    expect(isRemoved(resolved, 'a')).toBe(true);
    expect(resolved.byKey.has('a')).toBe(false);
    expect(isVisible(resolved, 'a')).toBe(false);
  });

  it('hides what an edit layer hid', () => {
    const edits: EditState = [editLayer('l1', 'edit', [hideObjects(['b'])])];
    const resolved = resolveStyles(styleComposition(new Map(), edits, []), keys);
    expect(styleOf(resolved, 'b').visible).toBe(false);
    expect(isVisible(resolved, 'b')).toBe(false);
    expect(isVisible(resolved, 'a')).toBe(true);
  });

  it('hides everything the filter leaves out', () => {
    const composition = styleComposition(new Map(), noEditState, [], setOf([]), setOf(['a', 'b']));
    const resolved = resolveStyles(composition, keys);
    expect(isVisible(resolved, 'a')).toBe(true);
    expect(isVisible(resolved, 'c')).toBe(false);
  });

  it('marks the selection', () => {
    const composition = styleComposition(new Map(), noEditState, [], setOf(['a']));
    const resolved = resolveStyles(composition, keys);
    expect(styleOf(resolved, 'a').color).toEqual(defaultSelectionChange.color);
    expect(styleOf(resolved, 'b')).toEqual(defaultAppearance);
  });

  it('never lets the selection bring back hidden, filtered or deleted geometry', () => {
    const edits: EditState = [editLayer('l1', 'edit', [hideObjects(['b']), deleteObjects(['a'])])];
    const selection = setOf(['a', 'b', 'c']);
    const composition = styleComposition(new Map(), edits, [], selection, setOf(['a', 'b']));
    const resolved = resolveStyles(composition, keys);
    expect(isRemoved(resolved, 'a')).toBe(true);
    expect(isVisible(resolved, 'b')).toBe(false);
    expect(isVisible(resolved, 'c')).toBe(false);
  });

  it('marks a selected object that a rule made invisible without showing it', () => {
    const rules = [styleRule('r1', 'hide', ['a'], { visible: false })];
    const composition = styleComposition(new Map(), noEditState, rules, setOf(['a']));
    const resolved = resolveStyles(composition, keys);
    expect(styleOf(resolved, 'a').visible).toBe(false);
    expect(styleOf(resolved, 'a').color).toEqual(defaultSelectionChange.color);
  });

  it('treats a fully transparent object as not drawn', () => {
    const rules = [styleRule('r1', 'ghost', ['a'], { opacity: 0 })];
    const resolved = resolveStyles(styleComposition(new Map(), noEditState, rules), keys);
    expect(isVisible(resolved, 'a')).toBe(false);
  });

  it('marks the selection the way the host asks, and the M1 way when it does not ask', () => {
    const marking: AppearanceChange = { color: [0, 1, 1], extras: { outline: true } };
    const asked = styleComposition(new Map(), noEditState, [], setOf(['a']), undefined, marking);
    const resolvedAsked = resolveStyles(asked, keys);
    expect(styleOf(resolvedAsked, 'a').color).toEqual([0, 1, 1]);
    expect(styleOf(resolvedAsked, 'a').extras).toEqual({ outline: true });

    const silent = styleComposition(new Map(), noEditState, [], setOf(['a']));
    expect(silent.selectionChange).toEqual(defaultSelectionChange);
    expect(styleOf(resolveStyles(silent, keys), 'a').color).toEqual(defaultSelectionChange.color);
  });

  it('changes the marking of a composition it did not build', () => {
    const composition = styleComposition(new Map(), noEditState, [], setOf(['a']), setOf(keys));
    const restyled = withSelectionChange(composition, { color: [0, 0, 1] });
    expect(styleOf(resolveStyles(restyled, keys), 'a').color).toEqual([0, 0, 1]);
    expect(restyled.filter).toBe(composition.filter);
    expect(composition.selectionChange).toEqual(defaultSelectionChange);
  });

  it('never lets a host-supplied marking show what was hidden', () => {
    const edits: EditState = [editLayer('l1', 'edit', [hideObjects(['a'])])];
    const shouting: AppearanceChange = { color: [1, 0, 1], visible: true, opacity: 1 };
    const composition = styleComposition(new Map(), edits, [], setOf(['a']), undefined, shouting);
    expect(isVisible(resolveStyles(composition, keys), 'a')).toBe(false);
  });
});
