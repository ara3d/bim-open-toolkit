// Material quantities and the carbon factors that may or may not apply to them.
//
// A carbon figure is only meaningful if the factor and the quantity agree on the unit, and if the
// factor covers the lifecycle scope that was asked for. Both go wrong in real data, so both go
// wrong here on purpose and structurally: one material has no factor in either scenario, one
// factor covers A1-A5 when A1-A3 was requested, one factor is quoted per tonne against a quantity
// in kilogrammes, and one material has a factor in one scenario only.
//
// Nothing is converted and nothing is substituted. A contribution that cannot be computed is
// unresolved, and an unresolved contribution is not zero. The quantity gaps are structural too, so
// `gapScale` switches them off at 0 rather than scaling a rate.

import {
  conflicting,
  coverageOf,
  f64Column,
  known,
  missing,
  quantity,
  stringColumn,
  table,
  type Coverage,
  type Evidence,
  type Observation,
  type Table,
} from '@bim-open-toolkit/model';
import { elementAt } from './arrays.js';
import { cursor as newCursor, drawRange, type Cursor } from './cursor.js';
import { quantityColumns, type NamedColumn } from './schedule.js';

// What to generate. `requestedLifecycleScope` is the scope a run asks for; a factor that covers a
// different one does not apply.
export type CarbonOptions = {
  readonly seed: number;
  readonly objects: number;
  readonly requestedLifecycleScope: string;
  readonly gapScale: number;
};

// Eighteen objects across six materials, asked for the product stage.
export const defaultCarbonOptions: CarbonOptions = {
  seed: 13,
  objects: 18,
  requestedLifecycleScope: 'A1-A3',
  gapScale: 1,
};

// A generated carbon data set: the quantities, the factors, and what a run asks for.
export type Carbon = {
  readonly options: CarbonOptions;
  readonly quantities: Table;
  readonly factors: Table;
  readonly materialIds: readonly string[];
  readonly scenarioIds: readonly string[];
  readonly requestedLifecycleScope: string;
  readonly quantityCoverage: Coverage;
};

// Rejects options that cannot produce a carbon data set.
function checkOptions(options: CarbonOptions): void {
  if (!Number.isInteger(options.seed)) throw new Error(`seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.objects) || options.objects < 1) throw new Error(`objects must be a positive integer, got ${options.objects}`);
  if (options.requestedLifecycleScope === '') throw new Error('requestedLifecycleScope must name a lifecycle scope');
  if (!(options.gapScale >= 0) || !Number.isFinite(options.gapScale)) throw new Error(`gapScale must be a finite number of at least 0, got ${options.gapScale}`);
}

// A material, the unit its quantity is measured in and the range a quantity of it falls in.
type Material = {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  readonly low: number;
  readonly high: number;
  readonly factorLow: number;
  readonly factorHigh: number;
};

// The materials an object can be made of, in the order objects are assigned to them.
const materials: readonly Material[] = [
  { id: 'concrete', name: 'In-situ concrete', unit: 'm3', low: 2, high: 40, factorLow: 240, factorHigh: 340 },
  { id: 'steel', name: 'Structural steel', unit: 'kg', low: 200, high: 5000, factorLow: 1.4, factorHigh: 2.6 },
  { id: 'timber', name: 'Glued laminated timber', unit: 'm3', low: 1, high: 20, factorLow: 90, factorHigh: 180 },
  { id: 'glass', name: 'Insulating glass unit', unit: 'kg', low: 100, high: 1200, factorLow: 1.1, factorHigh: 2.2 },
  { id: 'aluminium', name: 'Aluminium framing', unit: 'kg', low: 50, high: 600, factorLow: 7, factorHigh: 13 },
  { id: 'insulation', name: 'Mineral wool', unit: 'm3', low: 5, high: 60, factorLow: 30, factorHigh: 70 },
];

// The scenarios this fixture carries factors for.
const scenarioIds: readonly string[] = ['asDesigned', 'lowCarbonAlt'];

// One published factor. `unit` and `lifecycleScope` override the material's own, which is how a
// factor ends up unusable without being wrong.
type FactorPolicy = {
  readonly scenario: string;
  readonly materialId: string;
  readonly unit?: string | undefined;
  readonly lifecycleScope?: string | undefined;
};

// The factor set. Timber has no factor at all; the as-designed steel factor covers A1-A5 rather
// than A1-A3; the low-carbon steel factor is quoted per tonne against a quantity in kilogrammes;
// aluminium has a factor in the as-designed scenario only.
const factorPolicies: readonly FactorPolicy[] = [
  { scenario: 'asDesigned', materialId: 'concrete' },
  { scenario: 'asDesigned', materialId: 'steel', lifecycleScope: 'A1-A5' },
  { scenario: 'asDesigned', materialId: 'glass' },
  { scenario: 'asDesigned', materialId: 'aluminium' },
  { scenario: 'asDesigned', materialId: 'insulation' },
  { scenario: 'lowCarbonAlt', materialId: 'concrete' },
  { scenario: 'lowCarbonAlt', materialId: 'steel', unit: 't' },
  { scenario: 'lowCarbonAlt', materialId: 'glass' },
  { scenario: 'lowCarbonAlt', materialId: 'insulation' },
];

// The evidence a material takeoff provides.
const takeoffEvidence: Evidence = { source: 'material-takeoff', reference: 'MT-2026-01' };

// The evidence a supplier declaration provides.
const supplierEvidence: Evidence = { source: 'supplier-declaration', reference: 'EPD-2026' };

// One object's material quantity.
type MaterialQuantity = {
  readonly objectId: string;
  readonly materialId: string;
  readonly quantity: Observation;
};

// The material a factor applies to.
const materialNamed = (id: string): Material => {
  const found = materials.find((material) => material.id === id);
  if (found === undefined) throw new Error(`no material is named ${id}`);
  return found;
};

// Which object carries which gap, by position. Structural rather than drawn, for the same reason
// as the rate set: every run has to exercise all three states. The pattern length is coprime with
// the number of materials, so a gap is not tied to one material.
const quantityStates = ['known', 'known', 'conflicting', 'known', 'missing'] as const;

// What is known about an object's material quantity: taken off, never taken off, or disputed
// between the takeoff and the supplier's declaration. The numbers are always drawn.
function drawQuantity(target: Cursor, material: Material, state: string): Observation {
  const measured = Math.round(drawRange(target, material.low, material.high) * 10) / 10;
  const second = Math.round(measured * drawRange(target, 1.1, 1.3) * 10) / 10;
  if (state === 'conflicting') {
    return conflicting(
      [quantity(measured, material.unit), quantity(second, material.unit)],
      [takeoffEvidence, supplierEvidence],
    );
  }
  if (state === 'missing') return missing('not-provided', [takeoffEvidence]);
  return known(quantity(measured, material.unit), [takeoffEvidence]);
}

// Generates a carbon data set from its options. The same options always give the same factors.
export function generateCarbon(options: CarbonOptions): Carbon {
  checkOptions(options);
  const cursor: Cursor = newCursor(options.seed);
  const gap = options.gapScale;

  const quantities: MaterialQuantity[] = [];
  for (let index = 0; index < options.objects; index++) {
    const material = elementAt(materials, index % materials.length);
    quantities.push({
      objectId: `obj-${index + 1}`,
      materialId: material.id,
      quantity: drawQuantity(cursor, material, gap === 0 ? 'known' : elementAt([...quantityStates], index % quantityStates.length)),
    });
  }

  const factors = factorPolicies.map((policy, index) => {
    const material = materialNamed(policy.materialId);
    return {
      id: `factor-${index + 1}`,
      materialId: policy.materialId,
      scenario: policy.scenario,
      unit: policy.unit ?? material.unit,
      lifecycleScope: policy.lifecycleScope ?? options.requestedLifecycleScope,
      factorValue: Math.round(drawRange(cursor, material.factorLow, material.factorHigh) * 100) / 100,
    };
  });

  const quantityColumnSet: readonly NamedColumn[] = [
    ['objectId', stringColumn(quantities.map((item) => item.objectId))],
    ['materialId', stringColumn(quantities.map((item) => item.materialId))],
    ['materialName', stringColumn(quantities.map((item) => materialNamed(item.materialId).name))],
    ...quantityColumns('quantity', quantities.map((item) => item.quantity)),
  ];

  return {
    options,
    quantities: table(quantityColumnSet),
    factors: table([
      ['id', stringColumn(factors.map((factor) => factor.id))],
      ['materialId', stringColumn(factors.map((factor) => factor.materialId))],
      ['scenario', stringColumn(factors.map((factor) => factor.scenario))],
      ['unit', stringColumn(factors.map((factor) => factor.unit))],
      ['lifecycleScope', stringColumn(factors.map((factor) => factor.lifecycleScope))],
      ['factorValue', f64Column(factors.map((factor) => factor.factorValue))],
    ]),
    materialIds: materials.map((material) => material.id),
    scenarioIds,
    requestedLifecycleScope: options.requestedLifecycleScope,
    quantityCoverage: coverageOf(quantities.map((item) => item.quantity)),
  };
}
