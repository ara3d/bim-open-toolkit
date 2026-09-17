// Priceable scopes, rate sets and scenario policies, with the scopes no rate set covers.
//
// Pricing is where a viewer is most tempted to show a total that looks complete. The cases that
// stop it are all here and all deliberate rather than drawn, so every run of the fixture exercises
// them: a scope type no scenario prices at all, a rate quoted in a unit the quantity is not
// measured in, a scenario quoted in another currency, two rates that match the same scope, and
// scopes whose quantity nobody measured or two takeoffs dispute.
//
// Only the numbers are drawn. Which cases exist is structural, so a subtotal that silently dropped
// one of them would fail every time rather than on some seeds. `gapScale` therefore switches the
// quantity gaps off at 0 rather than scaling a rate; the absent rates are a fact about the rate
// set and stay whatever it is set to.

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

// What to generate.
export type CostOptions = {
  readonly seed: number;
  readonly scopes: number;
  readonly gapScale: number;
};

// Fourteen scopes across seven scope types and three scenarios.
export const defaultCostOptions: CostOptions = { seed: 7, scopes: 14, gapScale: 1 };

// A generated pricing set: what is to be priced, what the rates are and what each scenario means.
export type Costs = {
  readonly options: CostOptions;
  readonly scopes: Table;
  readonly rates: Table;
  readonly scenarios: Table;
  readonly scenarioIds: readonly string[];
  readonly quantityCoverage: Coverage;
};

// Rejects options that cannot produce a pricing set.
function checkOptions(options: CostOptions): void {
  if (!Number.isInteger(options.seed)) throw new Error(`seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.scopes) || options.scopes < 1) throw new Error(`scopes must be a positive integer, got ${options.scopes}`);
  if (!(options.gapScale >= 0) || !Number.isFinite(options.gapScale)) throw new Error(`gapScale must be a finite number of at least 0, got ${options.gapScale}`);
}

// A kind of work, the unit it is measured in and the range a quantity of it falls in.
type ScopeType = {
  readonly name: string;
  readonly unit: string;
  readonly low: number;
  readonly high: number;
  readonly rateLow: number;
  readonly rateHigh: number;
};

// The scope types a scope can belong to, in the order scopes are assigned to them.
const scopeTypes: readonly ScopeType[] = [
  { name: 'Doors', unit: 'ea', low: 8, high: 40, rateLow: 120, rateHigh: 320 },
  { name: 'Windows', unit: 'ea', low: 6, high: 30, rateLow: 280, rateHigh: 900 },
  { name: 'Carpet', unit: 'm2', low: 80, high: 400, rateLow: 14, rateHigh: 45 },
  { name: 'Tile', unit: 'm2', low: 20, high: 150, rateLow: 40, rateHigh: 95 },
  { name: 'Paint', unit: 'm2', low: 200, high: 900, rateLow: 6, rateHigh: 18 },
  { name: 'Ductwork', unit: 'm', low: 40, high: 200, rateLow: 55, rateHigh: 140 },
  { name: 'Steelwork', unit: 't', low: 5, high: 40, rateLow: 1800, rateHigh: 3200 },
];

// A pricing scenario: what it is called, what currency it is quoted in and what policy it applies.
type Scenario = {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  readonly policy: string;
};

// The scenarios this fixture prices. The third is quoted in another currency, so a total that
// added scenarios together would be wrong in a way a reader can see.
const scenarios: readonly Scenario[] = [
  { id: 'base', name: 'Base tender', currency: 'USD', policy: 'as-tendered' },
  { id: 'alternate', name: 'Alternate supplier', currency: 'USD', policy: 'alternate-supplier' },
  { id: 'value', name: 'Value engineered', currency: 'EUR', policy: 'value-engineered' },
];

// What each scenario prices, and how. `unit` overrides the scope type's own unit, which is how a
// rate ends up quoted in a unit the quantity is not measured in.
type RatePolicy = {
  readonly scenario: string;
  readonly scopeType: string;
  readonly unit?: string | undefined;
};

// The rate set. Steelwork is priced by nobody; Paint is missing from the alternate scenario;
// alternate Carpet is quoted per door rather than per square metre; the value scenario prices only
// three scope types and quotes Doors twice.
const ratePolicies: readonly RatePolicy[] = [
  { scenario: 'base', scopeType: 'Doors' },
  { scenario: 'base', scopeType: 'Windows' },
  { scenario: 'base', scopeType: 'Carpet' },
  { scenario: 'base', scopeType: 'Tile' },
  { scenario: 'base', scopeType: 'Paint' },
  { scenario: 'base', scopeType: 'Ductwork' },
  { scenario: 'alternate', scopeType: 'Doors' },
  { scenario: 'alternate', scopeType: 'Windows' },
  { scenario: 'alternate', scopeType: 'Carpet', unit: 'ea' },
  { scenario: 'alternate', scopeType: 'Tile' },
  { scenario: 'alternate', scopeType: 'Ductwork' },
  { scenario: 'value', scopeType: 'Doors' },
  { scenario: 'value', scopeType: 'Doors' },
  { scenario: 'value', scopeType: 'Carpet' },
  { scenario: 'value', scopeType: 'Tile' },
];

// The evidence a measured takeoff provides.
const takeoffEvidence: Evidence = { source: 'measured-takeoff', reference: 'QS-2026-02' };

// The evidence a second takeoff provides.
const reviewEvidence: Evidence = { source: 'takeoff-review', reference: 'QS-2026-05' };

// One scope to be priced.
type Scope = {
  readonly objectId: string;
  readonly scopeType: string;
  readonly description: string;
  readonly quantity: Observation;
};

// Which scope carries which gap, by position. The gaps are structural rather than drawn, so every
// run exercises all three states; a drawn rate would leave some seeds with no unmeasured scope at
// all and the fixture would prove less. The pattern length is coprime with the number of scope
// types, so a gap is not tied to one kind of work.
const quantityStates = ['known', 'conflicting', 'known', 'missing', 'known'] as const;

// What is known about a scope's quantity: measured, never measured, or disputed between the
// takeoff and its review. The numbers are always drawn, so the draw sequence does not depend on
// which state a scope is in.
function drawQuantity(target: Cursor, type: ScopeType, state: string): Observation {
  const measured = Math.round(drawRange(target, type.low, type.high) * 10) / 10;
  const second = Math.round(measured * drawRange(target, 1.08, 1.25) * 10) / 10;
  if (state === 'conflicting') {
    return conflicting([quantity(measured, type.unit), quantity(second, type.unit)], [takeoffEvidence, reviewEvidence]);
  }
  if (state === 'missing') return missing('not-measured', [takeoffEvidence]);
  return known(quantity(measured, type.unit), [takeoffEvidence]);
}

// The scope type a scenario's rate applies to.
const typeNamed = (name: string): ScopeType => {
  const found = scopeTypes.find((type) => type.name === name);
  if (found === undefined) throw new Error(`no scope type is named ${name}`);
  return found;
};

// Generates a pricing set from its options. The same options always give the same rates.
export function generateCosts(options: CostOptions): Costs {
  checkOptions(options);
  const cursor: Cursor = newCursor(options.seed);
  const gap = options.gapScale;

  const scopes: Scope[] = [];
  for (let index = 0; index < options.scopes; index++) {
    const type = elementAt(scopeTypes, index % scopeTypes.length);
    scopes.push({
      objectId: `scope-${index + 1}`,
      scopeType: type.name,
      description: `${type.name} package ${String(Math.floor(index / scopeTypes.length) + 1)}`,
      quantity: drawQuantity(cursor, type, gap === 0 ? 'known' : elementAt([...quantityStates], index % quantityStates.length)),
    });
  }

  const rates = ratePolicies.map((policy, index) => {
    const type = typeNamed(policy.scopeType);
    const scenario = scenarios.find((item) => item.id === policy.scenario);
    if (scenario === undefined) throw new Error(`no scenario is named ${policy.scenario}`);
    return {
      id: `rate-${index + 1}`,
      scopeType: policy.scopeType,
      scenario: policy.scenario,
      currency: scenario.currency,
      unit: policy.unit ?? type.unit,
      ratePerUnit: Math.round(drawRange(cursor, type.rateLow, type.rateHigh) * 100) / 100,
    };
  });

  const scopeColumns: readonly NamedColumn[] = [
    ['objectId', stringColumn(scopes.map((scope) => scope.objectId))],
    ['scopeType', stringColumn(scopes.map((scope) => scope.scopeType))],
    ['description', stringColumn(scopes.map((scope) => scope.description))],
    ...quantityColumns('quantity', scopes.map((scope) => scope.quantity)),
  ];

  return {
    options,
    scopes: table(scopeColumns),
    rates: table([
      ['id', stringColumn(rates.map((rate) => rate.id))],
      ['scopeType', stringColumn(rates.map((rate) => rate.scopeType))],
      ['scenario', stringColumn(rates.map((rate) => rate.scenario))],
      ['currency', stringColumn(rates.map((rate) => rate.currency))],
      ['unit', stringColumn(rates.map((rate) => rate.unit))],
      ['ratePerUnit', f64Column(rates.map((rate) => rate.ratePerUnit))],
    ]),
    scenarios: table([
      ['id', stringColumn(scenarios.map((scenario) => scenario.id))],
      ['name', stringColumn(scenarios.map((scenario) => scenario.name))],
      ['currency', stringColumn(scenarios.map((scenario) => scenario.currency))],
      ['policy', stringColumn(scenarios.map((scenario) => scenario.policy))],
    ]),
    scenarioIds: scenarios.map((scenario) => scenario.id),
    quantityCoverage: coverageOf(scopes.map((scope) => scope.quantity)),
  };
}
