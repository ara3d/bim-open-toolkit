import { objectKey, type ObjectKey, type ObjectRef } from './identity.js';

// A set of objects held by key. Iteration order is insertion order, so results are reproducible.
export type ObjectSet = ReadonlySet<ObjectKey>;

// A set a user named and saved. `id` is stable across sessions; `name` is what the user reads.
export type NamedSet = {
  readonly id: string;
  readonly name: string;
  readonly members: ObjectSet;
};

// The set with no members. It is shared, so an empty result costs no allocation.
export const emptySet: ObjectSet = new Set<ObjectKey>();

// A set of the given keys.
export const setOf = (keys: Iterable<ObjectKey>): ObjectSet => new Set(keys);

// A set of the objects the references denote.
export const setOfRefs = (refs: Iterable<ObjectRef>): ObjectSet => {
  const keys = new Set<ObjectKey>();
  for (const ref of refs) keys.add(objectKey(ref));
  return keys;
};

// The number of members.
export const setSize = (set: ObjectSet): number => set.size;

// True when the set has no members.
export const isEmptySet = (set: ObjectSet): boolean => set.size === 0;

// True when the key is a member.
export const contains = (set: ObjectSet, key: ObjectKey): boolean => set.has(key);

// True when the object the reference denotes is a member.
export const containsRef = (set: ObjectSet, ref: ObjectRef): boolean => set.has(objectKey(ref));

// The members in insertion order.
export const setKeys = (set: ObjectSet): readonly ObjectKey[] => [...set];

// The set of members of either set. An empty operand is returned as the other set unchanged.
export const unionSets = (a: ObjectSet, b: ObjectSet): ObjectSet => {
  if (a.size === 0) return b;
  if (b.size === 0) return a;
  const result = new Set(a);
  for (const key of b) result.add(key);
  return result;
};

// The set of members of both sets. The smaller set is iterated.
export const intersectSets = (a: ObjectSet, b: ObjectSet): ObjectSet => {
  if (a.size === 0 || b.size === 0) return emptySet;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  const result = new Set<ObjectKey>();
  for (const key of small) if (large.has(key)) result.add(key);
  return result;
};

// The set of members of the first set that are not members of the second.
export const differenceSets = (a: ObjectSet, b: ObjectSet): ObjectSet => {
  if (a.size === 0) return emptySet;
  if (b.size === 0) return a;
  const result = new Set<ObjectKey>();
  for (const key of a) if (!b.has(key)) result.add(key);
  return result;
};

// The set of members of exactly one of the two sets.
export const symmetricDifferenceSets = (a: ObjectSet, b: ObjectSet): ObjectSet =>
  unionSets(differenceSets(a, b), differenceSets(b, a));

// The set of members of any of the sets.
export const unionAll = (sets: Iterable<ObjectSet>): ObjectSet => {
  let result = emptySet;
  for (const set of sets) result = unionSets(result, set);
  return result;
};

// The set of members of every set. No sets at all intersect to the empty set, not to everything.
export const intersectAll = (sets: Iterable<ObjectSet>): ObjectSet => {
  let result: ObjectSet | undefined = undefined;
  for (const set of sets) result = result === undefined ? set : intersectSets(result, set);
  return result ?? emptySet;
};

// The set with one more member. The input is returned unchanged when it already has the key.
export const addToSet = (set: ObjectSet, key: ObjectKey): ObjectSet =>
  set.has(key) ? set : new Set(set).add(key);

// The set without one member. The input is returned unchanged when it does not have the key.
export const removeFromSet = (set: ObjectSet, key: ObjectKey): ObjectSet => {
  if (!set.has(key)) return set;
  const result = new Set(set);
  result.delete(key);
  return result;
};

// The set with the key removed when it is a member and added when it is not.
export const toggleInSet = (set: ObjectSet, key: ObjectKey): ObjectSet =>
  set.has(key) ? removeFromSet(set, key) : addToSet(set, key);

// The members the predicate keeps.
export const filterSet = (set: ObjectSet, predicate: (key: ObjectKey) => boolean): ObjectSet => {
  const result = new Set<ObjectKey>();
  for (const key of set) if (predicate(key)) result.add(key);
  return result;
};

// True when every member of the first set is a member of the second.
export const isSubsetOf = (a: ObjectSet, b: ObjectSet): boolean => {
  if (a.size > b.size) return false;
  for (const key of a) if (!b.has(key)) return false;
  return true;
};

// True when both sets have exactly the same members, whatever order they were built in.
export const equalSets = (a: ObjectSet, b: ObjectSet): boolean => a.size === b.size && isSubsetOf(a, b);

// A named set of the given members.
export const namedSet = (id: string, name: string, members: ObjectSet): NamedSet => ({ id, name, members });
