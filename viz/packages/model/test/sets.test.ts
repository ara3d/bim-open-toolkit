import { describe, expect, it } from 'vitest';
import { objectKey, type ObjectRef } from '../src/identity.js';
import {
  addToSet, contains, containsRef, differenceSets, emptySet, equalSets, filterSet, intersectAll,
  intersectSets, isEmptySet, isSubsetOf, namedSet, removeFromSet, setKeys, setOf, setOfRefs, setSize,
  symmetricDifferenceSets, toggleInSet, unionAll, unionSets,
} from '../src/sets.js';

const ref = (objectId: string): ObjectRef => ({ modelId: 'm', revision: 'r1', objectId });
const abc = setOf(['a', 'b', 'c']);
const bcd = setOf(['b', 'c', 'd']);

describe('object sets', () => {
  it('builds a set from keys and from references', () => {
    expect(setKeys(setOf(['a', 'b', 'a']))).toEqual(['a', 'b']);
    expect(setKeys(setOfRefs([ref('1'), ref('2')]))).toEqual([objectKey(ref('1')), objectKey(ref('2'))]);
    expect(setSize(abc)).toBe(3);
    expect(isEmptySet(emptySet)).toBe(true);
  });

  it('answers membership by key and by reference', () => {
    const set = setOfRefs([ref('1')]);
    expect(contains(set, objectKey(ref('1')))).toBe(true);
    expect(containsRef(set, ref('1'))).toBe(true);
    expect(containsRef(set, ref('2'))).toBe(false);
  });

  it('combines sets', () => {
    expect(setKeys(unionSets(abc, bcd))).toEqual(['a', 'b', 'c', 'd']);
    expect(setKeys(intersectSets(abc, bcd))).toEqual(['b', 'c']);
    expect(setKeys(differenceSets(abc, bcd))).toEqual(['a']);
    expect(setKeys(symmetricDifferenceSets(abc, bcd))).toEqual(['a', 'd']);
  });

  it('returns an operand unchanged when the other is empty, so a no-op allocates nothing', () => {
    expect(unionSets(abc, emptySet)).toBe(abc);
    expect(unionSets(emptySet, abc)).toBe(abc);
    expect(differenceSets(abc, emptySet)).toBe(abc);
    expect(intersectSets(abc, emptySet)).toBe(emptySet);
  });

  it('combines many sets, and intersects nothing to the empty set', () => {
    expect(setKeys(unionAll([setOf(['a']), setOf(['b'])]))).toEqual(['a', 'b']);
    expect(setKeys(intersectAll([abc, bcd, setOf(['c', 'd'])]))).toEqual(['c']);
    expect(intersectAll([])).toBe(emptySet);
    expect(unionAll([])).toBe(emptySet);
  });

  it('adds, removes and toggles one member without changing the input', () => {
    const added = addToSet(abc, 'd');
    expect(setKeys(added)).toEqual(['a', 'b', 'c', 'd']);
    expect(setKeys(abc)).toEqual(['a', 'b', 'c']);
    expect(addToSet(abc, 'a')).toBe(abc);
    expect(removeFromSet(abc, 'z')).toBe(abc);
    expect(setKeys(removeFromSet(abc, 'b'))).toEqual(['a', 'c']);
    expect(setKeys(toggleInSet(abc, 'b'))).toEqual(['a', 'c']);
    expect(setKeys(toggleInSet(abc, 'd'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps the members a predicate admits', () => {
    expect(setKeys(filterSet(abc, (key) => key !== 'b'))).toEqual(['a', 'c']);
  });

  it('compares sets by membership, not by order', () => {
    expect(isSubsetOf(setOf(['b', 'c']), abc)).toBe(true);
    expect(isSubsetOf(bcd, abc)).toBe(false);
    expect(equalSets(setOf(['c', 'b', 'a']), abc)).toBe(true);
    expect(equalSets(abc, bcd)).toBe(false);
  });

  it('names a set so it can be saved and shown', () => {
    expect(namedSet('s1', 'Fire doors', abc)).toEqual({ id: 's1', name: 'Fire doors', members: abc });
  });
});
