// The carbon data set this demo opens, the material carbon input read out of it, and the scene the
// demo draws it on.
//
// `synthetic`'s carbon generator has no geometry: it is a material takeoff and a factor set, keyed
// by object id, and nothing in it says where an object is. Rather than borrow a building and
// pretend its objects are these ones - which would be inventing the join the workflows package
// exists to refuse - the demo lays out one identical box per row of the takeoff. The boxes carry
// the takeoff's own object ids and material names and nothing else: they are a place to put a
// colour, not a building. The README says so on the page.
//
// The box size is the same for every object on purpose. Sizing by quantity would encode the number
// twice and would have to invent a size for the objects whose quantity nobody took off.

import {
  objectKey,
  success,
  type Appearance,
  type CellValue,
  type CoordinateContext,
  type Geometry,
  type ModelData,
  type ModelRef,
  type ObjectKey,
  type ObjectRecord,
  type Result,
} from '@bim-open-toolkit/model';
import { rowOf } from '@bim-open-toolkit/model';
import {
  add,
  box,
  defaultCarbonOptions,
  generateCarbon,
  placeScaled,
  scene,
  sceneBuilder,
  type Carbon,
  type CarbonOptions,
} from '@bim-open-toolkit/synthetic';
import {
  missingReasons,
  runMaterialCarbon,
  type CarbonFactor,
  type MaterialCarbonInput,
  type MaterialQuantity,
  type ObservationJson,
  type WorkflowResult,
} from '@bim-open-toolkit/workflows';
import type { DemoFixture, ModelSource } from '../../gallery/contracts.js';

// The data set the demo opens: the generator's own default, eighteen objects across six materials,
// asked for the product stage A1-A3.
export const carbonOptions: CarbonOptions = defaultCarbonOptions;

// The revision the boxes belong to. The carbon generator states no model of its own, so the demo
// names one rather than borrowing another fixture's identity.
export const carbonModelRef: ModelRef = { id: 'synthetic-carbon', revision: `seed-${carbonOptions.seed}` };

// The frame the layout is drawn in. It is registered nowhere, because a takeoff says nothing about
// where anything is and a project or geographic registration here would be a claim.
const carbonFrame: CoordinateContext = { units: 'metres', up: 'z', registration: { kind: 'unknown' } };

const boxAppearance: Appearance = { color: [0.72, 0.72, 0.74], opacity: 1, visible: true };

// How many boxes stand in a row, and how far apart they are.
const columns = 6;
const spacing = 4;
const boxSize = 2;

const textAt = (value: CellValue | undefined): string => (typeof value === 'string' ? value : '');

const numberAt = (value: CellValue | undefined): number => (typeof value === 'number' ? value : Number.NaN);

const textOrUndefined = (value: string): string | undefined => (value === '' ? undefined : value);

const reasonAt = (value: CellValue | undefined): (typeof missingReasons)[number] =>
  missingReasons.find((reason) => reason === textAt(value)) ?? 'not-provided';

// A quantity written across `synthetic`'s schedule columns, read back as the observation it was.
// The same reader as `portfolio/city.ts`; both are the inverse of `synthetic`'s `quantityColumns`
// and belong beside it, which is a request in CHECKPOINT-D4.md.
export const quantityObservationOf = (
  cells: Readonly<Record<string, CellValue>>,
  name: string,
): ObservationJson => {
  const state = textAt(cells[`${name}State`]);
  const unit = textOrUndefined(textAt(cells[`${name}Unit`]));
  if (state === 'known') return { kind: 'known', value: numberAt(cells[name]), unit };
  if (state === 'conflicting')
    return {
      kind: 'conflicting',
      values: textAt(cells[`${name}Conflict`])
        .split(' vs ')
        .map((part) => Number.parseFloat(part)),
      unit,
    };
  return { kind: 'missing', reason: reasonAt(cells[`${name}MissingReason`]) };
};

// One row of the material takeoff, with the material's own name for the sheet and the box label.
export type TakeoffRow = {
  readonly objectId: string;
  readonly materialId: string;
  readonly materialName: string;
  readonly quantity: ObservationJson;
};

const takeoffOf = (carbon: Carbon): readonly TakeoffRow[] =>
  Array.from({ length: carbon.quantities.rowCount }, (_unused, row) => {
    const cells = rowOf(carbon.quantities, row);
    return {
      objectId: textAt(cells['objectId']),
      materialId: textAt(cells['materialId']),
      materialName: textAt(cells['materialName']),
      quantity: quantityObservationOf(cells, 'quantity'),
    };
  });

const factorsOf = (carbon: Carbon): readonly CarbonFactor[] =>
  Array.from({ length: carbon.factors.rowCount }, (_unused, row) => {
    const cells = rowOf(carbon.factors, row);
    return {
      id: textAt(cells['id']),
      materialId: textAt(cells['materialId']),
      scenario: textAt(cells['scenario']),
      unit: textAt(cells['unit']),
      lifecycleScope: textAt(cells['lifecycleScope']),
      factorValue: numberAt(cells['factorValue']),
    };
  });

// The workflow input this data set states.
export const materialCarbonInputOf = (carbon: Carbon, model: ModelRef): MaterialCarbonInput => ({
  model,
  requestedLifecycleScope: carbon.requestedLifecycleScope,
  quantities: takeoffOf(carbon).map(
    (item): MaterialQuantity => ({
      objectId: item.objectId,
      materialId: item.materialId,
      quantity: item.quantity,
    }),
  ),
  factors: factorsOf(carbon),
});

// One box per row of the takeoff, on a grid, named by the material it is made of.
const carbonScene = (takeoff: readonly TakeoffRow[]): { readonly model: ModelData; readonly geometry: Geometry } => {
  const target = sceneBuilder(carbonModelRef);
  takeoff.forEach((item, at) => {
    add(target, {
      objectId: item.objectId,
      name: `${item.materialName} (${item.objectId})`,
      category: item.materialName,
      transform: placeScaled(
        [(at % columns) * spacing, Math.floor(at / columns) * spacing, boxSize / 2],
        [boxSize, boxSize, boxSize],
      ),
      appearance: boxAppearance,
      meshIndex: 0,
    });
  });
  const built = scene(target, carbonFrame, [box([1, 1, 1])], ['carbon-object']);
  return { model: built.model, geometry: built.geometry };
};

// The data set, what the workflow made of it, and the lookups the panels and the sheet read.
export type CarbonIndex = {
  readonly carbon: Carbon;
  readonly takeoff: readonly TakeoffRow[];
  readonly input: MaterialCarbonInput;
  readonly result: Result<WorkflowResult>;
  readonly model: ModelData;
  readonly geometry: Geometry;
  readonly records: ReadonlyMap<ObjectKey, ObjectRecord>;
};

const buildIndex = (carbon: Carbon): CarbonIndex => {
  const takeoff = takeoffOf(carbon);
  const built = carbonScene(takeoff);
  const input = materialCarbonInputOf(carbon, carbonModelRef);
  return {
    carbon,
    takeoff,
    input,
    result: runMaterialCarbon(input),
    model: built.model,
    geometry: built.geometry,
    records: new Map(built.model.objects.map((record) => [objectKey(record.ref), record])),
  };
};

let held: CarbonIndex | undefined;

// The data set, its scene and its result, built on first use and kept for the life of the page.
export const carbonIndex = (): CarbonIndex => {
  const already = held;
  if (already !== undefined) return already;
  const made = buildIndex(generateCarbon(carbonOptions));
  held = made;
  return made;
};

// The object key of one row of the takeoff.
export const carbonKey = (objectId: string): ObjectKey =>
  objectKey({ modelId: carbonModelRef.id, revision: carbonModelRef.revision, objectId });

// The takeoff and its factor set as a fixture: nothing is generated until it is chosen.
export const carbonFixture: DemoFixture = {
  id: 'synthetic-carbon',
  title: 'Synthetic material takeoff and factor set, one box per object',
  basis: 'synthetic',
  source: (): Promise<Result<ModelSource>> => {
    const index = carbonIndex();
    const source: ModelSource = {
      kind: 'data',
      id: carbonModelRef.id,
      data: index.model,
      geometry: index.geometry,
    };
    return Promise.resolve(success(source));
  },
};
