import { objectKey, type ModelData, type ObjectRecord, type ObjectRef } from './contracts.js';

/** Loaded model revisions and geometry-independent identity indexes. */
export class ModelRegistry {
  private readonly entries = new Map<string, { model: ModelData; objects: Map<string, ObjectRecord>; sources: Map<string, readonly ObjectRef[]> }>();
  private disposed = false;

  add(model: ModelData): void {
    if (this.disposed) throw new Error('Model registry is disposed');
    if (this.entries.has(model.ref.id)) throw new Error(`Model already registered: ${model.ref.id}`);
    const objects = new Map<string, ObjectRecord>();
    const sources = new Map<string, ObjectRef[]>();
    for (const input of model.objects) {
      if (input.ref.modelId !== model.ref.id) throw new Error('Object model ID does not match model');
      const key = objectKey(input.ref);
      if (objects.has(key)) throw new Error(`Duplicate object: ${key}`);
      const record: ObjectRecord = Object.freeze({
        ...input,
        ref: Object.freeze({ ...input.ref }),
        appearance: Object.freeze({ ...input.appearance, color: Object.freeze([...input.appearance.color]) as typeof input.appearance.color }),
        transform: Object.freeze([...input.transform]) as typeof input.transform,
      });
      objects.set(key, record);
      if (record.sourceId !== undefined) {
        const matches = sources.get(record.sourceId) ?? [];
        matches.push(record.ref);
        sources.set(record.sourceId, matches);
      }
    }
    for (const matches of sources.values()) Object.freeze(matches);
    this.entries.set(model.ref.id, {
      model: Object.freeze({ ...model, ref: Object.freeze({ ...model.ref }), coordinates: Object.freeze({ ...model.coordinates }), objects: Object.freeze([...objects.values()]) }),
      objects,
      sources,
    });
  }

  remove(modelId: string): boolean { return this.entries.delete(modelId); }
  getModel(modelId: string): ModelData | undefined { return this.entries.get(modelId)?.model; }
  getObject(ref: ObjectRef): ObjectRecord | undefined { return this.entries.get(ref.modelId)?.objects.get(objectKey(ref)); }
  getSource(ref: ObjectRef): string | undefined { return this.getObject(ref)?.sourceId; }
  findBySource(modelId: string, sourceId: string): readonly ObjectRef[] { return this.entries.get(modelId)?.sources.get(sourceId) ?? Object.freeze([]); }
  models(): readonly ModelData[] { return Object.freeze([...this.entries.values()].map(entry => entry.model)); }
  dispose(): void { this.entries.clear(); this.disposed = true; }
}
