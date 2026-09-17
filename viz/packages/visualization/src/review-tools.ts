import { objectKey, type Appearance, type ModelData, type ObjectRef } from './contracts.js';

export type ReviewToolHost = {
  snapshot(): { readonly models: readonly ModelData[]; readonly selection: readonly ObjectRef[] };
  select(refs: readonly ObjectRef[]): void | Promise<void>;
  fit(refs: readonly ObjectRef[] | null): void | Promise<void>;
  /** A reversible host-owned style layer; null removes overrides for these refs. */
  setStyle(refs: readonly ObjectRef[], style: Pick<Partial<Appearance>, 'color' | 'visible'> | null): void | Promise<void>;
};
export type ReviewToolResult = { readonly content: readonly { readonly type: 'text'; readonly text: string }[]; readonly isError: boolean };
export type ReviewToolDescriptor = { readonly name: string; readonly description: string; readonly inputSchema: Record<string, unknown>; readonly annotations: { readonly readOnlyHint: boolean } };
type ToolRef = ObjectRef & { readonly revision: string };
const textSchema = { type: 'string', minLength: 1, maxLength: 256 };
const refSchema = { type: 'object', additionalProperties: false, required: ['modelId', 'objectId', 'revision'], properties: { modelId: textSchema, objectId: textSchema, revision: textSchema } };
const refsSchema = { type: 'array', maxItems: 100, items: refSchema };
const paging = { offset: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 100 } };
const descriptor = (name: string, description: string, readOnlyHint: boolean, properties: Record<string, unknown>, required: string[] = []): ReviewToolDescriptor => ({
  name, description, annotations: { readOnlyHint }, inputSchema: { type: 'object', additionalProperties: false, properties, required },
});
const descriptors = [
  descriptor('list_models', 'List loaded model revisions, with bounded paging.', true, paging),
  descriptor('list_objects', 'List geometry-free object summaries for one current model revision.', true, { ...paging, modelId: textSchema, revision: textSchema }, ['modelId', 'revision']),
  descriptor('scene_state', 'Get model/object totals and at most 100 selected references.', true, {}),
  descriptor('select', 'Replace selection with at most 100 explicit current references.', false, { refs: refsSchema }, ['refs']),
  descriptor('fit', 'Fit explicit current references, or fit all when all=true.', false, { refs: refsSchema, all: { type: 'boolean' } }),
  descriptor('set_style', 'Set temporary color/visibility overrides on explicit references.', false, { refs: refsSchema, color: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number', minimum: 0, maximum: 1 } }, visible: { type: 'boolean' } }, ['refs']),
  descriptor('reset_style', 'Remove temporary style overrides and restore host base appearance.', false, { refs: refsSchema }, ['refs']),
];

class ToolError extends Error { constructor(readonly code: string, message: string) { super(message); } }
const fail = (code: string, message: string): never => { throw new ToolError(code, message); };
const result = (value: unknown, isError = false): ReviewToolResult => {
  const text = JSON.stringify(value);
  return text.length <= 32768 ? { content: [{ type: 'text', text }], isError }
    : { content: [{ type: 'text', text: '{"code":"response-too-large","message":"Request a smaller page."}' }], isError: true };
};
function record(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('invalid-input', 'Expected a plain object');
  const fields = value as Record<string, unknown>;
  if (Object.keys(fields).some(key => !allowed.includes(key))) fail('invalid-input', 'Unexpected argument');
  return fields;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 256) fail('invalid-input', 'Expected a nonempty string of at most 256 characters');
  return value as string;
}
function page(args: Record<string, unknown>) {
  const offset = args.offset ?? 0, limit = args.limit ?? 25;
  if (!Number.isSafeInteger(offset) || (offset as number) < 0 || !Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 100) fail('invalid-input', 'Invalid page bounds');
  return { offset: offset as number, limit: limit as number };
}

/** Bounded MCP-compatible descriptors/results; transport and authorization remain host-owned. */
export function createReviewTools(host: ReviewToolHost, options: { readonly allowWrites?: boolean } = {}) {
  return {
    list(): readonly ReviewToolDescriptor[] { return descriptors.filter(item => item.annotations.readOnlyHint || options.allowWrites === true).map(item => structuredClone(item)); },
    async call(name: string, input: unknown = {}): Promise<ReviewToolResult> {
      try {
        const descriptor = descriptors.find(item => item.name === name);
        if (!descriptor) fail('unknown-tool', 'Unknown review tool');
        if (!descriptor!.annotations.readOnlyHint && options.allowWrites !== true) fail('write-disabled', 'This host has not enabled scene-changing tools');
        const serialized = JSON.stringify(input);
        if (!serialized || serialized.length > 8192) fail('invalid-input', 'Request exceeds 8192 characters');
        const args = record(input, Object.keys(descriptor!.inputSchema.properties as object));
        const snapshot = host.snapshot();
        const modelById = new Map(snapshot.models.map(model => [model.ref.id, model]));
        const requireModel = (id: unknown, revision: unknown) => {
          const model = modelById.get(text(id));
          if (!model) fail('unknown-model', 'Model is not loaded');
          if (model!.ref.revision !== text(revision)) fail('stale-reference', 'Model revision changed; list current references');
          return model!;
        };
        const refs = (): readonly ObjectRef[] => {
          if (!Array.isArray(args.refs) || args.refs.length > 100) fail('invalid-input', 'refs must contain at most 100 references');
          const found = new Map<string, ObjectRef>(), indexes = new Map<ModelData, Set<string>>();
          for (const value of args.refs as unknown[]) {
            const ref = record(value, ['modelId', 'objectId', 'revision']);
            const model = requireModel(ref.modelId, ref.revision), objectId = text(ref.objectId);
            let ids = indexes.get(model); if (!ids) { ids = new Set(model.objects.map(object => object.ref.objectId)); indexes.set(model, ids); }
            if (!ids.has(objectId)) fail('unknown-object', 'Object is absent from the current model revision');
            const item = { modelId: model.ref.id, objectId }; found.set(objectKey(item), item);
          }
          return [...found.values()];
        };
        if (name === 'list_models') {
          const { offset, limit } = page(args);
          return result({ models: snapshot.models.slice(offset, offset + limit).map(model => ({ id: model.ref.id, revision: model.ref.revision, objectCount: model.objects.length })), total: snapshot.models.length, nextOffset: offset + limit < snapshot.models.length ? offset + limit : null });
        }
        if (name === 'list_objects') {
          const model = requireModel(args.modelId, args.revision), { offset, limit } = page(args);
          return result({ objects: model.objects.slice(offset, offset + limit).map(object => ({ ref: { ...object.ref, revision: model.ref.revision } satisfies ToolRef, ...(object.name === undefined ? {} : { name: object.name.slice(0, 128) }) })), total: model.objects.length, nextOffset: offset + limit < model.objects.length ? offset + limit : null });
        }
        if (name === 'scene_state') return result({ modelCount: snapshot.models.length, objectCount: snapshot.models.reduce((sum, model) => sum + model.objects.length, 0), selection: snapshot.selection.slice(0, 100), selectionCount: snapshot.selection.length, selectionTruncated: snapshot.selection.length > 100 });
        if (name === 'fit' && args.all === true) {
          if (args.refs !== undefined) fail('invalid-input', 'Use all=true or refs, not both');
          await host.fit(null); return result({ ok: true, scope: 'all' });
        }
        if (name === 'fit' && args.all !== undefined) fail('invalid-input', 'all must be true, or omit it and supply refs');
        const targets = refs();
        if (name === 'select') await host.select(targets);
        else if (name === 'fit') { if (!targets.length) fail('invalid-input', 'Fit needs at least one reference'); await host.fit(targets); }
        else if (name === 'reset_style') await host.setStyle(targets, null);
        else if (name === 'set_style') {
          if (args.color === undefined && args.visible === undefined) fail('invalid-input', 'Supply color or visible');
          if (args.visible !== undefined && typeof args.visible !== 'boolean') fail('invalid-input', 'visible must be boolean');
          if (args.color !== undefined && (!Array.isArray(args.color) || args.color.length !== 3 || !args.color.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1))) fail('invalid-input', 'color must contain three finite numbers in [0,1]');
          await host.setStyle(targets, { ...(args.visible === undefined ? {} : { visible: args.visible as boolean }), ...(args.color === undefined ? {} : { color: [...args.color as number[]] as [number, number, number] }) });
        }
        return result({ ok: true, count: targets.length });
      } catch (error) {
        return result({ code: error instanceof ToolError ? error.code : 'host-error', message: (error instanceof Error ? error.message : 'Tool execution failed').slice(0, 512) }, true);
      }
    },
  };
}
