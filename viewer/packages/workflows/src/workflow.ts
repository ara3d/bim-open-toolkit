import {
  diagnostic,
  failure,
  flatMap,
  success,
  type JsonSchema,
  type Result,
  type Schema,
} from '@bim-open-toolkit/model';
import { type WorkflowResult } from './result.js';

// Whether a workflow's demonstration runs on generated data, on a real source, or on both.
export type WorkflowBasis = 'synthetic' | 'source-backed' | 'mixed';

// One workflow from the outside: a described JSON input and a pure run over it.
// The input type is erased, as it is for a command, so a registry can hold all ten together.
export type Workflow = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly basis: WorkflowBasis;
  readonly describeInput: () => JsonSchema;
  readonly run: (input: unknown) => Result<WorkflowResult>;
};

// What a workflow author writes: a typed input schema and a run over the value that schema accepts.
export type WorkflowSpec<I> = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly basis: WorkflowBasis;
  readonly input: Schema<I>;
  readonly run: (input: I) => Result<WorkflowResult>;
};

// A workflow that validates its own input, so the author's run only ever sees a checked value.
export const workflow = <I>(spec: WorkflowSpec<I>): Workflow => ({
  id: spec.id,
  title: spec.title,
  description: spec.description,
  basis: spec.basis,
  describeInput: () => spec.input.describe(),
  run: (input) => flatMap(spec.input.check(input, [spec.id]), spec.run),
});

// What a workflow says about itself, for generated documentation and tool descriptors.
export type WorkflowDescriptor = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly basis: WorkflowBasis;
  readonly inputSchema: JsonSchema;
};

// The workflows by id.
export type WorkflowRegistry = ReadonlyMap<string, Workflow>;

// A registry of workflows, refusing two workflows of the same id rather than losing one of them.
export const workflowRegistry = (items: readonly Workflow[]): Result<WorkflowRegistry> => {
  const registry = new Map<string, Workflow>();
  const repeated = items.filter((item) => {
    const seen = registry.has(item.id);
    registry.set(item.id, item);
    return seen;
  });
  return repeated.length === 0
    ? success(registry)
    : failure(
        repeated.map((item) => diagnostic('workflow/duplicate-id', `More than one workflow is called "${item.id}".`)),
      );
};

// Runs the named workflow, or reports that the registry has no workflow of that name.
export const runWorkflow = (registry: WorkflowRegistry, id: string, input: unknown): Result<WorkflowResult> => {
  const item = registry.get(id);
  return item === undefined
    ? failure([diagnostic('workflow/unknown', `There is no workflow called "${id}".`)])
    : item.run(input);
};

// What each workflow says about itself.
export const describeWorkflow = (item: Workflow): WorkflowDescriptor => ({
  id: item.id,
  title: item.title,
  description: item.description,
  basis: item.basis,
  inputSchema: item.describeInput(),
});

// What every workflow in a registry says about itself.
export const describeWorkflows = (registry: WorkflowRegistry): readonly WorkflowDescriptor[] =>
  [...registry.values()].map(describeWorkflow);
