import { describe, expect, it } from 'vitest';
import { identityMatrix, type ModelData, type SceneDocument } from '../src/contracts.js';
import { parseSceneDocument, restoreSceneDocument, serializeSceneDocument, validateSceneDocument } from '../src/persistence.js';

const ref = { modelId: 'model', objectId: 'object' };
const object = { ref, appearance: { color: [1, 0, 0] as const, opacity: 1, visible: true }, transform: identityMatrix };
const fixture = (): SceneDocument => ({
  schemaVersion: 1, models: [{ id: 'model', revision: 'r1' }],
  sets: [{ id: 'set', name: 'Review', members: [ref] }],
  views: [{ id: 'view', camera: { position: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0], projection: 'perspective', zoom: 1 }, selection: [ref], rules: [{ id: 'rule', members: [ref], style: { opacity: 0.5 } }] }],
  layers: [{ id: 'layer', enabled: true, operations: [
    { kind: 'add', object: { ...object, ref: { ...ref, objectId: 'added' } } },
    { kind: 'transform', ref, transform: identityMatrix }, { kind: 'style', ref, style: { visible: false } }, { kind: 'delete', ref },
  ] }],
});
const model = (revision = 'r1'): ModelData => ({ ref: { id: 'model', revision }, coordinates: { units: 'unknown', up: 'Y', registration: 'unknown' }, objects: [object] });

describe('scene persistence', () => {
  it('round trips all v1 operation variants and detaches mutable caller data', () => {
    const input = fixture();
    const result = parseSceneDocument(serializeSceneDocument(input));
    expect(result).toEqual({ ok: true, value: input, diagnostics: [] });
    const validated = validateSceneDocument(input);
    if (!validated.ok) throw new Error('validation failed');
    expect(validated.value).not.toBe(input);
    expect(validated.value.layers).not.toBe(input.layers);
  });

  it.each([
    ['unsupported version', { ...fixture(), schemaVersion: 2 }],
    ['runtime payload', { ...fixture(), meshes: [] }],
    ['missing field', { schemaVersion: 1 }],
    ['wrong container', []],
    ['duplicate model ID', { ...fixture(), models: [{ id: 'x', revision: '1' }, { id: 'x', revision: '2' }] }],
    ['infinite style', { ...fixture(), layers: [{ id: 'x', enabled: true, operations: [{ kind: 'style', ref, style: { opacity: Infinity } }] }] }],
    ['short matrix', { ...fixture(), layers: [{ id: 'x', enabled: true, operations: [{ kind: 'transform', ref, transform: [1] }] }] }],
    ['unknown edit kind', { ...fixture(), layers: [{ id: 'x', enabled: true, operations: [{ kind: 'replace', ref }] }] }],
    ['unknown camera projection', { ...fixture(), views: [{ ...fixture().views[0], camera: { ...fixture().views[0].camera, projection: 'fisheye' } }] }],
    ['sparse tuple', { ...fixture(), views: [{ ...fixture().views[0], camera: { ...fixture().views[0].camera, position: Array(3) } }] }],
    ['NaN color', { ...fixture(), layers: [{ id: 'x', enabled: true, operations: [{ kind: 'style', ref, style: { color: [0, NaN, 1] } }] }] }],
  ])('rejects %s', (_name, input) => {
    expect(validateSceneDocument(input).ok).toBe(false);
    expect(() => serializeSceneDocument(input as SceneDocument)).toThrow();
  });

  it('rejects invalid JSON and accessor properties without invoking them', () => {
    expect(parseSceneDocument('{')).toMatchObject({ ok: false, diagnostics: [{ code: 'invalid-json' }] });
    let invoked = false;
    const input = { ...fixture(), get runtime() { invoked = true; return {}; } };
    expect(validateSceneDocument(input).ok).toBe(false);
    expect(invoked).toBe(false);
  });

  it('restores through host resolution and preserves saved data', async () => {
    const document = fixture();
    const result = await restoreSceneDocument(document, async reference => {
      expect(reference).toEqual(document.models[0]);
      return model();
    });
    expect(result).toEqual({ ok: true, value: { document, models: [model()] }, diagnostics: [] });
  });

  it('reports missing models, changed revisions and deduplicated unresolved objects', async () => {
    const document = { ...fixture(), models: [...fixture().models, { id: 'missing', revision: '1' }] };
    const result = await restoreSceneDocument(document, async reference => reference.id === 'missing' ? undefined : { ...model('r2'), objects: [] });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.map(d => d.code)).toEqual(['revision-mismatch', 'missing-model', 'unresolved-object']);
    expect(result.diagnostics[2].ref).toEqual(ref);
  });

  it('treats added objects as resolvable and resolver failures as diagnostics', async () => {
    const document = fixture();
    const result = await restoreSceneDocument({ ...document, sets: [{ id: 'added', name: 'Added', members: [{ ...ref, objectId: 'added' }] }], views: [], layers: [{ ...document.layers[0], operations: [document.layers[0].operations[0]] }] }, async () => { throw new Error('offline'); });
    expect(result.diagnostics.map(d => d.code)).toEqual(['missing-model']);
  });

  it('rejects wrong model identities rather than binding objects to another model', async () => {
    const result = await restoreSceneDocument(fixture(), async () => ({ ...model(), ref: { id: 'wrong', revision: 'r1' } }));
    expect(result.diagnostics.map(d => d.code)).toEqual(['missing-model', 'unresolved-object']);
  });

  it('cancels even when the host resolver never settles', async () => {
    const controller = new AbortController();
    const promise = restoreSceneDocument(fixture(), (_reference, signal) => {
      expect(signal).toBe(controller.signal);
      return new Promise(() => {});
    }, { signal: controller.signal });
    controller.abort();
    expect(await promise).toMatchObject({ ok: false, diagnostics: [{ code: 'cancelled' }] });
  });

  it('does not call resolvers for pre-aborted or malformed requests', async () => {
    const controller = new AbortController();
    controller.abort();
    const resolver = async () => { throw new Error('must not be called'); };
    expect(await restoreSceneDocument(fixture(), resolver, { signal: controller.signal })).toMatchObject({ ok: false, diagnostics: [{ code: 'cancelled' }] });
    expect(await restoreSceneDocument({ ...fixture(), schemaVersion: 2 } as unknown as SceneDocument, resolver)).toMatchObject({ ok: false, diagnostics: [{ code: 'invalid-document' }] });
  });
});
