import { valueOr } from '@bim-open-toolkit/model';
import { doorScheduleWorkflow } from './01-door-schedule.js';
import { revisionComparisonWorkflow } from './02-revision-comparison.js';
import { materialCarbonWorkflow } from './09-material-carbon.js';
import { workflowRegistry, type Workflow, type WorkflowRegistry } from './workflow.js';

// Every workflow this package provides, in the order the product brief lists them.
export const allWorkflows: readonly Workflow[] = [
  doorScheduleWorkflow,
  revisionComparisonWorkflow,
  materialCarbonWorkflow,
];

// The workflows by id. The ids are distinct by construction, so the registry is always built.
export const workflows: WorkflowRegistry = valueOr(workflowRegistry(allWorkflows), new Map());
