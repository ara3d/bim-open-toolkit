import { missing, type MissingReason, type Observation } from '@bim-open-toolkit/model';
import { observationCell } from './observation.js';
import { listOrNothing, resultRecord, resultTable, textOrNothing, type ResultRow, type ResultTable } from './values.js';

// One thing a workflow could not decide, and why. It never carries a guessed or substituted value.
// `subjects` are ids of the input rows it is about; `related` names candidates that stay unresolved.
export type WorkflowException = {
  readonly subjects: readonly string[];
  readonly related: readonly string[];
  readonly field: string;
  readonly scope: string;
  readonly observation: Observation;
  readonly detail: string;
};

// The context an exception may carry beyond its subject and its observation.
export type ExceptionContext = {
  readonly related?: readonly string[];
  readonly scope?: string;
  readonly detail?: string;
};

// An exception about the named input rows, carrying the observation that explains it.
export const workflowException = (
  subjects: readonly string[],
  field: string,
  observation: Observation,
  context: ExceptionContext = {},
): WorkflowException => ({
  subjects,
  related: context.related ?? [],
  field,
  scope: context.scope ?? '',
  observation,
  detail: context.detail ?? '',
});

// An exception for a value that is not available for a stated reason.
export const missingException = (
  subjects: readonly string[],
  field: string,
  reason: MissingReason,
  context: ExceptionContext = {},
): WorkflowException => workflowException(subjects, field, missing(reason), context);

// An exception as a row. Context fields with nothing in them are left out rather than written blank.
export const exceptionRow = (item: WorkflowException): ResultRow => ({
  ...resultRecord({
    subjects: item.subjects,
    related: listOrNothing(item.related),
    field: item.field,
    scope: textOrNothing(item.scope),
    detail: textOrNothing(item.detail),
  }),
  ...observationCell(item.observation),
});

// The exceptions as the one table a reader looks at for what the workflow could not decide.
export const exceptionTable = (items: readonly WorkflowException[]): ResultTable =>
  resultTable('exceptions', 'Exceptions', items.map(exceptionRow));
