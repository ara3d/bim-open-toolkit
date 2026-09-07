import { describe, expect, it } from 'vitest';
import { composeAppearance, createCategoricalColorMap, createNumericColorMap } from '../src/appearance.js';
import { identityMatrix, type Color, type ObjectRecord } from '../src/contracts.js';

const red: Color = [1, 0, 0];
const blue: Color = [0, 0, 1];
const gray: Color = [0.5, 0.5, 0.5];
const object = (modelId: string, visible = true): ObjectRecord => ({
  ref: { modelId, objectId: 'same' }, transform: identityMatrix,
  appearance: { color: gray, opacity: 1, visible },
});

describe('color maps', () => {
  it('distinguishes typed categories and includes a missing legend', () => {
    const map = createCategoricalColorMap([{ value: 1, label: 'Number', color: red }, { value: '1', label: 'Text', color: blue }], gray);
    expect(map.color(1)).toEqual(red);
    expect(map.color('1')).toEqual(blue);
    for (const value of [null, undefined, NaN, 'absent']) expect(map.color(value)).toEqual(gray);
    expect(map.legend.missing.color).toEqual(gray);
    expect(() => createCategoricalColorMap([{ value: 1, label: '', color: red }, { value: 1, label: '', color: blue }], gray)).toThrow('Duplicate');
  });
  it('interpolates, clamps and handles missing and constant values', () => {
    const options = { min: 0, max: 10, low: red, high: blue, missingColor: gray };
    const map = createNumericColorMap(options);
    expect(map.color(5)).toEqual([0.5, 0, 0.5]);
    expect(map.color(-1)).toEqual(red);
    expect(map.color(11)).toEqual(blue);
    for (const value of [null, undefined, NaN, Infinity]) expect(map.color(value)).toEqual(gray);
    expect(createNumericColorMap({ ...options, max: 0 }).color(0)).toEqual([0.5, 0, 0.5]);
    expect(() => createNumericColorMap({ ...options, min: 11 })).toThrow();
  });
});

describe('appearance composition', () => {
  it('composes ordered styles, view filter and selection without changing base', () => {
    const objects = [object('a'), object('b'), object('c', false)];
    const before = structuredClone(objects);
    const result = composeAppearance(objects, {
      rules: [
        { id: 'first', members: objects.map(o => o.ref), style: { color: red, opacity: 0.5 } },
        { id: 'second', members: [objects[0]!.ref], style: { color: blue } },
      ], visible: [objects[0]!.ref, objects[2]!.ref], selection: objects.map(o => o.ref), selectionColor: gray,
    });
    expect(result.map(o => o.appearance)).toEqual([
      { color: gray, opacity: 0.5, visible: true },
      { color: red, opacity: 0.5, visible: false },
      { color: red, opacity: 0.5, visible: false },
    ]);
    expect(objects).toEqual(before);
    expect(composeAppearance(objects, { visible: [] }).every(o => !o.appearance.visible)).toBe(true);
    expect(composeAppearance(objects, { rules: [
      { id: 'hide', members: [objects[0]!.ref], style: { visible: false } },
      { id: 'show', members: [objects[0]!.ref], style: { visible: true } },
    ] })[0]!.appearance.visible).toBe(false);
  });
});
