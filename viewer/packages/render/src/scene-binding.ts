// The composition: models bound to a viewer-core scene, and the operations that cross modules.
//
// This is the only stateful thing in the package. It owns scene membership - which groups are in
// the `ViewerScene` - and borrows everything else. Adding a model builds its instance table and
// adds its groups; removing one takes them out again. Everything else here is a short piece of
// wiring between modules that are each pure on their own: resolved styles become bulk column
// writes, renderer hits become object hits, dirty ranges become one publish per touched group.
//
// It needs no WebGL context. `ViewerScene` is bookkeeping; the mirror that draws it is the host's.

import { groupBounds, type InstancedGroup, type ViewerScene } from '@ara3d/viewer-core';
import {
  colorStride,
  diagnostic,
  emptyBounds,
  failure,
  isVisible,
  styleOf,
  success,
  unionBounds,
  type Bounds,
  type Geometry,
  type ObjectKey,
  type ResolvedStyles,
  type Result,
  type Table,
} from '@bim-open-toolkit/model';
import {
  buildInstanceTable,
  defaultTableOptions,
  rowsOfKey,
  type InstanceTable,
  type InstanceTableOptions,
} from './instance-table.js';
import {
  defaultPickOptions,
  nearestHit,
  resolveHit,
  type ObjectHit,
  type ObjectHitSource,
  type PickOptions,
  type Ray,
  type RaycastHit,
} from './picking.js';
import { sceneStatistics, type SceneStatistics } from './timing.js';
import {
  applyUpdates,
  dirtySets,
  publishDirty,
  writeColors,
  writeOpacity,
  writeVisibility,
  type DirtySets,
  type PublishReport,
  type UpdateOptions,
  type UpdateReport,
} from './updates.js';

// One model in the scene, with the dirty ranges accumulated since the last publish.
export type BoundModel = {
  readonly modelId: string;
  readonly geometry: Geometry;
  readonly table: InstanceTable;
  readonly dirty: DirtySets;
};

// A renderer hit that says which model it came from, because group ordinals are per model.
export type ModelRaycastHit = RaycastHit & { readonly modelId: string };

// Where a group sits: which model, and which ordinal inside it. A renderer adapter uses this to
// turn its own hits into `ModelRaycastHit`.
export type GroupLocation = { readonly modelId: string; readonly group: number };

// Models bound to a viewer-core scene.
//
// `requestRender` is called after every change that could alter the picture, once per operation and
// never once per object.
export class SceneBinding {
  private readonly bound = new Map<string, BoundModel>();
  private readonly locations = new Map<InstancedGroup, GroupLocation>();
  private closed = false;

  constructor(
    private readonly scene: ViewerScene,
    private readonly requestRender: () => void = () => undefined,
  ) {}

  // The models in the scene, in the order they were added.
  get models(): readonly BoundModel[] {
    return [...this.bound.values()];
  }

  // Whether the binding has been disposed.
  get disposed(): boolean {
    return this.closed;
  }

  // Builds a model's instance table and puts its groups in the scene.
  //
  // `keys` is the object key of each object ordinal, matching `geometry.instances.objectIndex`. A
  // repeated model id is refused rather than silently replacing what is there.
  addModel(
    modelId: string,
    geometry: Geometry,
    keys: readonly ObjectKey[],
    options: InstanceTableOptions = defaultTableOptions,
  ): Result<InstanceTable> {
    if (this.closed) return failure([diagnostic('disposed', 'The scene binding is disposed', ['modelId'])]);
    if (this.bound.has(modelId))
      return failure([diagnostic('repeated-model', `Model ${modelId} is already in the scene`, ['modelId'])]);
    const built = buildInstanceTable(geometry, keys, options);
    if (!built.ok) return built;
    const table = built.value;
    for (let g = 0; g < table.groups.length; g++) {
      const group = table.groups[g];
      if (group === undefined) continue;
      this.locations.set(group, { modelId, group: g });
      this.scene.addGroup(group);
    }
    this.bound.set(modelId, { modelId, geometry, table, dirty: dirtySets(table) });
    this.requestRender();
    return success(table, built.diagnostics);
  }

  // Takes a model's groups out of the scene. Returns false when it was not there.
  removeModel(modelId: string): boolean {
    const model = this.bound.get(modelId);
    if (model === undefined) return false;
    for (const group of model.table.groups) {
      this.scene.removeGroup(group);
      this.locations.delete(group);
    }
    this.bound.delete(modelId);
    this.requestRender();
    return true;
  }

  // A model's instance table.
  tableOf(modelId: string): InstanceTable | undefined {
    return this.bound.get(modelId)?.table;
  }

  // Where each group sits, for a renderer adapter turning its hits into model hits.
  groupIndex(): ReadonlyMap<InstancedGroup, GroupLocation> {
    return this.locations;
  }

  // Applies a table of changed columns to one model and publishes what moved.
  applyChanges(modelId: string, changes: Table, options?: UpdateOptions): Result<UpdateReport> {
    const model = this.bound.get(modelId);
    if (model === undefined)
      return failure([diagnostic('unknown-model', `Model ${modelId} is not in the scene`, ['modelId'])]);
    const report = applyUpdates(model.table, changes, model.dirty, options);
    if (report.ok) this.publish();
    return report;
  }

  // Applies resolved appearances to one model and publishes what moved.
  //
  // The composition order - base, edits, rules, filter, selection - was already settled by
  // `resolveStyles`; this only writes the answer into the buffers.
  //
  // Every row of the model is addressed, not only the keys the resolution names, because
  // `resolveStyles` deliberately omits a key whose appearance equals the fallback: an object that a
  // rule stopped applying to has to go back to the fallback, and it is not in `byKey` to say so.
  // Change detection is what keeps that affordable - the rows that did not move are not written and
  // do not become dirty.
  //
  // `objectsMissing` counts only the keys the resolution actually named that this model does not
  // hold. A key that resolves to the fallback is not named, so it cannot be counted; a caller that
  // needs an exact figure should compare its key list with the model's.
  applyStyles(modelId: string, resolved: ResolvedStyles, options?: UpdateOptions): Result<UpdateReport> {
    const model = this.bound.get(modelId);
    if (model === undefined)
      return failure([diagnostic('unknown-model', `Model ${modelId} is not in the scene`, ['modelId'])]);
    const table = model.table;
    const total = table.rowCount;
    const rows = table.objectRows;
    const rgb = new Float32Array(total * 3);
    const opacity = new Float32Array(total);
    const shown = new Uint8Array(total);
    for (let object = 0; object < table.keys.length; object++) {
      const key = table.keys[object];
      if (key === undefined) continue;
      const start = table.objectStart[object] ?? 0;
      const end = table.objectStart[object + 1] ?? start;
      if (end === start) continue;
      const appearance = styleOf(resolved, key);
      const visible = isVisible(resolved, key) ? 1 : 0;
      for (let at = start; at < end; at++) {
        rgb[at * 3] = appearance.color[0] ?? 0;
        rgb[at * 3 + 1] = appearance.color[1] ?? 0;
        rgb[at * 3 + 2] = appearance.color[2] ?? 0;
        opacity[at] = appearance.opacity;
        shown[at] = visible;
      }
    }
    const written =
      writeColors(table, rows, rgb, model.dirty, options) +
      writeOpacity(table, rows, opacity, model.dirty, options) +
      writeVisibility(table, rows, shown, model.dirty, options);
    this.publish();
    let missing = 0;
    for (const key of resolved.byKey.keys()) if (!table.objectOfKey.has(key)) missing++;
    for (const key of resolved.deleted) if (!table.objectOfKey.has(key)) missing++;
    return success(
      { rowsAddressed: total, rowsWritten: written, objectsMissing: missing },
      missing === 0
        ? []
        : [
            diagnostic(
              'unknown-object',
              `${missing} styled objects are not in model ${modelId}`,
              ['byKey'],
              'warning',
            ),
          ],
    );
  }

  // Tells viewer-core what moved, once per touched group, and clears the ranges. Requests a render
  // only when something actually moved.
  publish(): PublishReport {
    let colorGroups = 0;
    let transformGroups = 0;
    for (const model of this.bound.values()) {
      const report = publishDirty(model.table, model.dirty);
      model.dirty.colors.reset();
      model.dirty.transforms.reset();
      colorGroups += report.colorGroups;
      transformGroups += report.transformGroups;
    }
    if (colorGroups > 0 || transformGroups > 0) this.requestRender();
    return { colorGroups, transformGroups };
  }

  // Every row of an object key across every model.
  rowsOf(key: ObjectKey): readonly { readonly modelId: string; readonly rows: Int32Array }[] {
    const found: { modelId: string; rows: Int32Array }[] = [];
    for (const model of this.bound.values()) {
      const rows = rowsOfKey(model.table, key);
      if (rows.length > 0) found.push({ modelId: model.modelId, rows });
    }
    return found;
  }

  // World bounds of the instanced geometry, which is what fit-to-selection frames. The environment
  // is not in the scene, so it cannot widen this.
  bounds(): Bounds {
    let total = emptyBounds;
    for (const model of this.bound.values())
      for (const group of model.table.groups) {
        const found = groupBounds(group);
        if (found !== null) total = unionBounds(total, { min: found.min, max: found.max });
      }
    return total;
  }

  // World bounds of one model.
  modelBounds(modelId: string): Bounds {
    const model = this.bound.get(modelId);
    if (model === undefined) return emptyBounds;
    let total = emptyBounds;
    for (const group of model.table.groups) {
      const found = groupBounds(group);
      if (found !== null) total = unionBounds(total, { min: found.min, max: found.max });
    }
    return total;
  }

  // What is in the scene, summed over models.
  statistics(): SceneStatistics {
    let sourceObjects = 0;
    let groups = 0;
    let renderedInstances = 0;
    let visibleInstances = 0;
    let renderedTriangles = 0;
    for (const model of this.bound.values()) {
      const counted = sceneStatistics(model.table, model.geometry);
      sourceObjects += counted.sourceObjects;
      groups += counted.groups;
      renderedInstances += counted.renderedInstances;
      visibleInstances += counted.visibleInstances;
      renderedTriangles += counted.renderedTriangles;
    }
    return { sourceObjects, groups, renderedInstances, visibleInstances, renderedTriangles };
  }

  // The closest object under a ray, across every model and every extra source.
  pick(
    ray: Ray,
    raycast: (ray: Ray) => readonly ModelRaycastHit[],
    sources: readonly ObjectHitSource[] = [],
    options: PickOptions = defaultPickOptions,
  ): ObjectHit | undefined {
    const candidates: ObjectHit[] = [];
    for (const hit of raycast(ray)) {
      const model = this.bound.get(hit.modelId);
      if (model === undefined) continue;
      const found = resolveHit(model.table, hit, options);
      if (found !== undefined) candidates.push(found);
    }
    for (const source of sources)
      for (const hit of source.hits(ray)) candidates.push({ ...hit, source: source.id });
    return nearestHit(candidates);
  }

  // Removes every model from the scene. The groups themselves are released with their model; the
  // three.js mirror and the renderer are the host's to dispose.
  dispose(): void {
    if (this.closed) return;
    for (const modelId of [...this.bound.keys()]) this.removeModel(modelId);
    this.closed = true;
  }
}

// The stride of an instance colour, re-exported so a renderer adapter reading the borrowed buffers
// does not have to reach into the model package for it.
export const instanceColorStride = colorStride;
