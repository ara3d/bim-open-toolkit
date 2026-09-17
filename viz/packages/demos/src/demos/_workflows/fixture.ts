// The data a workflow demo opens: one of the synthetic catalog's fixtures, as a `DemoFixture`.
//
// Two of the workflow generators publish tables and no geometry at all - a pricing set has nothing
// to draw. Rather than let such a demo look broken, `tabularFixture` builds a model whose objects
// exist and whose geometry is empty, so sets, rules and the inspector all work and the viewport is
// honestly empty. The demo says so; it does not borrow a building to stand in for one.

import {
  diagnostic,
  emptyInstances,
  failure,
  identityMatrix,
  metresZUpLocal,
  objectRef,
  success,
  type Geometry,
  type ModelData,
  type ModelRef,
  type ObjectRecord,
  type Result,
} from '@bim-open-toolkit/model';
import { fixture, type Fixture, type FixtureName } from '@bim-open-toolkit/synthetic';
import type { DataBasis, DemoFixture, ModelSource } from '../../gallery/contracts.js';

// A geometry with no meshes and no instances: what a fixture that states no shapes draws.
export const emptyGeometry: Geometry = { meshes: [], instances: emptyInstances(0) };

// The parts of a fixture that can be drawn, or nothing when the generator publishes no geometry.
export type DrawableFixture = { readonly model: ModelData; readonly geometry: Geometry };

// The model and geometry of a fixture, when it has them.
export const drawableOf = (built: Fixture): DrawableFixture | undefined =>
  'model' in built && 'geometry' in built ? { model: built.model, geometry: built.geometry } : undefined;

// A model source over data already in memory.
export const dataSource = (id: string, model: ModelData, geometry: Geometry): ModelSource => ({
  kind: 'data',
  id,
  data: model,
  geometry,
});

// One of the synthetic catalog's fixtures, built when it is chosen. A fixture the catalog publishes
// without geometry is refused here rather than drawn as something else; use `tabularFixture`.
export const syntheticFixture = (
  name: FixtureName,
  title: string,
  basis: DataBasis = 'synthetic',
): DemoFixture => ({
  id: name,
  title,
  basis,
  source: (): Promise<Result<ModelSource>> => {
    const drawable = drawableOf(fixture(name));
    return Promise.resolve(
      drawable === undefined
        ? failure([
            diagnostic(
              'demos/no-geometry',
              `The "${name}" fixture publishes tables and no geometry, so it cannot be opened as a model.`,
            ),
          ])
        : success(dataSource(name, drawable.model, drawable.geometry)),
    );
  },
});

// A model whose objects exist and whose geometry does not: the honest shape of a fixture that is a
// set of tables. Every object is placed at the origin and carries no representation, so nothing is
// drawn and nothing is invented.
export const tabularModel = (ref: ModelRef, ids: readonly string[], category: string): ModelData => ({
  ref,
  coordinates: metresZUpLocal,
  objects: ids.map(
    (id): ObjectRecord => ({ ref: objectRef(ref, id), transform: identityMatrix, category, name: id }),
  ),
});

// A fixture over a model with no geometry: the objects are real, the viewport is empty, and the
// demo's README says why.
export const tabularFixture = (
  id: string,
  title: string,
  model: ModelData,
  basis: DataBasis = 'synthetic',
): DemoFixture => ({
  id,
  title,
  basis,
  source: (): Promise<Result<ModelSource>> => Promise.resolve(success(dataSource(id, model, emptyGeometry))),
});
