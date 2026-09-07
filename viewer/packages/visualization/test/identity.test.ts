import { describe, expect, it } from 'vitest';
import { identityMatrix, type ModelData } from '../src/contracts.js';
import { ModelRegistry } from '../src/identity.js';

const model = (id: string): ModelData => ({
  ref: { id, revision: 'r1' }, coordinates: { units: 'unknown', up: 'Z', registration: 'unknown' },
  objects: ['1', '2'].map(objectId => ({ ref: { modelId: id, objectId }, sourceId: 'source', appearance: { color: [1, 1, 1], opacity: 1, visible: true }, transform: identityMatrix })),
});

describe('ModelRegistry', () => {
  it('scopes object and bidirectional source lookup to loaded models without geometry', () => {
    const registry = new ModelRegistry();
    registry.add(model('a')); registry.add(model('b'));
    expect(registry.getObject({ modelId: 'b', objectId: '1' })?.ref.modelId).toBe('b');
    expect(registry.findBySource('a', 'source')).toEqual([{ modelId: 'a', objectId: '1' }, { modelId: 'a', objectId: '2' }]);
    expect(registry.getSource({ modelId: 'a', objectId: '1' })).toBe('source');
    expect(registry.getModel('a')?.ref.revision).toBe('r1');
    expect(registry.remove('a')).toBe(true);
    expect(registry.findBySource('a', 'source')).toEqual([]);
    expect(registry.models()).toHaveLength(1);
    registry.dispose();
    expect(registry.models()).toEqual([]);
    expect(() => registry.add(model('c'))).toThrow('disposed');
  });
  it('rejects duplicate models and malformed objects atomically', () => {
    const registry = new ModelRegistry(); const input = model('a');
    registry.add(input);
    expect(() => registry.add(input)).toThrow('already registered');
    expect(() => registry.add({ ...model('b'), objects: input.objects })).toThrow('does not match');
    const duplicate = model('b');
    expect(() => registry.add({ ...duplicate, objects: [...duplicate.objects, ...duplicate.objects] })).toThrow('Duplicate object');
    expect(registry.getModel('b')).toBeUndefined();
  });
  it('owns immutable copies without freezing the caller data', () => {
    const registry = new ModelRegistry(); const input = model('a'); registry.add(input);
    expect(Object.isFrozen(input)).toBe(false);
    expect(registry.getModel('a')).not.toBe(input);
    expect(Object.isFrozen(registry.getModel('a')?.objects[0]?.transform)).toBe(true);
    expect(Object.isFrozen(registry.findBySource('a', 'source'))).toBe(true);
  });
});
