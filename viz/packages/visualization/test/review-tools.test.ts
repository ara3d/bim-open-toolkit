import { describe, expect, it, vi } from 'vitest';
import { identityMatrix, type ModelData } from '../src/contracts.js';
import { createReviewTools, type ReviewToolHost, type ReviewToolResult } from '../src/review-tools.js';

const model: ModelData = {
  ref: { id: 'm', revision: 'r1' }, coordinates: { units: 'unknown', registration: 'unknown', up: 'Y' },
  objects: Array.from({ length: 120 }, (_, index) => ({ ref: { modelId: 'm', objectId: String(index) }, name: `Object ${index}`, transform: identityMatrix, appearance: { color: [1,1,1] as const, opacity: 1, visible: true } })),
};
const ref = { modelId: 'm', objectId: '0', revision: 'r1' };
const host = (): ReviewToolHost => ({ snapshot: () => ({ models: [model], selection: model.objects.map(object => object.ref) }), select: vi.fn(), fit: vi.fn(), setStyle: vi.fn() });
const body = (result: ReviewToolResult) => JSON.parse(result.content[0]!.text);

describe('bounded review tools', () => {
  it('defaults to read-only tools and pages without exposing geometry', async () => {
    const target = host(), tools = createReviewTools(target);
    expect(tools.list().map(tool => tool.name)).toEqual(['list_models', 'list_objects', 'scene_state']);
    const listed = body(await tools.call('list_objects', { modelId: 'm', revision: 'r1', offset: 10, limit: 2 }));
    expect(listed.objects.map((object: { ref: { objectId: string } }) => object.ref.objectId)).toEqual(['10', '11']);
    expect(listed.nextOffset).toBe(12); expect(listed.total).toBe(120);
    expect(listed.objects[0]).not.toHaveProperty('transform');
    expect(body(await tools.call('select', { refs: [ref] })).code).toBe('write-disabled');
    expect(target.select).not.toHaveBeenCalled();
    const state = body(await tools.call('scene_state'));
    expect(state.selection).toHaveLength(100); expect(state.selectionTruncated).toBe(true);
  });
  it('validates complete ref batches and revision tokens before invoking commands', async () => {
    const target = host(), tools = createReviewTools(target, { allowWrites: true });
    expect(body(await tools.call('select', { refs: [ref, { ...ref, objectId: 'missing' }] })).code).toBe('unknown-object');
    expect(body(await tools.call('select', { refs: [{ ...ref, revision: 'old' }] })).code).toBe('stale-reference');
    expect(target.select).not.toHaveBeenCalled();
    expect((await tools.call('select', { refs: [ref, { ...ref }] })).isError).toBe(false);
    expect(target.select).toHaveBeenCalledExactlyOnceWith([{ modelId: 'm', objectId: '0' }]);
    await tools.call('fit', { all: true }); expect(target.fit).toHaveBeenCalledWith(null);
    expect((await tools.call('fit', { all: true, refs: [ref] })).isError).toBe(true);
  });
  it('routes reversible style commands without changing model data', async () => {
    const target = host(), tools = createReviewTools(target, { allowWrites: true });
    await tools.call('set_style', { refs: [ref], color: [0,0.5,1], visible: false });
    expect(target.setStyle).toHaveBeenCalledWith([{ modelId: 'm', objectId: '0' }], { color: [0,0.5,1], visible: false });
    await tools.call('reset_style', { refs: [ref] });
    expect(target.setStyle).toHaveBeenLastCalledWith([{ modelId: 'm', objectId: '0' }], null);
    expect(model.objects[0]?.appearance).toEqual({ color: [1,1,1], opacity: 1, visible: true });
  });
  it('rejects unbounded, unknown and malformed inputs', async () => {
    const target = host(), tools = createReviewTools(target, { allowWrites: true });
    for (const [name, args] of [
      ['list_models', { limit: 101 }], ['list_models', { offset: -1 }], ['scene_state', { execute: 'anything' }],
      ['select', { refs: Array(101).fill(ref) }], ['set_style', { refs: [ref], color: [NaN,0,0] }],
      ['set_style', { refs: [ref], visible: 'yes' }], ['set_style', { refs: [ref] }], ['fit', { refs: [] }],
      ['execute', {}], ['scene_state', { oversized: 'x'.repeat(9000) }],
    ] as const) expect((await tools.call(name, args)).isError).toBe(true);
    expect(target.select).not.toHaveBeenCalled(); expect(target.fit).not.toHaveBeenCalled(); expect(target.setStyle).not.toHaveBeenCalled();
  });
  it('bounds oversized host responses and converts host failures to tool errors', async () => {
    const target = host();
    target.snapshot = () => ({ models: [{ ...model, ref: { id: 'm', revision: 'r'.repeat(256) }, objects: model.objects.map(object => ({ ...object, ref: { modelId: 'm', objectId: object.ref.objectId.padEnd(256, 'x') } })) }], selection: [] });
    const tools = createReviewTools(target, { allowWrites: true });
    const response = await tools.call('list_objects', { modelId: 'm', revision: 'r'.repeat(256), limit: 100 });
    expect(body(response).code).toBe('response-too-large'); expect(response.content[0]!.text.length).toBeLessThanOrEqual(32768);
    target.fit = () => { throw new Error('Camera unavailable'); };
    expect(body(await tools.call('fit', { all: true }))).toEqual({ code: 'host-error', message: 'Camera unavailable' });
  });
});
