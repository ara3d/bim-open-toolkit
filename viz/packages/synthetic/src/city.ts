// Several buildings across sites, their geographic anchors, and the documents that report on them.
//
// The rule this data exists for is that a source document is not a building. A portfolio that
// attributed a metric to a building because it came out of a file named after one would be
// inventing the join. So the mapping from document to building is its own column and it goes wrong
// in both directions: a document that names two buildings, and a document nobody has mapped to any.
//
// Geographic registration is the other half. Each building declares its own `CoordinateContext`
// with a geographic anchor, except one that nobody surveyed, whose registration is `unknown`. A map
// has to leave that building off rather than place it at the origin.

import {
  boolColumn,
  conflicting,
  coverageOf,
  f64Column,
  i32Column,
  known,
  missing,
  quantity,
  stringColumn,
  table,
  type Appearance,
  type CoordinateContext,
  type Coverage,
  type Evidence,
  type GeographicAnchor,
  type Geometry,
  type ModelData,
  type ModelRef,
  type Observation,
  type Table,
  type Vec3,
} from '@bim-open-toolkit/model';
import { elementAt, joinIds } from './arrays.js';
import { cursor as newCursor, drawRange, type Cursor } from './cursor.js';
import type { MeshGroup, ShadedMesh } from './mesh-builder.js';
import { placeScaled } from './placement.js';
import { box } from './primitives.js';
import { add, scene, sceneBuilder } from './scene.js';
import { quantityColumns, type NamedColumn } from './schedule.js';

// What to generate. At least two buildings per site are needed, because the document that names
// two of them is what makes an ambiguous mapping possible.
export type CityOptions = {
  readonly seed: number;
  readonly sites: number;
  readonly buildingsPerSite: number;
  readonly gapScale: number;
};

// Two sites of three buildings each.
export const defaultCityOptions: CityOptions = { seed: 29, sites: 2, buildingsPerSite: 3, gapScale: 1 };

// One building's declared frame. A map reads this, not the model's own frame: the model places all
// the buildings in one local site plan, while each building is registered on its own.
export type CityAnchor = {
  readonly buildingId: string;
  readonly coordinates: CoordinateContext;
};

// A generated portfolio: the buildings, where each one says it is, the documents that report on
// them and the figures those documents carry.
export type City = {
  readonly options: CityOptions;
  readonly model: ModelData;
  readonly meshGroups: readonly MeshGroup[];
  readonly geometry: Geometry;
  readonly buildings: Table;
  readonly anchors: readonly CityAnchor[];
  readonly documents: Table;
  readonly metrics: Table;
  readonly metricNames: readonly string[];
  readonly valueCoverage: Coverage;
};

// Rejects options that cannot produce a portfolio.
function checkOptions(options: CityOptions): void {
  if (!Number.isInteger(options.seed)) throw new Error(`seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.sites) || options.sites < 2) throw new Error(`sites must be an integer of at least 2, got ${options.sites}`);
  if (!Number.isInteger(options.buildingsPerSite) || options.buildingsPerSite < 2) {
    throw new Error(`buildingsPerSite must be an integer of at least 2, got ${options.buildingsPerSite}`);
  }
  if (!(options.gapScale >= 0) || !Number.isFinite(options.gapScale)) throw new Error(`gapScale must be a finite number of at least 0, got ${options.gapScale}`);
}

// The point the portfolio is laid out around, in degrees.
const baseLatitude = 51.5074;
const baseLongitude = -0.1278;

// The metrics a document can report.
const metricNames: readonly string[] = ['totalFloorAreaM2', 'annualEnergyKwh'];

// The unit each metric is reported in.
const metricUnits: Readonly<Record<string, string>> = {
  totalFloorAreaM2: 'm2',
  annualEnergyKwh: 'kWh',
};

// The range each metric falls in.
const metricRanges: Readonly<Record<string, readonly [number, number]>> = {
  totalFloorAreaM2: [1800, 24000],
  annualEnergyKwh: [140000, 2600000],
};

// The evidence a portfolio return provides.
const returnEvidence: Evidence = { source: 'portfolio-return', reference: 'PR-2026' };

// The evidence a metered reading provides.
const meterEvidence: Evidence = { source: 'metered-reading', reference: 'EM-2026' };

// One building of the portfolio.
type CityBuilding = {
  readonly buildingId: string;
  readonly name: string;
  readonly siteId: string;
  readonly anchor: GeographicAnchor | undefined;
  readonly footprint: Vec3;
  readonly position: Vec3;
};

// One source document and the buildings somebody understood it to describe.
type Document = {
  readonly documentId: string;
  readonly name: string;
  readonly buildingIds: readonly string[];
};

// One reported figure.
type Metric = {
  readonly id: string;
  readonly documentId: string;
  readonly metricName: string;
  readonly value: Observation;
};

// A reported figure. `state` is 0 for a figure two sources dispute, 1 for one nobody reported, and
// anything else for a figure that stands.
function reportedValue(state: number, first: number, second: number, unit: string, evidence: Evidence): Observation {
  if (state === 0) return conflicting([quantity(first, unit), quantity(second, unit)], [returnEvidence, meterEvidence]);
  if (state === 1) return missing('not-provided', [evidence]);
  return known(quantity(first, unit), [evidence]);
}

// The appearance of a building mass in the site plan.
const massAppearance: Appearance = { color: [0.68, 0.7, 0.74], opacity: 1, visible: true };

// The frame the site plan itself is drawn in. Each building's own registration is in `anchors`.
const siteFrame: CoordinateContext = {
  units: 'metres',
  up: 'z',
  registration: { kind: 'project', projectId: 'synthetic-portfolio' },
};

// The frame a building declares. A building nobody surveyed is `unknown`, which a map must leave
// off rather than place at the origin.
const contextOf = (anchor: GeographicAnchor | undefined): CoordinateContext => ({
  units: 'metres',
  up: 'z',
  registration: anchor === undefined ? { kind: 'unknown' } : { kind: 'geographic', anchor },
});

// Generates a portfolio from its options. The same options always give the same buildings.
export function generateCity(options: CityOptions): City {
  checkOptions(options);
  const cursor: Cursor = newCursor(options.seed);
  const complete = options.gapScale === 0;
  const ref: ModelRef = { id: 'synthetic-city', revision: `seed-${options.seed}`, source: 'generated' };
  const meshes: readonly ShadedMesh[] = [box([1, 1, 1])];
  const meshNames: readonly string[] = ['building-mass'];

  const buildings: CityBuilding[] = [];
  for (let site = 0; site < options.sites; site++) {
    for (let index = 0; index < options.buildingsPerSite; index++) {
      const number = site * options.buildingsPerSite + index + 1;
      const width = drawRange(cursor, 18, 42);
      const depth = drawRange(cursor, 16, 36);
      const height = drawRange(cursor, 12, 60);
      const latitude = baseLatitude + drawRange(cursor, -0.01, 0.01);
      const longitude = baseLongitude + drawRange(cursor, -0.02, 0.02);
      const altitude = drawRange(cursor, 4, 28);
      const trueNorth = drawRange(cursor, -12, 12);
      // The second building of the second site was never surveyed, so it has no anchor at all.
      const surveyed = complete || !(site === 1 && index === 1);
      buildings.push({
        buildingId: `B-${number}`,
        name: `Building ${number}`,
        siteId: `site-${site + 1}`,
        anchor: surveyed
          ? { latitude, longitude, altitude, trueNorthDegrees: trueNorth }
          : undefined,
        footprint: [width, depth, height],
        position: [index * 60, site * 70, height / 2],
      });
    }
  }

  const documents: Document[] = [];
  for (const building of buildings) {
    documents.push({
      documentId: `doc-${building.buildingId.toLowerCase()}`,
      name: `${building.name} model`,
      buildingIds: [building.buildingId],
    });
  }
  if (!complete) {
    for (let site = 0; site < options.sites; site++) {
      const members = buildings.filter((building) => building.siteId === `site-${site + 1}`);
      documents.push({
        // A campus-wide report that covers two buildings: nobody can attribute its figures to one.
        documentId: `doc-site-${site + 1}`,
        name: `Site ${site + 1} campus report`,
        buildingIds: members.slice(0, 2).map((building) => building.buildingId),
      });
    }
    // A document nobody has mapped to a building yet.
    documents.push({ documentId: 'doc-unmapped', name: 'Unfiled survey report', buildingIds: [] });
  }

  const lastSite = `site-${options.sites}`;
  const metrics: Metric[] = [];
  for (const document of documents) {
    const owned = buildings.find((building) => building.buildingId === document.buildingIds[0]);
    // Every figure reported about the last site is either disputed or absent, so the site has no
    // resolved contributor and a rollup for it must be left out rather than reported as zero.
    const unusable = !complete && owned !== undefined && owned.siteId === lastSite && document.buildingIds.length === 1;
    metricNames.forEach((metricName, index) => {
      const range = metricRanges[metricName] ?? [1, 2];
      const unit = metricUnits[metricName] ?? '';
      const first = Math.round(drawRange(cursor, elementAt([...range], 0), elementAt([...range], 1)));
      const second = Math.round(first * drawRange(cursor, 1.05, 1.2));
      const evidence = metricName === 'annualEnergyKwh' ? meterEvidence : returnEvidence;
      metrics.push({
        id: `m-${metrics.length + 1}`,
        documentId: document.documentId,
        metricName,
        value: reportedValue(unusable ? index : -1, first, second, unit, evidence),
      });
    });
  }

  const target = sceneBuilder(ref);
  for (const building of buildings) {
    add(target, {
      objectId: building.buildingId,
      name: building.name,
      category: 'Building',
      transform: placeScaled(building.position, building.footprint),
      appearance: massAppearance,
      meshIndex: 0,
    });
  }
  const built = scene(target, siteFrame, meshes, meshNames);

  const metricColumns: readonly NamedColumn[] = [
    ['id', stringColumn(metrics.map((metric) => metric.id))],
    ['documentId', stringColumn(metrics.map((metric) => metric.documentId))],
    ['metricName', stringColumn(metrics.map((metric) => metric.metricName))],
    ...quantityColumns('value', metrics.map((metric) => metric.value)),
  ];

  const anchorNumber = (read: (anchor: GeographicAnchor) => number): readonly number[] =>
    buildings.map((building) => (building.anchor === undefined ? Number.NaN : read(building.anchor)));

  return {
    options,
    model: built.model,
    meshGroups: built.meshGroups,
    geometry: built.geometry,
    buildings: table([
      ['buildingId', stringColumn(buildings.map((building) => building.buildingId))],
      ['name', stringColumn(buildings.map((building) => building.name))],
      ['siteId', stringColumn(buildings.map((building) => building.siteId))],
      ['registration', stringColumn(buildings.map((building) => (building.anchor === undefined ? 'unknown' : 'geographic')))],
      ['registered', boolColumn(buildings.map((building) => building.anchor !== undefined))],
      ['latitude', f64Column(anchorNumber((anchor) => anchor.latitude))],
      ['longitude', f64Column(anchorNumber((anchor) => anchor.longitude))],
      ['altitude', f64Column(anchorNumber((anchor) => anchor.altitude))],
      ['trueNorthDegrees', f64Column(anchorNumber((anchor) => anchor.trueNorthDegrees))],
    ]),
    anchors: buildings.map((building) => ({ buildingId: building.buildingId, coordinates: contextOf(building.anchor) })),
    documents: table([
      ['documentId', stringColumn(documents.map((document) => document.documentId))],
      ['name', stringColumn(documents.map((document) => document.name))],
      ['buildingIds', stringColumn(documents.map((document) => joinIds(document.buildingIds)))],
      ['buildingIdCount', i32Column(documents.map((document) => document.buildingIds.length))],
    ]),
    metrics: table(metricColumns),
    metricNames,
    valueCoverage: coverageOf(metrics.map((metric) => metric.value)),
  };
}
