// The catalog: every generator's default fixture, by name, plus the few named variants a demo asks
// for by name rather than by options.
//
// A demo, a browser spec and a snapshot test all want the same thing - "give me the standard
// services fixture" - without repeating which options are the standard ones. The catalog is that
// one place. Every entry is a function, so asking for one fixture never builds the others.
//
// `summaryOf` reduces any fixture to the same shape: how many objects it draws, what its mesh
// library is, how many facts it records and which tables it publishes. That is what a gallery lists
// and what the snapshot test compares, and it is why a new generator needs no change anywhere else.

import type { Fact, ModelData, Table } from '@bim-open-toolkit/model';
import { defaultAssetOptions, generateAssets } from './assets.js';
import { defaultBuildingOptions, generateBuilding, type Building } from './building.js';
import { defaultCarbonOptions, generateCarbon } from './carbon.js';
import { defaultCityOptions, generateCity } from './city.js';
import { defaultClearanceOptions, generateClearances } from './clearances.js';
import { defaultCostOptions, generateCosts } from './costs.js';
import { defaultDeliveryOptions, generateDeliverySchedule } from './deliveries.js';
import { defaultFieldOptions, generateField } from './field.js';
import type { MeshGroup } from './mesh-builder.js';
import { defaultQuantityOptions, generateQuantities } from './quantities.js';
import { defaultRevisionsOptions, generateRevisions } from './revisions.js';
import { defaultServicesOptions, generateServices } from './services.js';
import { defaultStressOptions, generateStressScene } from './stress.js';

// Every generator's default fixture, by the name the V2 plan's synthetic data catalog gives it.
// `schedule` is the delivery and installation record, whose module is `deliveries.ts` because
// `schedule.ts` is the helper that turns observations into schedule columns.
export const fixtures = {
  assets: () => generateAssets(defaultAssetOptions),
  building: () => generateBuilding(defaultBuildingOptions),
  buildingWithRoof: () => generateBuilding({ ...defaultBuildingOptions, roof: true, ceilings: true }),
  carbon: () => generateCarbon(defaultCarbonOptions),
  city: () => generateCity(defaultCityOptions),
  clearances: () => generateClearances(defaultClearanceOptions),
  costs: () => generateCosts(defaultCostOptions),
  field: () => generateField(defaultFieldOptions),
  quantities: () => generateQuantities(defaultQuantityOptions),
  revisions: () => generateRevisions(defaultRevisionsOptions),
  schedule: () => generateDeliverySchedule(defaultDeliveryOptions),
  services: () => generateServices(defaultServicesOptions),
  stress: () => generateStressScene(defaultStressOptions),
} as const;

// The name of a fixture in the catalog.
export type FixtureName = keyof typeof fixtures;

// Whatever one of the catalog's generators returns.
export type Fixture = ReturnType<(typeof fixtures)[FixtureName]>;

// Every fixture name, in the order a gallery lists them. Written out rather than read back from
// the catalog, because reading the keys of an object gives `string` and would need a cast.
export const fixtureNames: readonly FixtureName[] = [
  'assets',
  'building',
  'buildingWithRoof',
  'carbon',
  'city',
  'clearances',
  'costs',
  'field',
  'quantities',
  'revisions',
  'schedule',
  'services',
  'stress',
];

// Builds one fixture by name, with its default options.
export const fixture = (name: FixtureName): Fixture => fixtures[name]();

// One mesh of a fixture's library, without the mesh itself.
export type MeshSummary = {
  readonly name: string;
  readonly instanceCount: number;
  readonly triangleCount: number;
};

// One fixture reduced to what a gallery lists and a snapshot compares.
export type FixtureSummary = {
  readonly name: FixtureName;
  readonly objectCount: number;
  readonly factCount: number;
  readonly meshes: readonly MeshSummary[];
  readonly tables: readonly (readonly [string, Table])[];
  readonly extras: Readonly<Record<string, number | string>>;
};

// The parts of a fixture a summary reads. All optional: a pricing set has no geometry and a stress
// scene has no tables.
type SummaryParts = {
  readonly model?: ModelData | undefined;
  readonly meshGroups?: readonly MeshGroup[] | undefined;
  readonly facts?: readonly Fact[] | undefined;
  readonly tables?: readonly (readonly [string, Table])[] | undefined;
  readonly extras?: Readonly<Record<string, number | string>> | undefined;
};

// A summary of the given parts. An absent part counts as nothing rather than as unknown: a fixture
// that publishes no tables really has none.
const summary = (name: FixtureName, parts: SummaryParts): FixtureSummary => ({
  name,
  objectCount: parts.model === undefined ? 0 : parts.model.objects.length,
  factCount: parts.facts === undefined ? 0 : parts.facts.length,
  meshes: (parts.meshGroups ?? []).map((group) => ({
    name: group.name,
    instanceCount: group.instanceCount,
    triangleCount: group.triangleCount,
  })),
  tables: parts.tables ?? [],
  extras: parts.extras ?? {},
});

// A building's summary. Every building variant publishes the same two schedules.
const buildingSummary = (name: FixtureName, built: Building): FixtureSummary =>
  summary(name, {
    model: built.model,
    meshGroups: built.meshGroups,
    facts: built.facts,
    tables: [
      ['roomSchedule', built.roomSchedule],
      ['doorSchedule', built.doorSchedule],
    ],
  });

// How each fixture describes itself. One entry per generator, so adding a generator is one entry
// here and nothing anywhere else.
const summaries: { readonly [K in FixtureName]: () => FixtureSummary } = {
  assets: () => {
    const built = fixtures.assets();
    return summary('assets', {
      model: built.model,
      meshGroups: built.meshGroups,
      facts: built.facts,
      tables: [
        ['assets', built.assets],
        ['maintenanceEvents', built.maintenanceEvents],
        ['serviceHistoryStatus', built.serviceHistoryStatus],
        ['pointsOfInterest', built.pointsOfInterest],
      ],
    });
  },
  building: () => buildingSummary('building', fixtures.building()),
  buildingWithRoof: () => buildingSummary('buildingWithRoof', fixtures.buildingWithRoof()),
  carbon: () => {
    const built = fixtures.carbon();
    return summary('carbon', {
      tables: [
        ['quantities', built.quantities],
        ['factors', built.factors],
      ],
      extras: { requestedLifecycleScope: built.requestedLifecycleScope, scenarios: built.scenarioIds.join(' ') },
    });
  },
  city: () => {
    const built = fixtures.city();
    return summary('city', {
      model: built.model,
      meshGroups: built.meshGroups,
      tables: [
        ['buildings', built.buildings],
        ['documents', built.documents],
        ['metrics', built.metrics],
      ],
      extras: {
        registered: built.anchors.filter((anchor) => anchor.coordinates.registration.kind === 'geographic').length,
        metricNames: built.metricNames.join(' '),
      },
    });
  },
  clearances: () => {
    const built = fixtures.clearances();
    return summary('clearances', {
      model: built.model,
      meshGroups: built.meshGroups,
      tables: [
        ['envelopes', built.envelopes],
        ['penetrations', built.penetrations],
      ],
      extras: { candidateOverlaps: built.candidateOverlaps, registration: built.coordinates.registration.kind },
    });
  },
  costs: () => {
    const built = fixtures.costs();
    return summary('costs', {
      tables: [
        ['scopes', built.scopes],
        ['rates', built.rates],
        ['scenarios', built.scenarios],
      ],
      extras: { scenarios: built.scenarioIds.join(' ') },
    });
  },
  field: () => {
    const built = fixtures.field();
    return summary('field', {
      extras: {
        field: built.name,
        unit: built.unit,
        dimensions: built.dimensions.join('x'),
        spacing: built.spacing.join('x'),
        cells: built.values.length,
        sampled: built.sampled,
        // The statistics stand in for the values themselves, which are too many to snapshot: a
        // change to any sampled cell moves the mean.
        minimum: Math.round(built.minimum * 1e6) / 1e6,
        maximum: Math.round(built.maximum * 1e6) / 1e6,
        mean: Math.round(built.mean * 1e6) / 1e6,
      },
    });
  },
  quantities: () => {
    const built = fixtures.quantities();
    return summary('quantities', {
      model: built.model,
      meshGroups: built.meshGroups,
      facts: built.facts,
      tables: [['surfaces', built.surfaces]],
    });
  },
  revisions: () => {
    const built = fixtures.revisions();
    return summary('revisions', {
      model: built.after.model,
      meshGroups: built.after.meshGroups,
      tables: [
        ['objectsA', built.objectsA],
        ['objectsB', built.objectsB],
        ['correspondences', built.correspondences],
      ],
      extras: { ...built.changeCounts },
    });
  },
  schedule: () => {
    const built = fixtures.schedule();
    return summary('schedule', {
      model: built.model,
      meshGroups: built.meshGroups,
      tables: [
        ['objects', built.objects],
        ['events', built.events],
      ],
      extras: { asOfDate: built.asOfDate },
    });
  },
  services: () => {
    const built = fixtures.services();
    return summary('services', {
      model: built.model,
      meshGroups: built.meshGroups,
      facts: built.facts,
      tables: [
        ['nodes', built.nodes],
        ['segments', built.segments],
        ['valves', built.valves],
        ['equipment', built.equipment],
      ],
      extras: { startNodeId: built.startNodeId, closedValveIds: built.closedValveIds.join(' ') },
    });
  },
  stress: () => {
    const built = fixtures.stress();
    return summary('stress', {
      model: built.model,
      meshGroups: built.meshGroups,
      extras: {
        instances: built.geometry.instances.count,
        triangles: built.triangleCount,
        opaque: built.materialCounts.opaque,
        transparent: built.materialCounts.transparent,
        metal: built.materialCounts.metal,
        painted: built.materialCounts.painted,
      },
    });
  },
};

// Builds one fixture and reduces it to its summary.
export const summaryOf = (name: FixtureName): FixtureSummary => summaries[name]();
