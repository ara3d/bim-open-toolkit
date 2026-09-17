import { valueOr } from '@bim-open-toolkit/model';
import { doorScheduleWorkflow } from './01-door-schedule.js';
import { revisionComparisonWorkflow } from './02-revision-comparison.js';
import { takeoffWorkflow } from './03-takeoff.js';
import { pricingAlternativesWorkflow } from './04-pricing-alternatives.js';
import { deliveryTimelineWorkflow } from './05-delivery-timeline.js';
import { valveIsolationWorkflow } from './06-valve-isolation.js';
import { accessCoordinationWorkflow } from './07-access-coordination.js';
import { assetHandoverWorkflow } from './08-asset-handover.js';
import { materialCarbonWorkflow } from './09-material-carbon.js';
import { portfolioDrillThroughWorkflow } from './10-portfolio-drill-through.js';
import { workflowRegistry, type Workflow, type WorkflowRegistry } from './workflow.js';

// Every workflow this package provides, in the order the product brief lists them.
export const allWorkflows: readonly Workflow[] = [
  doorScheduleWorkflow,
  revisionComparisonWorkflow,
  takeoffWorkflow,
  pricingAlternativesWorkflow,
  deliveryTimelineWorkflow,
  valveIsolationWorkflow,
  accessCoordinationWorkflow,
  assetHandoverWorkflow,
  materialCarbonWorkflow,
  portfolioDrillThroughWorkflow,
];

// The workflows by id. The ids are distinct by construction, so the registry is always built.
export const workflows: WorkflowRegistry = valueOr(workflowRegistry(allWorkflows), new Map());
