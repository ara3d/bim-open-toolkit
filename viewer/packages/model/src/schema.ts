import { diagnostic, failure, rootPath, success, type Diagnostic, type DiagnosticPath, type Result } from './result.js';

// A value a JSON schema can state literally.
export type JsonLiteral = string | number | boolean | null;

// The type names a JSON-schema description uses.
export type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';

// A JSON-schema-like plain object describing what a schema accepts.
// MCP tool descriptors and generated documentation are built from it; it holds no functions.
export type JsonSchema = {
  readonly type?: JsonSchemaType;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly items?: JsonSchema;
  readonly prefixItems?: readonly JsonSchema[];
  readonly additionalProperties?: JsonSchema;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly anyOf?: readonly JsonSchema[];
  readonly const?: JsonLiteral;
};

// A validator of `unknown` that reports path-addressed diagnostics and describes itself.
// `isOptional` says the value may be absent from an enclosing object, not that it may be undefined.
export type Schema<T> = {
  readonly check: (value: unknown, path: DiagnosticPath) => Result<T>;
  readonly describe: () => JsonSchema;
  readonly isOptional: boolean;
};

// A schema whose value may be absent from an enclosing object. Only `optional` produces one.
export type OptionalSchema<T> = Schema<T | undefined> & { readonly isOptional: true };

// The type a schema accepts.
export type Infer<S> = S extends Schema<infer T> ? T : never;

// The schemas of an object's properties, one per property name.
export type ObjectShape = Readonly<Record<string, Schema<unknown>>>;

type OptionalKeys<Shape extends ObjectShape> = {
  [K in keyof Shape]: Shape[K] extends { readonly isOptional: true } ? K : never;
}[keyof Shape];

type RequiredKeys<Shape extends ObjectShape> = Exclude<keyof Shape, OptionalKeys<Shape>>;

// The object type a shape accepts: a property per entry, optional where its schema accepts undefined.
export type ObjectOf<Shape extends ObjectShape> = {
  readonly [K in RequiredKeys<Shape>]: Infer<Shape[K]>;
} & {
  readonly [K in OptionalKeys<Shape>]?: Infer<Shape[K]>;
};

// The tuple type a list of schemas accepts, one element per schema.
export type TupleOf<Items extends readonly Schema<unknown>[]> = { readonly [K in keyof Items]: Infer<Items[K]> };

// Narrows a value to the type a schema accepts, once that schema's own checks have succeeded.
// TypeScript cannot prove that a heterogeneous structure walked at runtime inhabits a mapped or
// tuple type, so this is the one place where a completed check establishes the static type. It is a
// type predicate, not a cast: the caller must pass the verdict of the checks it just ran.
const narrow = <T>(_value: unknown, checksPassed: boolean): _value is T => checksPassed;

// True when the value is an array, narrowing to unknown elements rather than to `any`.
const isArray: (value: unknown) => value is readonly unknown[] = Array.isArray;

// True when the value is a non-array object, so its properties can be read.
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !isArray(value);

// True when the object itself carries the property, rather than inheriting it.
const hasOwn = (value: Readonly<Record<string, unknown>>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

// The name of what a value is, for a diagnostic that says what was found instead.
const kindOf = (value: unknown): string =>
  value === null ? 'null' : isArray(value) ? 'array' : typeof value;

// The diagnostic for a value of the wrong shape.
const wrongType = (expected: string, value: unknown, path: DiagnosticPath): Diagnostic =>
  diagnostic('schema/type', `Expected ${expected}, found ${kindOf(value)}.`, path);

// Builds a schema from its check and its description. Optional schemas are made by `optional`.
const schemaOf = <T>(
  check: (value: unknown, path: DiagnosticPath) => Result<T>,
  describe: () => JsonSchema,
  isOptional = false,
): Schema<T> => ({ check, describe, isOptional });

// Accepts a value the type predicate admits, reporting the expected type name otherwise.
const guarded = <T>(expected: JsonSchemaType, name: string, accepts: (value: unknown) => value is T): Schema<T> =>
  schemaOf(
    (value, path) => (accepts(value) ? success(value) : failure([wrongType(name, value, path)])),
    () => ({ type: expected }),
  );

// Accepts a string.
export const string = (): Schema<string> =>
  guarded('string', 'a string', (value): value is string => typeof value === 'string');

// Accepts a finite number. NaN and infinities are rejected because no document can carry them.
export const number = (): Schema<number> =>
  guarded('number', 'a finite number', (value): value is number => typeof value === 'number' && Number.isFinite(value));

// Accepts a whole number.
export const integer = (): Schema<number> =>
  guarded('integer', 'a whole number', (value): value is number => Number.isInteger(value));

// Accepts true or false.
export const boolean = (): Schema<boolean> =>
  guarded('boolean', 'a boolean', (value): value is boolean => typeof value === 'boolean');

// Accepts null and nothing else.
export const nullValue = (): Schema<null> =>
  guarded('null', 'null', (value): value is null => value === null);

// Accepts any value without inspecting it, for data this package does not interpret.
export const unknownValue = (): Schema<unknown> => schemaOf((value) => success(value), () => ({}));

// Accepts exactly the given value, which is also what the accepted result carries.
export const literal = <T extends JsonLiteral>(value: T): Schema<T> =>
  schemaOf(
    (candidate, path) =>
      candidate === value
        ? success(value)
        : failure([diagnostic('schema/literal', `Expected ${JSON.stringify(value)}.`, path)]),
    () => ({ const: value }),
  );

// Accepts a list whose every element the item schema accepts. The accepted value is a new array.
export const array = <T>(items: Schema<T>): Schema<readonly T[]> =>
  schemaOf(
    (value, path) => {
      if (!isArray(value)) return failure([wrongType('an array', value, path)]);
      const results = value.map((element, index) => items.check(element, [...path, index]));
      const diagnostics = results.flatMap((item) => item.diagnostics);
      const values = results.flatMap((item) => (item.ok ? [item.value] : []));
      return values.length === results.length ? success(values, diagnostics) : failure(diagnostics);
    },
    () => ({ type: 'array', items: items.describe() }),
  );

// Accepts a list of exactly the given length, each element checked by its own schema.
export const tuple = <Items extends readonly Schema<unknown>[]>(...items: Items): Schema<TupleOf<Items>> =>
  schemaOf(
    (value, path) => {
      if (!isArray(value)) return failure([wrongType('an array', value, path)]);
      if (value.length !== items.length) {
        const message = `Expected ${items.length} elements, found ${value.length}.`;
        return failure([diagnostic('schema/length', message, path)]);
      }
      const results = items.map((item, index) => item.check(value[index], [...path, index]));
      const diagnostics = results.flatMap((item) => item.diagnostics);
      const passed = results.every((item) => item.ok);
      return narrow<TupleOf<Items>>(value, passed) ? success(value, diagnostics) : failure(diagnostics);
    },
    () => ({ type: 'array', prefixItems: items.map((item) => item.describe()), minItems: items.length, maxItems: items.length }),
  );

// Accepts an object whose named properties their schemas accept.
// The accepted value is the input itself: properties the shape does not name are kept and ignored.
export const object = <Shape extends ObjectShape>(shape: Shape): Schema<ObjectOf<Shape>> =>
  schemaOf(
    (value, path) => {
      if (!isRecord(value)) return failure([wrongType('an object', value, path)]);
      const results = Object.entries(shape).map(([key, field]) =>
        hasOwn(value, key) || field.isOptional
          ? field.check(value[key], [...path, key])
          : failure<unknown>([diagnostic('schema/missing', `Required property "${key}" is absent.`, [...path, key])]),
      );
      const diagnostics = results.flatMap((item) => item.diagnostics);
      const passed = results.every((item) => item.ok);
      return narrow<ObjectOf<Shape>>(value, passed) ? success(value, diagnostics) : failure(diagnostics);
    },
    () => ({
      type: 'object',
      properties: Object.fromEntries(Object.entries(shape).map(([key, field]) => [key, field.describe()])),
      required: Object.entries(shape)
        .filter(([, field]) => !field.isOptional)
        .map(([key]) => key),
    }),
  );

// Accepts an object with any property names, every value checked by one schema.
export const record = <T>(values: Schema<T>): Schema<Readonly<Record<string, T>>> =>
  schemaOf(
    (value, path) => {
      if (!isRecord(value)) return failure([wrongType('an object', value, path)]);
      const results = Object.entries(value).map(
        ([key, item]) => [key, values.check(item, [...path, key])] as const,
      );
      const diagnostics = results.flatMap(([, item]) => item.diagnostics);
      const entries = results.flatMap(([key, item]) => (item.ok ? [[key, item.value] as const] : []));
      return entries.length === results.length
        ? success(Object.fromEntries(entries), diagnostics)
        : failure(diagnostics);
    },
    () => ({ type: 'object', additionalProperties: values.describe() }),
  );

// Accepts whatever the first matching alternative accepts. Alternatives are tried in order.
export const union = <T>(...alternatives: readonly Schema<T>[]): Schema<T> =>
  schemaOf(
    (value, path) => {
      const matched = alternatives.reduce<Result<T> | undefined>((found, alternative) => {
        if (found !== undefined) return found;
        const result = alternative.check(value, path);
        return result.ok ? result : undefined;
      }, undefined);
      return matched ?? failure([diagnostic('schema/union', `No alternative accepted ${kindOf(value)}.`, path)]);
    },
    () => ({ anyOf: alternatives.map((alternative) => alternative.describe()) }),
  );

// Accepts what the inner schema accepts, and also an absent or undefined value.
// This is the only combinator that makes a property of an enclosing object optional.
export const optional = <T>(inner: Schema<T>): OptionalSchema<T> => ({
  check: (value, path) => (value === undefined ? success(undefined) : inner.check(value, path)),
  describe: () => inner.describe(),
  isOptional: true,
});

// Accepts what the inner schema accepts, and also null.
export const nullable = <T>(inner: Schema<T>): Schema<T | null> =>
  schemaOf<T | null>(
    (value, path) => (value === null ? success(null) : inner.check(value, path)),
    () => ({ anyOf: [inner.describe(), { type: 'null' }] }),
    inner.isOptional,
  );

// Accepts what the inner schema accepts and the predicate also admits.
export const refine = <T>(inner: Schema<T>, predicate: (value: T) => boolean, code: string, message: string): Schema<T> =>
  schemaOf(
    (value, path) => {
      const result = inner.check(value, path);
      if (!result.ok) return result;
      return predicate(result.value)
        ? result
        : failure([...result.diagnostics, diagnostic(code, message, path)]);
    },
    () => ({ ...inner.describe(), description: message }),
    inner.isOptional,
  );

// The same schema with a description attached, for generated tool and documentation text.
export const described = <T>(inner: Schema<T>, description: string): Schema<T> =>
  schemaOf(inner.check, () => ({ ...inner.describe(), description }), inner.isOptional);

// Checks a value against a schema from the root of a document.
export const parse = <T>(schema: Schema<T>, value: unknown): Result<T> => schema.check(value, rootPath);
