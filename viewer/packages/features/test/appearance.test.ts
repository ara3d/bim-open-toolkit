import { describe, expect, it } from 'vitest';
import {
  emptyDocument,
  f32Column,
  getSlice,
  hasErrors,
  parseDocument,
  putSlice,
  stringColumn,
  styleRule,
  table,
  type StyleRule,
} from '@bim-open-toolkit/model';
import {
  appearanceFeature,
  appearanceFeatureFor,
  appearanceSlice,
  bandColor,
  bandOf,
  categoryStyling,
  noAppearanceState,
  numericStyling,
  resolveAppearance,
  writeAppearance,
  type AppearanceState,
  type CategoryPalette,
  type Legend,
  type NumericScale,
} from '../src/appearance.js';
import type { RenderTarget } from '../src/appearance-render.js';
import {
  boundScene,
  categoryTable,
  featureSession,
  fixtureKeys,
  installedSession,
  key,
  stored,
} from './appearance-fixture.js';

const red: readonly [number, number, number] = [1, 0, 0];
const green: readonly [number, number, number] = [0, 1, 0];
const grey: readonly [number, number, number] = [0.5, 0.5, 0.5];

const palette: CategoryPalette = {
  title: 'Fire rating',
  entries: [
    { value: 'rated', label: 'Rated', color: green },
    { value: 'unrated', label: 'Unrated', color: red },
  ],
  missing: { value: '', label: 'No rating recorded', color: grey },
};

const scale: NumericScale = {
  title: 'Width',
  min: 0,
  max: 100,
  low: [0, 0, 1],
  high: [1, 0, 0],
  bands: 4,
  missing: { value: '', label: 'No width recorded', color: grey },
};

describe('the appearance slice', () => {
  it('round-trips through a document as JSON', () => {
    const rule = styleRule('doors', 'Unrated doors', [key(0)], { color: red, opacity: 0.5 }, 2);
    const legend: Legend = {
      kind: 'category',
      id: 'doors',
      title: 'Fire rating',
      entries: palette.entries,
      missing: palette.missing,
    };
    const state: AppearanceState = { rules: [rule], legends: [legend] };
    const document = putSlice(emptyDocument(), appearanceSlice, state);
    const parsed = parseDocument(JSON.parse(JSON.stringify(document)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const read = getSlice(parsed.value, appearanceSlice);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toEqual(state);
  });

  it('reads an absent slice as its default rather than failing', () => {
    const read = getSlice(emptyDocument(), appearanceSlice);
    expect(read.ok).toBe(true);
    expect(read.ok && read.value).toEqual(noAppearanceState);
    expect(hasErrors(read.diagnostics)).toBe(false);
  });

  it('refuses a stored value that is not a rule', () => {
    const broken = { ...emptyDocument(), slices: { appearance: { version: 1, value: { rules: [{ id: 7 }], legends: [] } } } };
    const read = getSlice(broken, appearanceSlice);
    expect(read.ok).toBe(false);
  });
});

describe('colouring by category', () => {
  const keys = fixtureKeys;
  const source = categoryTable([
    [keys[0] ?? '', 'rated'],
    [keys[1] ?? '', 'unrated'],
    [keys[2] ?? '', 'unknown-value'],
  ]);

  it('makes one rule per swatch and one for the values the palette does not name', () => {
    const built = categoryStyling('rating', source, 'key', 'category', palette);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.rules.map((rule) => rule.id)).toEqual([
      'rating/rated',
      'rating/unrated',
      'rating/missing',
    ]);
    expect(built.value.rules[0]?.targets).toEqual([keys[0]]);
    expect(built.value.rules[2]?.targets).toEqual([keys[2]]);
    expect(built.value.rules[2]?.change.color).toEqual(grey);
  });

  it('carries the legend as data, with the missing colour stated', () => {
    const built = categoryStyling('rating', source, 'key', 'category', palette);
    expect(built.ok && built.value.legend).toEqual({
      kind: 'category',
      id: 'rating',
      title: 'Fire rating',
      entries: palette.entries,
      missing: palette.missing,
    });
  });

  it('refuses a table without the columns it was told to read', () => {
    const built = categoryStyling('rating', source, 'key', 'absent', palette);
    expect(built.ok).toBe(false);
    expect(built.diagnostics[0]?.code).toBe('appearance/missing-column');
  });
});

describe('colouring by a numeric column', () => {
  const keys = fixtureKeys;
  const source = table([
    ['key', stringColumn([keys[0] ?? '', keys[1] ?? '', keys[2] ?? ''])],
    ['width', f32Column([0, 99, Number.NaN])],
  ]);

  it('puts each value in a band and everything that is not a number in the missing rule', () => {
    const built = numericStyling('width', source, 'key', 'width', scale);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.rules).toHaveLength(5);
    expect(built.value.rules[0]?.targets).toEqual([keys[0]]);
    expect(built.value.rules[3]?.targets).toEqual([keys[1]]);
    expect(built.value.rules[4]?.targets).toEqual([keys[2]]);
    expect(built.value.rules[4]?.change.color).toEqual(grey);
  });

  it('clamps a value outside the fixed range instead of leaving the scale', () => {
    expect(bandOf(scale, -50)).toBe(0);
    expect(bandOf(scale, 1000)).toBe(scale.bands - 1);
    expect(bandOf(scale, Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it('gives a constant range the middle colour rather than dividing by zero', () => {
    const flat: NumericScale = { ...scale, min: 5, max: 5 };
    expect(bandOf(flat, 5)).toBe(1);
    expect(bandColor(flat, 1)).toEqual([0.375, 0, 0.625]);
  });

  it('refuses a range that is not finite and ordered', () => {
    const built = numericStyling('width', source, 'key', 'width', { ...scale, min: 10, max: 1 });
    expect(built.ok).toBe(false);
    expect(built.diagnostics[0]?.code).toBe('appearance/bad-scale');
  });
});

describe('the appearance commands', () => {
  const rule = (id: string, priority: number): StyleRule =>
    styleRule(id, id, [key(0)], { color: red }, priority);

  it('adds a rule, publishes the slice that changed and refuses a repeated id', () => {
    const session = featureSession();
    expect(session.dispatch('appearance.addRule', { rule: rule('a', 0) }).ok).toBe(true);
    expect(session.read(appearanceSlice).rules.map((item) => item.id)).toEqual(['a']);
    expect(session.events).toContain('appearance.addRule:appearance');
    const again = session.dispatch('appearance.addRule', { rule: rule('a', 0) });
    expect(again.ok).toBe(false);
    expect(again.diagnostics[0]?.code).toBe('appearance/repeated-rule');
  });

  it('refuses an input its schema does not accept', () => {
    const session = featureSession();
    const bad = session.dispatch('appearance.addRule', { rule: { id: 'a', name: 'a', enabled: 'yes' } });
    expect(bad.ok).toBe(false);
    expect(session.read(appearanceSlice)).toEqual(noAppearanceState);
  });

  it('removes a rule and the legend named the same', () => {
    const session = featureSession();
    const built = categoryStyling('rating', categoryTable([[key(0), 'rated']]), 'key', 'category', palette);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    session.dispatch('appearance.addRules', { rules: built.value.rules, legend: built.value.legend });
    expect(session.read(appearanceSlice).legends).toHaveLength(1);
    expect(session.dispatch('appearance.removeRule', { id: 'rating' }).ok).toBe(false);
    session.dispatch('appearance.addRule', { rule: rule('rating', 0), legend: built.value.legend });
    expect(session.dispatch('appearance.removeRule', { id: 'rating' }).ok).toBe(true);
    expect(session.read(appearanceSlice).legends).toHaveLength(0);
  });

  it('reorders the rules and refuses an order that does not name every rule once', () => {
    const session = featureSession();
    session.dispatch('appearance.addRules', { rules: [rule('a', 0), rule('b', 0)] });
    expect(session.dispatch('appearance.reorder', { ids: ['b', 'a'] }).ok).toBe(true);
    expect(session.read(appearanceSlice).rules.map((item) => item.id)).toEqual(['b', 'a']);
    const short = session.dispatch('appearance.reorder', { ids: ['b'] });
    expect(short.ok).toBe(false);
    expect(short.diagnostics[0]?.code).toBe('appearance/bad-order');
    expect(session.read(appearanceSlice).rules.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('clears every rule and legend', () => {
    const session = featureSession();
    session.dispatch('appearance.addRules', { rules: [rule('a', 0)] });
    expect(session.dispatch('appearance.clear', {}).ok).toBe(true);
    expect(session.read(appearanceSlice)).toEqual(noAppearanceState);
  });
});

describe('rule order', () => {
  it('applies a higher priority last, and the held order within one priority', () => {
    const session = featureSession();
    session.dispatch('appearance.addRules', {
      rules: [
        styleRule('low', 'low', [key(0)], { color: red }, 0),
        styleRule('high', 'high', [key(0)], { color: green }, 5),
      ],
    });
    expect(resolveAppearance(session, fixtureKeys).byKey.get(key(0))?.color).toEqual(green);
    session.dispatch('appearance.reorder', { ids: ['high', 'low'] });
    expect(resolveAppearance(session, fixtureKeys).byKey.get(key(0))?.color).toEqual(green);
    session.dispatch('appearance.setRuleEnabled', { id: 'high', enabled: false });
    expect(resolveAppearance(session, fixtureKeys).byKey.get(key(0))?.color).toEqual(red);
  });

  it('lets the later of two rules of one priority win, by held order', () => {
    const session = featureSession();
    session.dispatch('appearance.addRules', {
      rules: [
        styleRule('first', 'first', [key(0)], { color: red }, 0),
        styleRule('second', 'second', [key(0)], { color: green }, 0),
      ],
    });
    expect(resolveAppearance(session, fixtureKeys).byKey.get(key(0))?.color).toEqual(green);
    session.dispatch('appearance.reorder', { ids: ['second', 'first'] });
    expect(resolveAppearance(session, fixtureKeys).byKey.get(key(0))?.color).toEqual(red);
  });
});

describe('the appearance render hook', () => {
  it('writes the resolved colours into the bound scene', () => {
    const scene = boundScene();
    const session = featureSession();
    const installed = appearanceFeatureFor(scene.target).install;
    expect(installed).toBeDefined();
    if (installed === undefined) return;
    const stop = installed(session);
    session.dispatch('appearance.addRule', { rule: styleRule('a', 'a', [key(1)], { color: red }) });
    expect(scene.colorOf(1).slice(0, 3)).toEqual([1, 0, 0]);
    expect(scene.colorOf(0).slice(0, 3)).toEqual(stored([0.8, 0.8, 0.8]));
    stop.dispose();
  });

  it('puts an object back to the fallback when the rule that coloured it is removed', () => {
    const scene = boundScene();
    const session = featureSession();
    const stop = appearanceFeatureFor(scene.target).install?.(session);
    session.dispatch('appearance.addRule', { rule: styleRule('a', 'a', [key(1)], { color: red }) });
    session.dispatch('appearance.removeRule', { id: 'a' });
    expect(scene.colorOf(1).slice(0, 3)).toEqual(stored([0.8, 0.8, 0.8]));
    stop?.dispose();
  });

  it('writes nothing the second time the same styling is applied', () => {
    const scene = boundScene();
    const session = featureSession();
    session.dispatch('appearance.addRule', { rule: styleRule('a', 'a', [key(1)], { color: red }) });
    expect(writeAppearance(session, scene.target).ok).toBe(true);
    const again = scene.binding.applyStyles('fa-fixture', resolveAppearance(session, fixtureKeys));
    expect(again.ok && again.value.rowsWritten).toBe(0);
  });

  it('reacts to a slice it depends on and to nothing else', () => {
    const scene = boundScene();
    const session = featureSession();
    let writes = 0;
    const counted: RenderTarget = {
      styledModels: () => scene.target.styledModels(),
      applyStyles: (modelId, resolved) => {
        writes++;
        return scene.target.applyStyles(modelId, resolved);
      },
      applyChanges: (modelId, changes) => scene.target.applyChanges(modelId, changes),
    };
    const stop = appearanceFeatureFor(counted).install?.(session);
    expect(writes).toBe(1);
    session.dispatch('sets.select', { members: [key(2)] });
    expect(writes).toBe(2);
    expect(scene.colorOf(2).slice(0, 3)).toEqual(stored([1, 0.6, 0.1]));
    session.dispatch('replacement.set', { key: key(0), representationId: 'box' });
    expect(writes).toBe(2);
    stop?.dispose();
  });
});

describe('the appearance feature', () => {
  it('owns one slice and names its dependencies', () => {
    expect(appearanceFeature.id).toBe('appearance');
    expect(appearanceFeature.slice.id).toBe('appearance');
    expect(appearanceFeature.slice.version).toBe(1);
    expect(appearanceFeature.dependsOn).toEqual(['sets', 'edits']);
    expect(appearanceFeature.commands.map((item) => item.name)).toEqual([
      'appearance.addRule',
      'appearance.addRules',
      'appearance.removeRule',
      'appearance.setRuleEnabled',
      'appearance.reorder',
      'appearance.clear',
    ]);
  });

  it('describes every command input as a JSON schema a tool descriptor is built from', () => {
    for (const item of appearanceFeature.commands) expect(item.describeInput().type).toBe('object');
  });
});

describe('the appearance feature in a real session', () => {
  it('installs into Track V’s session, runs its command and publishes the slice that changed', () => {
    const { session, host } = installedSession();
    expect(host.installed('appearance')).toBe(true);
    const changed: string[] = [];
    const stop = session.subscribe((event) => changed.push(`${event.command}:${event.changed.join(',')}`));
    const ran = session.dispatch('appearance.addRule', {
      rule: styleRule('a', 'a', [key(0)], { color: red }),
    });
    expect(ran.ok).toBe(true);
    expect(session.read(appearanceSlice).rules.map((item) => item.id)).toEqual(['a']);
    expect(changed).toEqual(['appearance.addRule:appearance']);
    expect(session.dispatch('appearance.addRule', { rule: { id: 5 } }).ok).toBe(false);
    stop.dispose();
    host.dispose();
  });
});
