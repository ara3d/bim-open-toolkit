// Representations and replacement: an object's geometry swapped for another mesh while its
// identity stays exactly what it was.
//
// A replacement records which representation stands in for an object key. It never edits the
// instance table's rows, never removes a group and never rebuilds anything: the replaced object's
// rows are simply hidden, and the substitute is drawn beside them. Both the list of what to draw
// and the pick source over it are pure, so replacement is tested in Node; the drawing itself is one
// interface, `RepresentationTarget`.
//
// The original shared prototype is untouched, which is what F16 requires: other instances of the
// same mesh keep drawing from it.

import {
  boundsOfPositions,
  defaultAppearance,
  diagnostic,
  failure,
  identityMatrix,
  mesh as makeMesh,
  success,
  transformBounds,
  type Appearance,
  type Bounds,
  type Matrix4,
  type Mesh,
  type ObjectKey,
  type Result,
} from '@bim-open-toolkit/model';
import { intersectMesh, type ObjectHit, type ObjectHitSource, type Ray } from './picking.js';

// A named piece of geometry an object can be drawn as.
export type Representation = {
  readonly id: string;
  readonly mesh: Mesh;
};

// Representations by id.
export type RepresentationRegistry = ReadonlyMap<string, Representation>;

// A representation. The mesh is shared, not copied, so a box used for a thousand objects is stored
// once.
export const representation = (id: string, source: Mesh): Representation => ({ id, mesh: source });

// A registry, refusing repeated ids rather than letting the last one win silently.
export const representationRegistry = (
  items: readonly Representation[],
): Result<RepresentationRegistry> => {
  const registry = new Map<string, Representation>();
  const repeated: string[] = [];
  for (const item of items) {
    if (registry.has(item.id)) repeated.push(item.id);
    else registry.set(item.id, item);
  }
  if (repeated.length > 0)
    return failure([
      diagnostic('repeated-representation', `Representation ids repeat: ${repeated.join(', ')}`, ['items']),
    ]);
  return success(registry);
};

// An axis-aligned box as a mesh, in world coordinates, wound outward. This is the standard
// replacement: a stand-in that needs no geometry to be generated.
export const boxMesh = (bounds: Bounds): Result<Mesh> => {
  const { min, max } = bounds;
  if (![...min, ...max].every(Number.isFinite))
    return failure([diagnostic('bad-bounds', 'A box needs finite corners', ['min'])]);
  for (let axis = 0; axis < 3; axis++)
    if ((min[axis] ?? 0) > (max[axis] ?? 0))
      return failure([diagnostic('bad-bounds', 'A box needs its minimum below its maximum', ['min', axis])]);
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const positions = Float32Array.of(
    x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
  );
  const indices = Uint32Array.of(
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
  );
  return success(makeMesh(positions, indices));
};

// A box representation covering the given bounds.
export const boxRepresentation = (id: string, bounds: Bounds): Result<Representation> => {
  const box = boxMesh(bounds);
  return box.ok ? success(representation(id, box.value)) : failure(box.diagnostics);
};

// What stands in for one object, and where it sits.
export type Replacement = {
  readonly key: ObjectKey;
  readonly representationId: string;
  readonly transform: Matrix4;
};

// Which objects are currently drawn as something else. Plain data a document can hold.
export type ReplacementState = ReadonlyMap<ObjectKey, Replacement>;

// Nothing replaced.
export const noReplacements: ReplacementState = new Map<ObjectKey, Replacement>();

// Records that an object is drawn as a representation. Replacing an already replaced object
// replaces the substitute, not the original, so the base reference is never lost.
export const replaceObject = (
  state: ReplacementState,
  key: ObjectKey,
  representationId: string,
  transform: Matrix4 = identityMatrix,
): ReplacementState => new Map(state).set(key, { key, representationId, transform });

// Puts one object back to its own geometry.
export const restoreObject = (state: ReplacementState, key: ObjectKey): ReplacementState => {
  if (!state.has(key)) return state;
  const next = new Map(state);
  next.delete(key);
  return next;
};

// Puts every object back.
export const restoreAll = (): ReplacementState => noReplacements;

// What stands in for an object, if anything.
export const replacementOf = (state: ReplacementState, key: ObjectKey): Replacement | undefined =>
  state.get(key);

// Whether an object is drawn as something else.
export const isReplaced = (state: ReplacementState, key: ObjectKey): boolean => state.has(key);

// The replaced objects, whose instance rows must be hidden.
export const replacedKeys = (state: ReplacementState): readonly ObjectKey[] => [...state.keys()];

// Keys whose replacement state differs between two states: exactly the rows a caller has to show
// or hide again.
export const changedReplacements = (
  before: ReplacementState,
  after: ReplacementState,
): readonly ObjectKey[] => {
  const changed: ObjectKey[] = [];
  for (const [key, replacement] of after) {
    const previous = before.get(key);
    if (previous === undefined || previous.representationId !== replacement.representationId) changed.push(key);
  }
  for (const key of before.keys()) if (!after.has(key)) changed.push(key);
  return changed;
};

// One substitute to draw: which object it stands for, its geometry, where it sits and how it looks.
export type DrawnRepresentation = {
  readonly key: ObjectKey;
  readonly mesh: Mesh;
  readonly transform: Matrix4;
  readonly appearance: Appearance;
};

// What a renderer has to provide: the current list of substitutes.
export type RepresentationTarget = {
  readonly setDrawn: (items: readonly DrawnRepresentation[]) => void;
};

// The substitutes to draw, in key order. A replacement naming a representation the registry does
// not hold is reported and left undrawn, never guessed at.
export const drawnReplacements = (
  registry: RepresentationRegistry,
  state: ReplacementState,
  appearanceOf: (key: ObjectKey) => Appearance = () => defaultAppearance,
): Result<readonly DrawnRepresentation[]> => {
  const drawn: DrawnRepresentation[] = [];
  const unknown: string[] = [];
  for (const [key, replacement] of state) {
    const found = registry.get(replacement.representationId);
    if (found === undefined) {
      unknown.push(replacement.representationId);
      continue;
    }
    drawn.push({ key, mesh: found.mesh, transform: replacement.transform, appearance: appearanceOf(key) });
  }
  return success(
    drawn,
    unknown.length === 0
      ? []
      : [
          diagnostic(
            'unknown-representation',
            `${unknown.length} replacements name a representation the registry does not hold`,
            ['state'],
            'warning',
          ),
        ],
  );
};

// World bounds of one substitute, which is what fit-to-selection needs after a replacement.
export const replacementBounds = (
  registry: RepresentationRegistry,
  replacement: Replacement,
): Bounds | undefined => {
  const found = registry.get(replacement.representationId);
  if (found === undefined) return undefined;
  return transformBounds(replacement.transform, found.mesh.bounds);
};

// Bounds of a mesh's own vertices, recomputed rather than trusted, for geometry a host built.
export const meshBounds = (source: Mesh): Bounds => boundsOfPositions(source.positions);

// Hits against the drawn substitutes, nearest first within each item.
//
// Linear in triangles over the replaced objects only, which is the point of replacement: one
// object's geometry changes, and nothing else is touched.
export const replacementHits = (
  drawn: readonly DrawnRepresentation[],
  ray: Ray,
  sourceId: string,
): readonly ObjectHit[] => {
  const hits: ObjectHit[] = [];
  for (const item of drawn) {
    if (!item.appearance.visible) continue;
    const found = intersectMesh(ray, item.mesh, item.transform);
    if (found !== undefined)
      hits.push({
        key: item.key,
        object: -1,
        row: -1,
        point: found.point,
        distance: found.distance,
        source: sourceId,
      });
  }
  return hits.sort((a, b) => a.distance - b.distance);
};

// The name replacement hits are reported under.
export const replacementSourceId = 'replacement';

// A pick source over the drawn substitutes, ready to hand to `pick`.
export const replacementSource = (drawn: readonly DrawnRepresentation[]): ObjectHitSource => ({
  id: replacementSourceId,
  hits: (ray) => replacementHits(drawn, ray, replacementSourceId),
});
