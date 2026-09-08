import { describe, expect, it } from 'vitest';
import { formatPath, type Result } from '../src/result.js';
import {
  array, boolean, described, integer, literal, nullValue, nullable, number, object, optional, parse,
  record, refine, string, tuple, union, unknownValue, type Infer, type Schema,
} from '../src/schema.js';

const paths = <T>(result: Result<T>): readonly string[] => result.diagnostics.map((item) => formatPath(item.path));
const codes = <T>(result: Result<T>): readonly string[] => result.diagnostics.map((item) => item.code);

const point = object({ x: number(), y: number(), label: optional(string()) });

describe('schema primitives', () => {
  it('accepts values of the stated type and reports what it found instead', () => {
    expect(parse(string(), 'a')).toEqual({ ok: true, value: 'a', diagnostics: [] });
    expect(parse(boolean(), true).ok).toBe(true);
    const failed = parse(string(), 3);
    expect(failed.ok).toBe(false);
    expect(codes(failed)).toEqual(['schema/type']);
    expect(failed.diagnostics[0]?.message).toBe('Expected a string, found number.');
  });

  it('rejects numbers no document can carry', () => {
    expect(parse(number(), Number.NaN).ok).toBe(false);
    expect(parse(number(), Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(parse(number(), 1.5).ok).toBe(true);
  });

  it('separates whole numbers from numbers', () => {
    expect(parse(integer(), 3).ok).toBe(true);
    expect(parse(integer(), 3.5).ok).toBe(false);
  });

  it('accepts null only where it is allowed', () => {
    expect(parse(nullValue(), null).ok).toBe(true);
    expect(parse(string(), null).ok).toBe(false);
    expect(parse(nullable(string()), null)).toEqual({ ok: true, value: null, diagnostics: [] });
  });

  it('takes any value where nothing is interpreted', () => {
    expect(parse(unknownValue(), { anything: 1 }).ok).toBe(true);
  });

  it('accepts exactly one literal value', () => {
    expect(parse(literal('door'), 'door')).toEqual({ ok: true, value: 'door', diagnostics: [] });
    expect(codes(parse(literal('door'), 'window'))).toEqual(['schema/literal']);
  });
});

describe('schema composition', () => {
  it('checks every element of an array and addresses failures by index', () => {
    expect(parse(array(number()), [1, 2])).toEqual({ ok: true, value: [1, 2], diagnostics: [] });
    const failed = parse(array(number()), [1, 'x', 3]);
    expect(failed.ok).toBe(false);
    expect(paths(failed)).toEqual(['[1]']);
  });

  it('checks a tuple by position and by length', () => {
    const vec = tuple(number(), number(), number());
    expect(parse(vec, [1, 2, 3]).ok).toBe(true);
    expect(codes(parse(vec, [1, 2]))).toEqual(['schema/length']);
    expect(paths(parse(vec, [1, 'x', 3]))).toEqual(['[1]']);
  });

  it('checks named properties and addresses failures by name', () => {
    const good = parse(point, { x: 1, y: 2 });
    expect(good.ok).toBe(true);
    const failed = parse(point, { x: 1, y: 'up' });
    expect(paths(failed)).toEqual(['y']);
  });

  it('reports an absent required property as missing, not as the wrong type', () => {
    const failed = parse(point, { x: 1 });
    expect(codes(failed)).toEqual(['schema/missing']);
    expect(paths(failed)).toEqual(['y']);
  });

  it('lets an optional property be absent but still checks it when present', () => {
    expect(parse(point, { x: 1, y: 2 }).ok).toBe(true);
    expect(parse(point, { x: 1, y: 2, label: 'a' }).ok).toBe(true);
    expect(paths(parse(point, { x: 1, y: 2, label: 7 }))).toEqual(['label']);
  });

  it('keeps properties the shape does not name', () => {
    const result = parse(point, { x: 1, y: 2, extra: 'kept' });
    expect(result.ok && result.value).toEqual({ x: 1, y: 2, extra: 'kept' });
  });

  it('checks every value of a record and addresses failures by key', () => {
    expect(parse(record(integer()), { a: 1, b: 2 })).toEqual({ ok: true, value: { a: 1, b: 2 }, diagnostics: [] });
    expect(paths(parse(record(integer()), { a: 1, b: 'x' }))).toEqual(['b']);
  });

  it('addresses a failure deep inside a document', () => {
    const document = object({ rooms: array(object({ area: number() })) });
    const failed = parse(document, { rooms: [{ area: 1 }, { area: 'wide' }] });
    expect(paths(failed)).toEqual(['rooms[1].area']);
  });

  it('takes the first alternative that accepts the value', () => {
    const size = union(literal('small'), literal('large'));
    expect(parse(size, 'large')).toEqual({ ok: true, value: 'large', diagnostics: [] });
    expect(codes(parse(size, 'huge'))).toEqual(['schema/union']);
  });

  it('accepts an absent value only where the schema is optional', () => {
    expect(parse(optional(string()), undefined)).toEqual({ ok: true, value: undefined, diagnostics: [] });
    expect(optional(string()).isOptional).toBe(true);
    expect(string().isOptional).toBe(false);
  });

  it('adds a condition the inner schema does not express', () => {
    const positive = refine(number(), (value) => value > 0, 'x/positive', 'Must be greater than zero.');
    expect(parse(positive, 2).ok).toBe(true);
    expect(codes(parse(positive, -2))).toEqual(['x/positive']);
    expect(codes(parse(positive, 'x'))).toEqual(['schema/type']);
  });
});

describe('schema description', () => {
  it('describes an object as properties with the required ones named', () => {
    expect(point.describe()).toEqual({
      type: 'object',
      properties: { x: { type: 'number' }, y: { type: 'number' }, label: { type: 'string' } },
      required: ['x', 'y'],
    });
  });

  it('describes collections by their element schemas', () => {
    expect(array(string()).describe()).toEqual({ type: 'array', items: { type: 'string' } });
    expect(record(integer()).describe()).toEqual({ type: 'object', additionalProperties: { type: 'integer' } });
    expect(tuple(number(), string()).describe()).toEqual({
      type: 'array',
      prefixItems: [{ type: 'number' }, { type: 'string' }],
      minItems: 2,
      maxItems: 2,
    });
  });

  it('describes choices as alternatives', () => {
    expect(union(literal(1), literal(2)).describe()).toEqual({ anyOf: [{ const: 1 }, { const: 2 }] });
    expect(nullable(string()).describe()).toEqual({ anyOf: [{ type: 'string' }, { type: 'null' }] });
  });

  it('carries text for generated tool descriptors', () => {
    expect(described(string(), 'The object id.').describe()).toEqual({ type: 'string', description: 'The object id.' });
    expect(refine(integer(), (v) => v >= 0, 'x/nonneg', 'Not negative.').describe()).toEqual({
      type: 'integer',
      description: 'Not negative.',
    });
  });
});

describe('schema types', () => {
  it('infers the accepted type of a shape', () => {
    const schema = object({ id: string(), count: integer(), tag: optional(string()) });
    const value: Infer<typeof schema> = { id: 'a', count: 1 };
    expect(value.tag).toBeUndefined();
    const withTag: Infer<typeof schema> = { id: 'a', count: 1, tag: 't' };
    expect(withTag.tag).toBe('t');
    expect(parse(schema, withTag).ok).toBe(true);
  });

  it('infers the accepted type of a tuple', () => {
    const vec: Schema<readonly [number, number, number]> = tuple(number(), number(), number());
    const result = parse(vec, [1, 2, 3]);
    expect(result.ok && result.value[2]).toBe(3);
  });
});
