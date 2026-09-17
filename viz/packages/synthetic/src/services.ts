// A seeded services network: pipe runs, valves and equipment with the topology a valve isolation
// trace walks, and the connections nobody has verified.
//
// The gap that matters here is topology. A trace that assumed every pipe that touches another pipe
// is connected to it would report an affected area that nobody can stand behind. So a documented
// share of branch connections is `unverified`: recorded in the model, not accepted as topology. A
// trace must leave those out of its affected set and report them as coverage gaps at the boundary,
// which it can only do if the data says which is which.
//
// The network is a riser off a plant room with a branch per storey, laid out on axes so every run
// is axis aligned. The shape is deliberately small and regular: it exists to be traced and read,
// not to look like a real building's services.

import {
  boolColumn,
  conflicting,
  coverageOf,
  f64Column,
  fact,
  known,
  metresZUpLocal,
  missing,
  objectRef,
  quantity,
  stringColumn,
  table,
  text,
  translation,
  type Appearance,
  type Coverage,
  type Evidence,
  type Fact,
  type Geometry,
  type ModelData,
  type ModelRef,
  type Observation,
  type Table,
  type Vec3,
} from '@bim-open-toolkit/model';
import { elementAt } from './arrays.js';
import { cursor as newCursor, drawChance, drawFloat, drawPick, drawRange, type Cursor } from './cursor.js';
import type { MeshGroup, ShadedMesh } from './mesh-builder.js';
import { placeRun } from './placement.js';
import { box, cylinder } from './primitives.js';
import { add, scene, sceneBuilder } from './scene.js';
import { quantityColumns, type NamedColumn } from './schedule.js';

// What to generate. Every field is required, so the output is a function of this record alone.
export type ServicesOptions = {
  readonly seed: number;
  readonly storeys: number;
  readonly branchesPerStorey: number;
  readonly fixturesPerBranch: number;
  readonly storeyHeight: number;
  readonly unverifiedRate: number;
  readonly gapScale: number;
};

// A small network: three storeys, two branches each, three fixtures per branch.
export const defaultServicesOptions: ServicesOptions = {
  seed: 1,
  storeys: 3,
  branchesPerStorey: 2,
  fixturesPerBranch: 3,
  storeyHeight: 3.6,
  unverifiedRate: 0.2,
  gapScale: 1,
};

// A generated network. `nodes`, `segments` and `valves` are the tables a trace reads;
// `startNodeId` and `closedValveIds` are one trace worth running against them.
export type Services = {
  readonly options: ServicesOptions;
  readonly model: ModelData;
  readonly meshGroups: readonly MeshGroup[];
  readonly geometry: Geometry;
  readonly facts: readonly Fact[];
  readonly nodes: Table;
  readonly segments: Table;
  readonly valves: Table;
  readonly equipment: Table;
  readonly startNodeId: string;
  readonly closedValveIds: readonly string[];
  readonly connectionCoverage: Coverage;
  readonly diameterCoverage: Coverage;
};

// Rejects options that cannot produce a network. At most four branches leave a riser, because a
// branch travels along one axis in one direction and there are four of those.
function checkOptions(options: ServicesOptions): void {
  if (!Number.isInteger(options.seed)) throw new Error(`seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.storeys) || options.storeys < 1) throw new Error(`storeys must be a positive integer, got ${options.storeys}`);
  if (!Number.isInteger(options.branchesPerStorey) || options.branchesPerStorey < 1 || options.branchesPerStorey > 4) {
    throw new Error(`branchesPerStorey must be an integer from 1 to 4, got ${options.branchesPerStorey}`);
  }
  if (!Number.isInteger(options.fixturesPerBranch) || options.fixturesPerBranch < 1) {
    throw new Error(`fixturesPerBranch must be a positive integer, got ${options.fixturesPerBranch}`);
  }
  if (!(options.storeyHeight > 0.5) || !Number.isFinite(options.storeyHeight)) throw new Error(`storeyHeight must be more than 0.5 metres, got ${options.storeyHeight}`);
  if (!(options.unverifiedRate >= 0) || options.unverifiedRate > 1) throw new Error(`unverifiedRate must be a share from 0 to 1, got ${options.unverifiedRate}`);
  if (!(options.gapScale >= 0) || !Number.isFinite(options.gapScale)) throw new Error(`gapScale must be a finite number of at least 0, got ${options.gapScale}`);
}

// The systems a branch can carry.
const systems = ['Domestic cold water', 'Domestic hot water', 'Heating flow'] as const;

// The evidence the design model provides.
const designEvidence: Evidence = { source: 'design-model', reference: 'MEP-2026-01' };

// The evidence an as-built survey provides.
const asBuiltEvidence: Evidence = { source: 'as-built-survey', reference: 'SV-2026-04' };

// A node of the network: a junction, a valve location or a fixture connection point.
type NetworkNode = { readonly nodeId: string; readonly position: Vec3; readonly kind: string };

// One run of pipe between two nodes, with what is known about it.
type Run = {
  readonly objectId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly system: string;
  readonly accepted: boolean;
  readonly diameterMm: number;
  readonly connection: Observation;
  readonly diameter: Observation;
};

// One valve, and the node it sits at when anybody recorded which node that is.
type Valve = {
  readonly objectId: string;
  readonly name: string;
  readonly nodeId: string;
  readonly position: Vec3;
  readonly valveType: string;
  readonly located: boolean;
};

// One item of equipment at a node.
type Equipment = {
  readonly objectId: string;
  readonly name: string;
  readonly nodeId: string;
  readonly position: Vec3;
  readonly category: string | undefined;
  readonly meshIndex: number;
};

// What is known about a connection: accepted topology, or recorded but never verified.
const connectionOf = (accepted: boolean): Observation =>
  accepted
    ? known(text('accepted'), [designEvidence, asBuiltEvidence])
    : missing('not-provided', [designEvidence]);

// What is known about a run's diameter. A few were never scheduled, and a few disagree between the
// design model and what the surveyor measured on site.
function drawDiameter(target: Cursor, diameterMm: number, gap: number): Observation {
  const roll = drawFloat(target);
  if (roll < 0.05 * gap) {
    return conflicting([quantity(diameterMm, 'mm'), quantity(diameterMm * 0.8, 'mm')], [designEvidence, asBuiltEvidence]);
  }
  if (roll < 0.13 * gap) return missing('not-provided', [designEvidence]);
  return known(quantity(diameterMm, 'mm'), [designEvidence]);
}

// The appearance of each kind of element.
const pipeAppearance: Appearance = { color: [0.62, 0.66, 0.7], opacity: 1, visible: true };
const valveAppearance: Appearance = { color: [0.75, 0.28, 0.2], opacity: 1, visible: true };
const plantAppearance: Appearance = { color: [0.4, 0.48, 0.58], opacity: 1, visible: true };
const terminalAppearance: Appearance = { color: [0.86, 0.86, 0.82], opacity: 1, visible: true };

// The diameter a run carries, in millimetres: the riser is the largest and each branch step down
// serves fewer fixtures.
const branchDiameter = (step: number): number => elementAt([50, 40, 32, 25], Math.min(step, 3));

// Generates a services network from its options. The same options always give the same network.
export function generateServices(options: ServicesOptions): Services {
  checkOptions(options);
  const cursor: Cursor = newCursor(options.seed);
  const gap = options.gapScale;
  const ref: ModelRef = { id: 'synthetic-services', revision: `seed-${options.seed}`, source: 'generated' };

  const meshes: readonly ShadedMesh[] = [
    cylinder(0.5, 1, 12),
    box([0.3, 0.3, 0.3]),
    box([1.6, 1.4, 1.2]),
    box([0.6, 0.6, 0.9]),
  ];
  const meshNames: readonly string[] = ['pipe-run', 'valve-body', 'plant-unit', 'terminal-unit'];
  const pipeMesh = 0;
  const valveMesh = 1;
  const plantMesh = 2;
  const terminalMesh = 3;

  const nodes: NetworkNode[] = [];
  const runs: Run[] = [];
  const valves: Valve[] = [];
  const equipment: Equipment[] = [];

  const source: NetworkNode = { nodeId: 'node-source', position: [0, 0, 0], kind: 'source' };
  nodes.push(source);

  // The riser: one vertical run per storey, always accepted topology, because a trace that cannot
  // rely on the riser cannot demonstrate anything at all.
  let previous = source;
  for (let storey = 1; storey <= options.storeys; storey++) {
    const node: NetworkNode = { nodeId: `node-riser-${storey}`, position: [0, 0, storey * options.storeyHeight], kind: 'riser' };
    nodes.push(node);
    runs.push({
      objectId: `pipe-riser-${storey}`,
      fromNodeId: previous.nodeId,
      toNodeId: node.nodeId,
      from: previous.position,
      to: node.position,
      system: 'Riser',
      accepted: true,
      diameterMm: 100,
      connection: connectionOf(true),
      diameter: drawDiameter(cursor, 100, gap),
    });
    previous = node;
  }

  for (let storey = 1; storey <= options.storeys; storey++) {
    const riser = elementAt(nodes, storey);
    for (let branch = 0; branch < options.branchesPerStorey; branch++) {
      const alongY = branch % 2 === 1;
      const sign = branch < 2 ? 1 : -1;
      const system = drawPick(cursor, systems);
      const spacing = drawRange(cursor, 2.5, 4.5);
      let from = riser;
      for (let step = 1; step <= options.fixturesPerBranch; step++) {
        const distance = sign * step * spacing;
        const position: Vec3 = alongY
          ? [0, distance, riser.position[2]]
          : [distance, 0, riser.position[2]];
        const node: NetworkNode = {
          nodeId: `node-branch-${storey}-${branch + 1}-${step}`,
          position,
          kind: step === options.fixturesPerBranch ? 'fixture' : 'branch',
        };
        nodes.push(node);
        const accepted = !drawChance(cursor, options.unverifiedRate * gap);
        const diameterMm = branchDiameter(step - 1);
        runs.push({
          objectId: `pipe-branch-${storey}-${branch + 1}-${step}`,
          fromNodeId: from.nodeId,
          toNodeId: node.nodeId,
          from: from.position,
          to: node.position,
          system,
          accepted,
          diameterMm,
          connection: connectionOf(accepted),
          diameter: drawDiameter(cursor, diameterMm, gap),
        });
        from = node;
      }

      // The isolation valve for the branch sits at its first node, where it leaves the riser.
      const valveNode = elementAt(nodes, nodes.length - options.fixturesPerBranch);
      const located = !drawChance(cursor, 0.08 * gap);
      valves.push({
        objectId: `valve-${storey}-${branch + 1}`,
        name: `Isolation valve ${storey}.${branch + 1}`,
        nodeId: located ? valveNode.nodeId : '',
        position: valveNode.position,
        valveType: 'ball',
        located,
      });

      equipment.push({
        objectId: `equip-terminal-${storey}-${branch + 1}`,
        name: `Terminal unit ${storey}.${branch + 1}`,
        nodeId: from.nodeId,
        position: [from.position[0], from.position[1], from.position[2] - 0.6],
        category: drawChance(cursor, 0.1 * gap) ? undefined : 'Terminal unit',
        meshIndex: terminalMesh,
      });
    }
  }

  valves.push({
    objectId: 'valve-main',
    name: 'Main isolation valve',
    nodeId: source.nodeId,
    position: source.position,
    valveType: 'gate',
    located: true,
  });
  equipment.push({
    objectId: 'equip-pump',
    name: 'Booster pump set',
    nodeId: source.nodeId,
    position: [0, 0, 0.7],
    category: 'Pump',
    meshIndex: plantMesh,
  });

  const target = sceneBuilder(ref);
  for (const run of runs) {
    add(target, {
      objectId: run.objectId,
      name: `${run.system} ${run.objectId}`,
      category: 'Pipe',
      transform: placeRun(run.from, run.to, run.diameterMm / 1000),
      appearance: pipeAppearance,
      meshIndex: pipeMesh,
    });
  }
  for (const valve of valves) {
    add(target, {
      objectId: valve.objectId,
      name: valve.name,
      category: 'Valve',
      transform: translation(valve.position),
      appearance: valveAppearance,
      meshIndex: valveMesh,
    });
  }
  for (const item of equipment) {
    add(target, {
      objectId: item.objectId,
      name: item.name,
      category: item.category,
      transform: translation(item.position),
      appearance: item.meshIndex === plantMesh ? plantAppearance : terminalAppearance,
      meshIndex: item.meshIndex,
    });
  }

  const built = scene(target, metresZUpLocal, meshes, meshNames);
  const facts: readonly Fact[] = runs.flatMap((run) => [
    fact(objectRef(ref, run.objectId), 'connection', run.connection),
    fact(objectRef(ref, run.objectId), 'diameter', run.diameter),
  ]);

  const segmentColumns: readonly NamedColumn[] = [
    ['objectId', stringColumn(runs.map((run) => run.objectId))],
    ['fromNodeId', stringColumn(runs.map((run) => run.fromNodeId))],
    ['toNodeId', stringColumn(runs.map((run) => run.toNodeId))],
    ['topologyStatus', stringColumn(runs.map((run) => (run.accepted ? 'accepted' : 'unverified')))],
    ['system', stringColumn(runs.map((run) => run.system))],
    ['lengthM', f64Column(runs.map((run) => runLength(run)))],
    ...quantityColumns('diameter', runs.map((run) => run.diameter)),
  ];

  const lastBranch = `node-branch-${options.storeys}-1-${options.fixturesPerBranch}`;
  return {
    options,
    model: built.model,
    meshGroups: built.meshGroups,
    geometry: built.geometry,
    facts,
    nodes: table([
      ['nodeId', stringColumn(nodes.map((node) => node.nodeId))],
      ['kind', stringColumn(nodes.map((node) => node.kind))],
      ['x', f64Column(nodes.map((node) => node.position[0]))],
      ['y', f64Column(nodes.map((node) => node.position[1]))],
      ['z', f64Column(nodes.map((node) => node.position[2]))],
    ]),
    segments: table(segmentColumns),
    valves: table([
      ['objectId', stringColumn(valves.map((valve) => valve.objectId))],
      ['name', stringColumn(valves.map((valve) => valve.name))],
      ['nodeId', stringColumn(valves.map((valve) => valve.nodeId))],
      ['nodeIdKnown', boolColumn(valves.map((valve) => valve.located))],
      ['valveType', stringColumn(valves.map((valve) => valve.valveType))],
    ]),
    equipment: table([
      ['objectId', stringColumn(equipment.map((item) => item.objectId))],
      ['name', stringColumn(equipment.map((item) => item.name))],
      ['nodeId', stringColumn(equipment.map((item) => item.nodeId))],
      ['category', stringColumn(equipment.map((item) => item.category ?? ''))],
      ['categoryKnown', boolColumn(equipment.map((item) => item.category !== undefined))],
    ]),
    startNodeId: lastBranch,
    closedValveIds: [`valve-${options.storeys}-1`],
    connectionCoverage: coverageOf(runs.map((run) => run.connection)),
    diameterCoverage: coverageOf(runs.map((run) => run.diameter)),
  };
}

// The length of a run in metres.
function runLength(run: Run): number {
  return Math.abs(run.to[0] - run.from[0]) + Math.abs(run.to[1] - run.from[1]) + Math.abs(run.to[2] - run.from[2]);
}
