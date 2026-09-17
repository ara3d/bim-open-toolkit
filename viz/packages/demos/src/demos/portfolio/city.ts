// The synthetic estate this demo opens, the portfolio drill-through input read out of it, and the
// lookups the panels and the sheet need: the record, the box and the anchor point of each building.
//
// The generator publishes its reported figures as schedule columns (`value`, `valueState`,
// `valueUnit`, `valueConflict`, `valueMissingReason`), so the observation each figure carries is
// rebuilt from those columns. That reader is the inverse of `synthetic`'s `quantityColumns` and
// belongs beside it; CHECKPOINT-D4.md records the request. Until it lands it is written here.
//
// Generation is deterministic, so the estate is generated once and kept: the inspector runs after
// every change event and cannot afford to build it again.

import {
  boundsCenter,
  emptyBounds,
  expandBounds,
  instanceTransform,
  isEmptyBounds,
  objectKey,
  rowOf,
  success,
  transformBounds,
  transformPoint,
  unionBounds,
  type Bounds,
  type CellValue,
  type Geometry,
  type ModelData,
  type ObjectKey,
  type ObjectRecord,
  type Result,
  type Vec3,
} from '@bim-open-toolkit/model';
import { defaultCityOptions, generateCity, splitIds, type City, type CityOptions } from '@bim-open-toolkit/synthetic';
import {
  missingReasons,
  runPortfolioDrillThrough,
  type ObservationJson,
  type PortfolioBuilding,
  type PortfolioDocument,
  type PortfolioInput,
  type PortfolioMetric,
  type WorkflowResult,
} from '@bim-open-toolkit/workflows';
import type { DemoFixture, ModelSource } from '../../gallery/contracts.js';

// The estate the demo opens: the generator's own default, two sites of three buildings, with the
// campus report that names two buildings and the survey nobody has filed against one.
export const portfolioCityOptions: CityOptions = defaultCityOptions;

const textAt = (value: CellValue | undefined): string => (typeof value === 'string' ? value : '');

const numberAt = (value: CellValue | undefined): number => (typeof value === 'number' ? value : Number.NaN);

const textOrUndefined = (value: string): string | undefined => (value === '' ? undefined : value);

const reasonAt = (value: CellValue | undefined): (typeof missingReasons)[number] =>
  missingReasons.find((reason) => reason === textAt(value)) ?? 'not-provided';

// A quantity written across `synthetic`'s schedule columns, read back as the observation it was.
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

// One source document and the buildings somebody understood it to describe. Its name is kept so a
// document nobody mapped can be shown by the name it has rather than by its id alone.
export type EstateDocument = {
  readonly documentId: string;
  readonly name: string;
  readonly buildingIds: readonly string[];
};

const buildingsOf = (city: City): readonly PortfolioBuilding[] =>
  Array.from({ length: city.buildings.rowCount }, (_unused, row) => {
    const cells = rowOf(city.buildings, row);
    return { buildingId: textAt(cells['buildingId']), name: textAt(cells['name']), siteId: textAt(cells['siteId']) };
  });

const documentsOf = (city: City): readonly EstateDocument[] =>
  Array.from({ length: city.documents.rowCount }, (_unused, row) => {
    const cells = rowOf(city.documents, row);
    return {
      documentId: textAt(cells['documentId']),
      name: textAt(cells['name']),
      buildingIds: splitIds(textAt(cells['buildingIds'])),
    };
  });

const metricsOf = (city: City): readonly PortfolioMetric[] =>
  Array.from({ length: city.metrics.rowCount }, (_unused, row) => {
    const cells = rowOf(city.metrics, row);
    return {
      id: textAt(cells['id']),
      documentId: textAt(cells['documentId']),
      metricName: textAt(cells['metricName']),
      value: quantityObservationOf(cells, 'value'),
    };
  });

// How each building says it is registered: `geographic` for one somebody surveyed, `unknown` for
// one nobody did. A map has to leave the second off rather than place it at the origin.
const registrationOf = (city: City): ReadonlyMap<string, string> =>
  new Map(
    Array.from({ length: city.buildings.rowCount }, (_unused, row) => {
      const cells = rowOf(city.buildings, row);
      return [textAt(cells['buildingId']), textAt(cells['registration'])] as const;
    }),
  );

// The workflow input this estate states: the buildings, the documents that report on them, the
// figures those documents carry, and the one metric the rollup adds up.
export const portfolioInputOf = (city: City, metricName: string): PortfolioInput => ({
  model: city.model.ref,
  requestedMetricName: metricName,
  buildings: buildingsOf(city),
  documents: documentsOf(city).map(
    (document): PortfolioDocument => ({ documentId: document.documentId, buildingIds: document.buildingIds }),
  ),
  metrics: metricsOf(city),
});

// The box each object occupies, unioned over every instance row that draws it. An object that draws
// nothing gets the point its transform places it at, which is still somewhere a card can hang.
const boundsByKey = (model: ModelData, geometry: Geometry): ReadonlyMap<ObjectKey, Bounds> => {
  const boxes = model.objects.map(() => emptyBounds);
  const instances = geometry.instances;
  for (let row = 0; row < instances.count; row += 1) {
    const meshIndex = instances.meshIndex[row] ?? -1;
    const objectIndex = instances.objectIndex[row] ?? -1;
    const source = geometry.meshes[meshIndex];
    const held = boxes[objectIndex];
    if (source === undefined || held === undefined) continue;
    boxes[objectIndex] = unionBounds(held, transformBounds(instanceTransform(instances, row), source.bounds));
  }
  return new Map(
    model.objects.map((record, index) => {
      const box = boxes[index] ?? emptyBounds;
      const origin: Vec3 = transformPoint(record.transform, [0, 0, 0]);
      return [objectKey(record.ref), isEmptyBounds(box) ? expandBounds(emptyBounds, origin) : box];
    }),
  );
};

// The estate, what the workflow made of it, and the lookups every part of the demo reads.
export type PortfolioIndex = {
  readonly city: City;
  readonly metricName: string;
  readonly input: PortfolioInput;
  readonly result: Result<WorkflowResult>;
  readonly documents: readonly EstateDocument[];
  readonly registration: ReadonlyMap<string, string>;
  readonly records: ReadonlyMap<ObjectKey, ObjectRecord>;
  readonly bounds: ReadonlyMap<ObjectKey, Bounds>;
};

const buildIndex = (city: City): PortfolioIndex => {
  const metricName = city.metricNames[0] ?? '';
  const input = portfolioInputOf(city, metricName);
  return {
    city,
    metricName,
    input,
    result: runPortfolioDrillThrough(input),
    documents: documentsOf(city),
    registration: registrationOf(city),
    records: new Map(city.model.objects.map((record) => [objectKey(record.ref), record])),
    bounds: boundsByKey(city.model, city.geometry),
  };
};

let held: PortfolioIndex | undefined;

// The estate and its lookups, generated on first use and kept for the life of the page.
export const portfolioIndex = (): PortfolioIndex => {
  const already = held;
  if (already !== undefined) return already;
  const made = buildIndex(generateCity(portfolioCityOptions));
  held = made;
  return made;
};

// The object key of one building of the estate.
export const buildingKey = (index: PortfolioIndex, buildingId: string): ObjectKey =>
  objectKey({ modelId: index.city.model.ref.id, revision: index.city.model.ref.revision, objectId: buildingId });

// The box a building occupies, or nothing when the estate holds no such building.
export const buildingBounds = (index: PortfolioIndex, buildingId: string): Bounds | undefined =>
  index.bounds.get(buildingKey(index, buildingId));

// The point a building's card hangs over: the centre of its footprint at the top of its mass, so
// the card sits above the roof rather than inside the building.
export const cardPoint = (index: PortfolioIndex, buildingId: string): Vec3 | undefined => {
  const box = buildingBounds(index, buildingId);
  const centre = box === undefined ? undefined : boundsCenter(box);
  return box === undefined || centre === undefined ? undefined : [centre[0], centre[1], box.max[2]];
};

// The box the whole estate occupies, which is what the view goes back to when a drill-in ends.
export const estateBounds = (index: PortfolioIndex): Bounds =>
  index.input.buildings.reduce(
    (whole, building) => unionBounds(whole, buildingBounds(index, building.buildingId) ?? emptyBounds),
    emptyBounds,
  );

// The estate as a fixture: nothing is generated until it is chosen.
export const cityFixture: DemoFixture = {
  id: 'synthetic-city',
  title: 'Synthetic estate, two sites of three buildings',
  basis: 'synthetic',
  source: (): Promise<Result<ModelSource>> => {
    const index = portfolioIndex();
    const source: ModelSource = {
      kind: 'data',
      id: index.city.model.ref.id,
      data: index.city.model,
      geometry: index.city.geometry,
    };
    return Promise.resolve(success(source));
  },
};
