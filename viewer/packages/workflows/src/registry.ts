import { valueOr } from '@bim-open-toolkit/model';
import { doorScheduleWorkflow } from './01-door-schedule.js';
import { workflowRegistry, type Workflow, type WorkflowRegistry } from './workflow.js';

// Every workflow this package provides, in the order the product brief lists them.
export const allWorkflows: readonly Workflow[] = [doorScheduleWorkflow];

// The workflows by id. The ids are distinct by construction, so the registry is always built.
export const workflows: WorkflowRegistry = valueOr(workflowRegistry(allWorkflows), new Map());
