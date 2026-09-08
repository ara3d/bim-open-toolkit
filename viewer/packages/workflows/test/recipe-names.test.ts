import { describe, expect, it } from 'vitest';
import { metresZUpLocal } from '@bim-open-toolkit/model';
import { doorScheduleInputSchema, runDoorSchedule } from '../src/01-door-schedule.js';
import { revisionComparisonInputSchema, runRevisionComparison } from '../src/02-revision-comparison.js';
import { runTakeoff, takeoffInputSchema } from '../src/03-takeoff.js';
import { pricingAlternativesInputSchema, runPricingAlternatives } from '../src/04-pricing-alternatives.js';
import { deliveryTimelineInputSchema, runDeliveryTimeline } from '../src/05-delivery-timeline.js';
import { runValveIsolation, valveIsolationInputSchema } from '../src/06-valve-isolation.js';
import { accessCoordinationInputSchema, runAccessCoordination } from '../src/07-access-coordination.js';
import { assetHandoverInputSchema, runAssetHandover } from '../src/08-asset-handover.js';
import { materialCarbonInputSchema, runMaterialCarbon } from '../src/09-material-carbon.js';
import { portfolioInputSchema, runPortfolioDrillThrough } from '../src/10-portfolio-drill-through.js';
import { recipeCommands, workflowCommands } from '../src/recipe.js';
import { fixtureInput, fixtureModel, fixtureModelB, loadFixture, valueOfResult } from './fixtures.js';

// Every command name any of the ten workflows' own recipe actually dispatches, checked against the
// one list `workflowCommands` keeps. `standardRecipe` in `recipe.ts` can only be checked by reading
// it; an extra step a workflow file builds for itself (an `extraSteps` entry) could still dispatch a
// name the list does not know about, and only running the real workflow catches that.
const knownNames = new Set<string>(Object.values(workflowCommands));

const results = [
  valueOfResult(
    'door schedule',
    runDoorSchedule(
      fixtureInput(doorScheduleInputSchema, loadFixture('01-door-schedule'), {
        model: fixtureModel,
        exceptionFacts: ['fireRatingMinutes'],
      }),
    ),
  ),
  valueOfResult(
    'revision comparison',
    runRevisionComparison(
      fixtureInput(revisionComparisonInputSchema, loadFixture('02-revision-comparison'), {
        modelA: fixtureModel,
        modelB: fixtureModelB,
      }),
    ),
  ),
  valueOfResult(
    'takeoff',
    runTakeoff(fixtureInput(takeoffInputSchema, loadFixture('03-takeoff'), { model: fixtureModel })),
  ),
  valueOfResult(
    'pricing alternatives',
    runPricingAlternatives(
      fixtureInput(pricingAlternativesInputSchema, loadFixture('04-pricing-alternatives'), { model: fixtureModel }),
    ),
  ),
  valueOfResult(
    'delivery timeline',
    runDeliveryTimeline(
      fixtureInput(deliveryTimelineInputSchema, loadFixture('05-delivery-timeline'), { model: fixtureModel }),
    ),
  ),
  valueOfResult(
    'valve isolation',
    runValveIsolation(
      fixtureInput(valveIsolationInputSchema, loadFixture('06-valve-isolation'), { model: fixtureModel }),
    ),
  ),
  valueOfResult(
    'access coordination',
    runAccessCoordination(
      fixtureInput(accessCoordinationInputSchema, loadFixture('07-access-coordination'), {
        model: fixtureModel,
        envelopeFrame: metresZUpLocal,
        penetrationFrame: metresZUpLocal,
      }),
    ),
  ),
  valueOfResult(
    'asset handover',
    runAssetHandover(fixtureInput(assetHandoverInputSchema, loadFixture('08-asset-handover'), { model: fixtureModel })),
  ),
  valueOfResult(
    'material carbon',
    runMaterialCarbon(
      fixtureInput(materialCarbonInputSchema, loadFixture('09-material-carbon'), { model: fixtureModel }),
    ),
  ),
  valueOfResult(
    'portfolio drill-through',
    runPortfolioDrillThrough(
      fixtureInput(portfolioInputSchema, loadFixture('10-portfolio-drill-through'), { model: fixtureModel }),
    ),
  ),
];

describe('every workflow recipe', () => {
  it.each(results.map((result) => [result.id, result] as const))(
    '%s dispatches only names workflowCommands lists',
    (_id, result) => {
      for (const command of recipeCommands(result.recipe)) expect(knownNames.has(command)).toBe(true);
    },
  );
});
